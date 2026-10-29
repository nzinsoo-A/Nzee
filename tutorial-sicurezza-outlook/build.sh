#!/usr/bin/env bash
# Genera il video completo: voce → fotogrammi → musica → mixaggio → MP4 finale.
#
#   ./build.sh            versione da computer (16:9)
#   ./build.sh telefono   versione da telefono (9:16, iPhone con Safari)
#
# Requisiti: python3 (kokoro-onnx, sherpa-onnx ≥ 2.0, onnx, soundfile, scipy, pedalboard),
# node con playwright, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-computer}" = "telefono" ]; then
  piano=piano_mobile.json; build=build/mobile; sorgente=mobile; formato=1080x1920; stile=telefono
  nome=tutorial-sicurezza-outlook-telefono
else
  piano=piano.json; build=build; sorgente=video; formato=1920x1080; stile=computer
  nome=tutorial-sicurezza-outlook
fi

python3 audio/voce.py --piano "$piano" --build "$build"
node video/render.mjs --sorgente "$sorgente" --build "$build" --formato "$formato" --video --fps 30 --processi "${PROCESSI:-4}"
python3 audio/musica.py --build "$build"
python3 audio/mix.py --build "$build" --stile "$stile"

mkdir -p output
ffmpeg -y -loglevel error -i "$build/video_muto.mp4" -i "$build/audio_finale.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart \
  -metadata title="Proteggi il tuo account Outlook" -metadata:s:a:0 language=ita \
  "output/$nome.mp4"
cp "$build/sottotitoli.srt" "output/$nome.srt"
echo "Fatto: output/$nome.mp4"
