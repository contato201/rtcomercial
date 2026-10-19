# Receita do transcritor do RT Meet na nuvem do LiveKit.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Usuário sem privilégios, como recomenda a LiveKit.
RUN useradd --create-home --uid 10001 rt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY transcritor.py .
USER rt

# `start` = modo produção: o servidor do LiveKit chama o transcritor para cada sala nova.
CMD ["python", "transcritor.py", "start"]
