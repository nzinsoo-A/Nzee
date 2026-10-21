# Tutorial: proteggere un account Outlook.com

Video di 90 secondi in italiano che mostra come accedere a Outlook.com, aprire le impostazioni di
sicurezza dell'account Microsoft, aggiungere una nuova e-mail di recupero, rimuovere quella vecchia e
cambiare la password.

- **Video:** [`output/tutorial-sicurezza-outlook.mp4`](output/tutorial-sicurezza-outlook.mp4) (1920×1080, 30 fps, sottotitoli in una fascia sotto lo schermo)
- **Sottotitoli separati:** [`output/tutorial-sicurezza-outlook.srt`](output/tutorial-sicurezza-outlook.srt) (per caricarli a parte, per esempio su YouTube)
- **Testo e scene:** [`copione.md`](copione.md)

## Come è fatto

| Parte | File | Come funziona |
| --- | --- | --- |
| Testo della voce e pause | `piano.json` | Un segmento per frase; `{visibile\|pronuncia}` corregge la pronuncia delle parole inglesi |
| Voce | `audio/voce.py` | Sintesi con [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), voce italiana «Sara», con i tempi di ogni parola. Servono a sincronizzare clic e sottotitoli |
| Schermate e animazioni | `video/` | Pagine ricostruite in HTML/CSS; `scene.js` è la regia (cursore, clic, digitazione, zoom), `motore.js` disegna ogni fotogramma in funzione del tempo |
| Fotogrammi | `video/render.mjs` | Chromium (Playwright) cattura i fotogrammi a 30 fps, che ffmpeg codifica in H.264 |
| Musica | `audio/musica.py` | Base lo-fi originale sintetizzata da zero (piano elettrico FM, basso, batteria, vinile), senza campioni esterni |
| Mixaggio | `audio/mix.py` | La musica si abbassa quando parla la voce; ci sono il suono dei clic e il «ding» delle notifiche, e il volume finale è normalizzato a −16 LUFS |

Per rigenerare tutto (le cartelle `build/` e i modelli vocali si creano da soli): `./build.sh`.
Per controllare singoli istanti senza fare tutto il video:
`node video/render.mjs --anteprima 12.5,40` crea le immagini in `build/anteprime/`.

## Licenze e crediti

- I dati mostrati nel video (nomi, indirizzi, codici) sono inventati. Le pagine Microsoft sono ricostruite a scopo illustrativo.
- Voce: modello Kokoro-82M (Apache 2.0).
- Font: [Selawik](https://github.com/microsoft/Selawik) (SIL Open Font License 1.1) per le pagine, Inter per titoli e sottotitoli.
- Icone: [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) (MIT).
- Musica ed effetti sonori: generati dal codice di questo progetto.
