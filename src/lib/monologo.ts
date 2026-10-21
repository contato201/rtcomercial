/**
 * Alerta de monólogo: "Você está falando há 2 minutos seguidos."
 *
 * Roda no navegador, uma conta por segundo, sem IA — por isso avisa na hora.
 * O monólogo começa quando o closer fala e só acaba quando o CLIENTE fala ou
 * quando o closer fica calado por um tempo (devolveu a palavra e esperou).
 * Respirar entre uma frase e outra não zera a conta.
 */

export interface EstadoMonologo {
  /** Quando o closer começou a falar sem o cliente falar no meio. */
  inicio: number | null;
  /** A última vez que o closer estava falando. */
  ultimaFala: number | null;
}

export const MONOLOGO_INICIAL: EstadoMonologo = { inicio: null, ultimaFala: null };

/** Silêncio do closer que conta como "devolveu a palavra". */
export const PAUSA_QUE_DEVOLVE_MS = 8_000;
/** A partir daqui aparece o alerta. */
export const ALERTA_MONOLOGO_MS = 120_000;

export function avancaMonologo(
  e: EstadoMonologo,
  agora: number,
  closerFalando: boolean,
  clienteFalando: boolean,
): EstadoMonologo {
  if (clienteFalando) return MONOLOGO_INICIAL;
  if (closerFalando) return { inicio: e.inicio ?? agora, ultimaFala: agora };
  if (e.ultimaFala !== null && agora - e.ultimaFala > PAUSA_QUE_DEVOLVE_MS) return MONOLOGO_INICIAL;
  return e;
}

/** Há quanto tempo o closer está falando sozinho (0 = não está). */
export const duracaoMonologo = (e: EstadoMonologo) =>
  e.inicio !== null && e.ultimaFala !== null ? e.ultimaFala - e.inicio : 0;

/** "2 minutos" / "1 minuto e 30 segundos". */
export function tempoFalado(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const resto = s % 60;
  const min = `${m} minuto${m === 1 ? '' : 's'}`;
  if (m === 0) return `${resto} segundos`;
  return resto >= 30 ? `${min} e meio` : min;
}

/**
 * O texto do alerta, juntando o que o rosto do cliente mostra:
 * "Você está falando há 2 minutos seguidos. A atenção da Mariana caiu para 31%
 *  e ela não deu nenhum sinal de concordância."
 */
export function textoDoAlerta(
  ms: number,
  cliente?: { nome: string; atencao: number; acenou: boolean } | null,
): string {
  const base = `Você está falando há ${tempoFalado(ms)} seguidos.`;
  if (!cliente) return `${base} Faça uma pergunta e devolva a palavra.`;
  const partes: string[] = [];
  if (cliente.atencao < 50) partes.push(`a atenção de ${cliente.nome} caiu para ${cliente.atencao}%`);
  if (!cliente.acenou) partes.push('não houve nenhum sinal de concordância');
  if (partes.length === 0) return `${base} ${cliente.nome} ainda está atento — mas devolva a palavra.`;
  const frase = partes.join(' e ');
  return `${base} ${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
}
