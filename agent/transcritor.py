"""RT Meet — o assistente invisível que transcreve as reuniões.

Entra sozinho em toda sala do RT Meet, escuta cada pessoa separadamente e
transcreve em português (Deepgram Nova-3 pelo LiveKit Inference — sem conta
nem chave além das do LiveKit). Não fala, não responde e não aparece na tela.

Três regras, todas por causa da LGPD e do lead:
1. Só transcreve quem foi avisado — o porteiro marca `consentiu` no crachá.
2. Manda o texto SÓ para o anfitrião (o closer), nunca para o lead. É a tela
   do anfitrião que guarda a transcrição e pede as dicas ao Coach.
3. Desliga a legenda automática do LiveKit, que iria para todo mundo da sala.

Baseado no exemplo oficial `examples/other/transcription/multi-user-transcriber.py`
do repositório livekit/agents (licença Apache 2.0).
"""

import asyncio
import json
import logging
import time
import uuid

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    StopResponse,
    cli,
    inference,
    llm,
    room_io,
    utils,
)

logger = logging.getLogger("rt-transcritor")

TOPICO = "rt-transcricao"
# Quem fala na reunião. O observador entra mudo e invisível: não tem o que transcrever.
PAPEIS_TRANSCRITOS = {"anfitriao", "lead", "convidado"}


def dados_do_cracha(participante: rtc.Participant) -> dict:
    """O que o porteiro gravou no crachá: papel, sala e consentimento."""
    try:
        return json.loads(participante.metadata or "{}")
    except json.JSONDecodeError:
        return {}


def pode_transcrever(participante: rtc.Participant) -> bool:
    dados = dados_do_cracha(participante)
    return dados.get("papel") in PAPEIS_TRANSCRITOS and dados.get("consentiu") is True


async def manda_para_o_anfitriao(sala: rtc.Room, trecho: dict) -> None:
    destinos = [
        p.identity
        for p in sala.remote_participants.values()
        if dados_do_cracha(p).get("papel") == "anfitriao"
    ]
    if not destinos:
        # Sem closer na sala ainda (o lead chegou antes): não há quem guarde.
        return
    await sala.local_participant.send_text(
        json.dumps(trecho, ensure_ascii=False),
        topic=TOPICO,
        destination_identities=destinos,
    )


class Ouvido(Agent):
    """Escuta uma pessoa. Cada fala completa vira um trecho de transcrição."""

    def __init__(self, *, sala: rtc.Room, participante: rtc.RemoteParticipant):
        super().__init__(
            instructions="Você só transcreve. Nunca responde.",
            stt=inference.STT("deepgram/nova-3", language="pt-BR"),
        )
        self._sala = sala
        self._participante = participante

    async def on_user_turn_completed(self, chat_ctx: llm.ChatContext, new_message: llm.ChatMessage):
        texto = (new_message.text_content or "").strip()
        if texto:
            dados = dados_do_cracha(self._participante)
            trecho = {
                "id": str(uuid.uuid4()),
                "identidade": self._participante.identity,
                "quem": self._participante.name or self._participante.identity,
                "papel": dados.get("papel"),
                "texto": texto,
                "falado_em": int(time.time() * 1000),
            }
            try:
                await manda_para_o_anfitriao(self._sala, trecho)
            except Exception:
                logger.exception("não consegui mandar o trecho para o anfitrião")
        # Não responde nada: o assistente só escuta.
        raise StopResponse()


class Transcritor:
    """Um Ouvido por pessoa que fala na sala."""

    def __init__(self, ctx: JobContext):
        self.ctx = ctx
        self._sessoes: dict[str, AgentSession] = {}
        self._tarefas: set[asyncio.Task] = set()

    def comeca(self):
        self.ctx.room.on("participant_connected", self.entrou)
        self.ctx.room.on("participant_disconnected", self.saiu)

    async def fecha(self):
        await utils.aio.cancel_and_wait(*self._tarefas)
        await asyncio.gather(*[self._fecha_sessao(s) for s in self._sessoes.values()])
        self.ctx.room.off("participant_connected", self.entrou)
        self.ctx.room.off("participant_disconnected", self.saiu)

    def entrou(self, participante: rtc.RemoteParticipant):
        if participante.identity in self._sessoes or not pode_transcrever(participante):
            return
        logger.info("ouvindo %s", participante.identity)
        tarefa = asyncio.create_task(self._abre_sessao(participante))
        self._tarefas.add(tarefa)

        def ao_terminar(t: asyncio.Task):
            try:
                self._sessoes[participante.identity] = t.result()
            except Exception:
                logger.exception("não consegui ouvir %s", participante.identity)
            finally:
                self._tarefas.discard(t)

        tarefa.add_done_callback(ao_terminar)

    def saiu(self, participante: rtc.RemoteParticipant):
        sessao = self._sessoes.pop(participante.identity, None)
        if sessao is None:
            return
        tarefa = asyncio.create_task(self._fecha_sessao(sessao))
        self._tarefas.add(tarefa)
        tarefa.add_done_callback(lambda t: self._tarefas.discard(t))

    async def _abre_sessao(self, participante: rtc.RemoteParticipant) -> AgentSession:
        sessao = AgentSession()
        await sessao.start(
            agent=Ouvido(sala=self.ctx.room, participante=participante),
            room=self.ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=True,
                audio_output=False,
                # Regra 3: sem legenda automática — ela iria para a sala inteira,
                # inclusive para o lead. O texto vai só para o anfitrião.
                text_output=False,
                text_input=False,
                participant_identity=participante.identity,
            ),
        )
        return sessao

    async def _fecha_sessao(self, sessao: AgentSession) -> None:
        await sessao.drain()
        await sessao.aclose()


servidor = AgentServer()


# Sem `agent_name`: o LiveKit coloca o transcritor em TODA sala nova sozinho.
# Todas as salas deste projeto são do RT Meet.
@servidor.rtc_session()
async def entrada(ctx: JobContext):
    transcritor = Transcritor(ctx)
    transcritor.comeca()

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    for participante in ctx.room.remote_participants.values():
        transcritor.entrou(participante)

    async def limpa():
        await transcritor.fecha()

    ctx.add_shutdown_callback(limpa)


if __name__ == "__main__":
    cli.run_app(servidor)
