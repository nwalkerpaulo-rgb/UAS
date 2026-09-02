#!/bin/bash
# streaming/cuas-capture/start.sh
#
# 1. Cria um ecrã virtual (Xvfb) — não precisa de monitor nem placa gráfica
# 2. Abre o Chromium em modo kiosk (só a imagem, sem barras) apontado à
#    página web do sistema C-UAS
# 3. O ffmpeg grava esse ecrã virtual e envia-o por RTMP para o MediaMTX
#
# Se o Chromium ou o ffmpeg morrerem por algum motivo, o "while true" volta
# a arrancar tudo — pensado para correr sem intervenção durante dias.

set -e

DISPLAY_NUM=99
export DISPLAY=":${DISPLAY_NUM}"

echo "[cuas-capture] A iniciar ecrã virtual ${SCREEN_WIDTH}x${SCREEN_HEIGHT}..."
Xvfb "${DISPLAY}" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" &
sleep 2

echo "[cuas-capture] A abrir Chromium em ${CUAS_URL}..."
chromium \
  --no-sandbox \
  --disable-gpu \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --window-size="${SCREEN_WIDTH},${SCREEN_HEIGHT}" \
  --window-position=0,0 \
  --user-data-dir=/tmp/chromium-profile \
  "${CUAS_URL}" &

sleep 5

echo "[cuas-capture] A iniciar captura e envio RTMP para ${MEDIAMTX_RTMP_URL}..."
while true; do
  ffmpeg \
    -f x11grab -video_size "${SCREEN_WIDTH}x${SCREEN_HEIGHT}" -framerate 15 -i "${DISPLAY}" \
    -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p \
    -b:v 1500k -maxrate 1500k -bufsize 3000k \
    -f flv "${MEDIAMTX_RTMP_URL}" \
    || echo "[cuas-capture] ffmpeg terminou com erro — a tentar novamente em 5s"
  sleep 5
done
