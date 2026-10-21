#!/usr/bin/env bash
# Genera il video completo: voce → fotogrammi → musica → mixaggio → MP4 finale.
# Requisiti: python3 (kokoro-onnx, onnx, soundfile, scipy, pedalboard), node con playwright, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

python3 audio/voce.py
node video/render.mjs --video --fps 30 --processi "${PROCESSI:-4}"
python3 audio/musica.py
python3 audio/mix.py

mkdir -p output
ffmpeg -y -loglevel error -i build/video_muto.mp4 -i build/audio_finale.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart \
  -metadata title="Proteggi il tuo account Outlook" -metadata language=ita \
  output/tutorial-sicurezza-outlook.mp4
cp build/sottotitoli.srt output/tutorial-sicurezza-outlook.srt
echo "Fatto: output/tutorial-sicurezza-outlook.mp4"
