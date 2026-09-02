# streaming/cuas-capture/Dockerfile
#
# Serviço que abre a página web do sistema C-UAS num browser sem ecrã
# (Chromium + Xvfb = "ecrã virtual"), e usa o ffmpeg para gravar esse
# ecrã virtual como se fosse uma câmara, enviando o resultado por RTMP
# para o MediaMTX — exatamente como o drone envia o seu próprio vídeo.

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY start.sh /start.sh
RUN chmod +x /start.sh

# Configuráveis via variáveis de ambiente (ver docker-compose.yml)
ENV CUAS_URL="http://192.168.1.10:7001"
ENV MEDIAMTX_RTMP_URL="rtmp://mediamtx:1935/cuas1"
ENV SCREEN_WIDTH=1280
ENV SCREEN_HEIGHT=720

ENTRYPOINT ["/start.sh"]
