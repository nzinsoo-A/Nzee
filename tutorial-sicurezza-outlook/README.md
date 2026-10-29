# Tutorial: proteggere un account Outlook.com

Video tutorial in italiano: come accedere a Outlook.com, aprire le impostazioni di sicurezza
dell'account Microsoft, aggiungere una nuova e-mail di recupero, rimuovere quella vecchia e cambiare
la password. Ci sono due versioni.

| Versione | Video | Sottotitoli separati | Testo e scene |
| --- | --- | --- | --- |
| **Telefono**: verticale 1080×1920, iPhone con Safari, circa 98 s | [`output/tutorial-sicurezza-outlook-telefono.mp4`](output/tutorial-sicurezza-outlook-telefono.mp4) | [`.srt`](output/tutorial-sicurezza-outlook-telefono.srt) | [`copione_telefono.md`](copione_telefono.md) |
| **Computer**: 1920×1080, browser da desktop, 90 s | [`output/tutorial-sicurezza-outlook.mp4`](output/tutorial-sicurezza-outlook.mp4) | [`.srt`](output/tutorial-sicurezza-outlook.srt) | [`copione.md`](copione.md) |

In entrambe i sottotitoli stanno in una fascia separata, quindi non coprono mai l'interfaccia. Il file
`.srt` serve a caricarli a parte, per esempio su YouTube.

## Come è fatto

| Parte | File | Come funziona |
| --- | --- | --- |
| Testo della voce e pause | `piano.json`, `piano_mobile.json` | Un segmento per frase; `{visibile\|pronuncia}` corregge la pronuncia |
| Voce | `audio/voce.py`, `audio/allinea.py` | Computer: [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), voce «Sara», con i tempi di ogni parola. Telefono: Supertonic 3 (più naturale); ogni frase si genera più volte e Whisper sceglie la lettura senza errori, e i tempi delle parole si ricavano con il DTW rispetto a Kokoro |
| Schermate e animazioni | `video/` (computer), `mobile/` (telefono) | Pagine ricostruite in HTML/CSS; `scene.js` è la regia (clic o tocchi, digitazione, tastiera, scorrimenti, zoom), `motore.js` disegna ogni fotogramma in funzione del tempo |
| Fotogrammi | `video/render.mjs` | Chromium (Playwright) cattura i fotogrammi a 30 fps, che ffmpeg codifica in H.264 |
| Musica | `audio/musica.py` | Base lo-fi originale sintetizzata da zero (piano elettrico FM, basso, batteria, vinile), senza campioni esterni |
| Mixaggio | `audio/mix.py` | La musica si abbassa quando parla la voce. Ci sono clic o tocchi, i tasti della tastiera e il «ding» delle notifiche; il volume finale è normalizzato a −16 LUFS |

Per rigenerare tutto (le cartelle `build/` e i modelli si creano da soli): `./build.sh` per la
versione da computer, `./build.sh telefono` per quella da telefono. Le frasi già generate si riusano,
quindi cambiare una frase rigenera solo quella. Per controllare singoli istanti senza fare tutto il
video: `node video/render.mjs --sorgente mobile --build build/mobile --formato 1080x1920 --anteprima 12.5,40`
crea le immagini in `build/mobile/anteprime/`.

## Licenze e crediti

- I dati mostrati nel video (nomi, indirizzi, codici) sono inventati. Le pagine Microsoft sono ricostruite a scopo illustrativo.
- Voci: Kokoro-82M (Apache 2.0); [Supertonic 3](https://github.com/supertone-inc/supertonic) (modello OpenRAIL-M, codice MIT), tramite [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). Controllo delle letture: Whisper (MIT).
- Font: [Selawik](https://github.com/microsoft/Selawik) (SIL Open Font License 1.1) per le pagine, Inter per titoli, sottotitoli e interfaccia del telefono.
- Icone: [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) (MIT).
- Musica ed effetti sonori: generati dal codice di questo progetto.
