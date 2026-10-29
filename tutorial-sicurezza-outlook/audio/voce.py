"""Genera la voce narrante e i tempi di ogni parola.

Uso: python3 audio/voce.py [--piano piano.json] [--build build]

Legge il piano e scrive nella cartella di build:
  voce.wav          la voce già posizionata sulla linea del tempo (48 kHz, mono)
  timeline.json     inizio e fine di segmenti, parole e sottotitoli
  sottotitoli.srt   gli stessi sottotitoli in formato SRT

Due motori di sintesi, scelti con "motore" nel piano:
  kokoro      Kokoro-82M; i tempi delle parole vengono dalle durate dei fonemi
  supertonic  Supertonic 3 (più naturale); i tempi si ricavano allineando con il DTW
              la sua lettura a quella di Kokoro dello stesso testo (vedi allinea.py)

Nel testo del piano, {visibile|pronuncia} separa ciò che appare nei sottotitoli
da ciò che legge la voce (es. {outlook.com|àutluk punto com}).
"""

import argparse
import hashlib
import json
import re
import sys
import tarfile
import unicodedata
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from allinea import mappa_tempi

RADICE = Path(__file__).resolve().parent.parent
MODELLI = RADICE / "build" / "modelli"
SR_USCITA = 48000

URL_MODELLO = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
URL_VOCI = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
SUPERTONIC = "sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
URL_SUPERTONIC = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{SUPERTONIC}.tar.bz2"
URL_WHISPER = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2"

MARCATURA = re.compile(r"\{([^|{}]+)\|([^{}]+)\}")
SEGNAPOSTO = re.compile(r"§(\d+)§")


def scarica(url, destinazione):
    if not destinazione.exists():
        print(f"Scarico {destinazione.name}…")
        urllib.request.urlretrieve(url, destinazione)


def prepara_kokoro():
    """Scarica Kokoro e ne espone le durate dei fonemi, che servono per i tempi delle parole."""
    MODELLI.mkdir(parents=True, exist_ok=True)
    con_durate = MODELLI / "kokoro-v1.0-durate.onnx"
    voci = MODELLI / "voices-v1.0.bin"
    scarica(URL_VOCI, voci)
    if not con_durate.exists():
        import onnx
        from onnx import TensorProto, helper

        originale = MODELLI / "kokoro-v1.0.onnx"
        scarica(URL_MODELLO, originale)
        modello = onnx.load(originale)
        # /encoder/Gather_output_0 è la durata (in frame) di ogni fonema, prima della CumSum
        modello.graph.node.append(
            helper.make_node("Identity", ["/encoder/Gather_output_0"], ["duration"], name="espone_durate")
        )
        modello.graph.output.append(helper.make_tensor_value_info("duration", TensorProto.INT64, ["n_token"]))
        onnx.save(modello, con_durate)
    from kokoro_onnx import Kokoro

    return Kokoro(str(con_durate), str(voci))


def prepara_supertonic():
    import sherpa_onnx

    cartella = MODELLI / SUPERTONIC
    if not cartella.exists():
        MODELLI.mkdir(parents=True, exist_ok=True)
        archivio = MODELLI / f"{SUPERTONIC}.tar.bz2"
        scarica(URL_SUPERTONIC, archivio)
        with tarfile.open(archivio) as tar:
            tar.extractall(MODELLI, filter="data")
        archivio.unlink()
    f = lambda nome: str(cartella / nome)
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                duration_predictor=f("duration_predictor.int8.onnx"),
                text_encoder=f("text_encoder.int8.onnx"),
                vector_estimator=f("vector_estimator.int8.onnx"),
                vocoder=f("vocoder.int8.onnx"),
                tts_json=f("tts.json"),
                unicode_indexer=f("unicode_indexer.bin"),
                voice_style=f("voice.bin"),
            ),
            num_threads=4,
            provider="cpu",
        )
    )
    return sherpa_onnx.OfflineTts(config)


def analizza(testo):
    """Divide il testo in parole: [(parola visibile, parola da pronunciare)]."""
    sostituzioni = []

    def segnaposto(m):
        sostituzioni.append((m.group(1), m.group(2)))
        return f"§{len(sostituzioni) - 1}§"

    grezzo = MARCATURA.sub(segnaposto, testo)
    parole = []
    for pezzo in grezzo.split():
        visibile = SEGNAPOSTO.sub(lambda m: sostituzioni[int(m.group(1))][0], pezzo)
        pronuncia = SEGNAPOSTO.sub(lambda m: sostituzioni[int(m.group(1))][1], pezzo)
        parole.append((visibile, pronuncia.replace("«", "").replace("»", "")))
    return parole


def raggruppa_fonemi(fonemi):
    """Raggruppa i tempi dei fonemi in parole, separate dai fonemi «spazio»."""
    gruppi, attuale = [], []
    for f in fonemi:
        if f.phoneme == " ":
            if attuale:
                gruppi.append(attuale)
                attuale = []
        else:
            attuale.append(f)
    if attuale:
        gruppi.append(attuale)
    return [(g[0].start, g[-1].end) for g in gruppi]


def sintetizza_kokoro(kokoro, voce, velocita, parole):
    testo_tts = " ".join(p for _, p in parole)
    audio, sr, fonemi = kokoro.create_timed(testo_tts, voce, speed=velocita, lang="it")
    tempi = raggruppa_fonemi(fonemi)
    n_tts = [len(p.split()) for _, p in parole]
    tempi_parole = []
    if len(tempi) == sum(n_tts):
        i = 0
        for n in n_tts:
            tempi_parole.append((tempi[i][0], tempi[i + n - 1][1]))
            i += n
    else:
        # Raro: espeak ha unito o diviso delle parole. Si ripiega su tempi proporzionali.
        print(f"  attenzione: {len(tempi)} gruppi di fonemi per {sum(n_tts)} parole, tempi stimati", file=sys.stderr)
        lunghezze = np.array([len(p) + 1 for _, p in parole], dtype=float)
        fine_voce = tempi[-1][1] if tempi else len(audio) / sr
        bordi = np.concatenate([[0], np.cumsum(lunghezze)]) / lunghezze.sum() * fine_voce
        tempi_parole = [(bordi[i], bordi[i + 1]) for i in range(len(parole))]
    return audio.astype(np.float32), sr, tempi_parole


def taglia_silenzio(audio, sr, soglia_db=-42, margine=0.03):
    """Toglie il silenzio iniziale e finale, lasciando un piccolo margine."""
    finestra = int(0.01 * sr)
    n = len(audio) // finestra
    energia = np.sqrt((audio[: n * finestra].reshape(n, finestra) ** 2).mean(axis=1))
    attive = np.flatnonzero(energia > 10 ** (soglia_db / 20) * np.abs(audio).max())
    if not len(attive):
        return audio
    a = max(0, attive[0] * finestra - int(margine * sr))
    b = min(len(audio), (attive[-1] + 1) * finestra + int(margine * sr))
    return audio[a:b]


def prepara_asr():
    """Whisper (sherpa-onnx) per controllare che la voce abbia detto proprio il testo previsto."""
    import sherpa_onnx

    cartella = MODELLI / "sherpa-onnx-whisper-turbo"
    if not cartella.exists():
        archivio = MODELLI / "sherpa-onnx-whisper-turbo.tar.bz2"
        scarica(URL_WHISPER, archivio)
        with tarfile.open(archivio) as tar:
            tar.extractall(MODELLI, filter="data")
        archivio.unlink()
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=str(cartella / "turbo-encoder.int8.onnx"),
        decoder=str(cartella / "turbo-decoder.int8.onnx"),
        tokens=str(cartella / "turbo-tokens.txt"),
        language="it",
        task="transcribe",
        num_threads=4,
    )


def trascrivi(asr, audio, sr):
    g = np.gcd(16000, int(sr))
    flusso = asr.create_stream()
    flusso.accept_waveform(16000, resample_poly(audio, 16000 // g, int(sr) // g).astype(np.float32))
    asr.decode_stream(flusso)
    return flusso.result.text


def normalizza(testo):
    testo = unicodedata.normalize("NFKD", testo.lower())
    testo = "".join(c for c in testo if not unicodedata.combining(c))
    testo = re.sub(r"e-?mail", "email", testo).replace("punto com", "com")
    testo = re.sub(r"[^\w\s']", " ", testo).replace("'", " ")
    numeri = {"2": "due"}
    return [numeri.get(p, p) for p in testo.split()]


def errore_parole(atteso, sentito):
    """Word error rate tra due testi (distanza di modifica sulle parole)."""
    a, b = normalizza(atteso), normalizza(sentito)
    d = np.arange(len(b) + 1)
    for i, x in enumerate(a, 1):
        prima, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            prima, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prima + (x != y))
    return d[-1] / max(len(a), 1)


def sintetizza_supertonic(supertonic, kokoro, asr, piano, parole):
    import sherpa_onnx

    config = sherpa_onnx.GenerationConfig()
    config.sid = int(piano["voce"])
    config.speed = float(piano["velocita"])
    config.num_steps = int(piano.get("passi", 24))
    config.extra["lang"] = "it"
    # Ogni lettura di Supertonic è un po' diversa: se ne generano alcune e si tiene
    # quella che Whisper trascrive più fedelmente (ogni tanto il modello storpia una parola).
    atteso = " ".join(v for v, _ in parole)
    migliore = None
    for n in range(int(piano.get("candidati", 4))):
        risultato = supertonic.generate(" ".join(p for _, p in parole), config)
        sr = risultato.sample_rate
        audio = taglia_silenzio(np.array(risultato.samples, dtype=np.float32), sr)
        if asr is None:
            migliore = (0.0, audio, "")
            break
        sentito = trascrivi(asr, audio, sr)
        wer = errore_parole(atteso, sentito)
        if migliore is None or wer < migliore[0]:
            migliore = (wer, audio, sentito)
        if wer == 0:
            break
    wer, audio, sentito = migliore
    if wer > 0:
        print(f"  attenzione: miglior lettura con WER {wer:.2f} dopo {n + 1} tentativi: «{sentito.strip()}»", file=sys.stderr)
    # tempi delle parole: lettura di riferimento con Kokoro, poi allineamento DTW
    rif = piano.get("riferimento", {"voce": "if_sara", "velocita": 1.0})
    audio_rif, sr_rif, tempi_rif = sintetizza_kokoro(kokoro, rif["voce"], rif["velocita"], parole)
    istanti = [t for coppia in tempi_rif for t in coppia]
    mappati = np.array(mappa_tempi(audio_rif, sr_rif, audio, sr, istanti)).reshape(-1, 2)
    mappati = np.clip(np.maximum.accumulate(mappati.ravel()).reshape(-1, 2), 0, len(audio) / sr)
    return audio, sr, [tuple(map(float, c)) for c in mappati]


def dividi_sottotitoli(parole, massimo=78):
    """Spezza un segmento in sottotitoli di al massimo `massimo` caratteri.

    Prima per frasi, poi, se una frase è troppo lunga, nel punto che divide meglio a metà,
    preferendo la punteggiatura e senza mai spezzare un'etichetta tra «».
    """
    lun = lambda ws: len(" ".join(x["w"] for x in ws))

    def spezza(ws):
        if lun(ws) <= massimo or len(ws) < 2:
            return [ws]
        migliore = None
        for i in range(1, len(ws)):
            prima = ws[i - 1]["w"]
            aperte = sum(x["w"].count("«") - x["w"].count("»") for x in ws[:i])
            sx, dx = lun(ws[:i]), lun(ws[i:])
            costo = abs(sx - dx)
            costo -= 35 if prima[-1] in ",:;" else 12 if prima.endswith("»") else 0
            costo -= 8 if ws[i]["w"] in ("e", "poi", "o", "ma") else 0
            costo += 100 if aperte > 0 else 0
            costo += 60 if min(sx, dx) < 12 else 0
            if migliore is None or costo < migliore[0]:
                migliore = (costo, i)
        i = migliore[1]
        return spezza(ws[:i]) + spezza(ws[i:])

    frasi, attuale = [], []
    for p in parole:
        attuale.append(p)
        if p["w"][-1] in ".!?":
            frasi.append(attuale)
            attuale = []
    if attuale:
        frasi.append(attuale)
    blocchi = [b for f in frasi for b in spezza(f)]
    # una frase cortissima («Fatto!») si unisce alla successiva, se ci sta
    uniti = []
    for b in blocchi:
        if uniti and lun(uniti[-1]) < 14 and lun(uniti[-1]) + 1 + lun(b) <= massimo:
            uniti[-1] = uniti[-1] + b
        else:
            uniti.append(b)
    return [{"t0": b[0]["t0"], "t1": b[-1]["t1"], "testo": " ".join(x["w"] for x in b)} for b in uniti]


def a_capo(testo, larghezza=42):
    """Divide una riga lunga in due righe di lunghezza simile (per il file SRT)."""
    if len(testo) <= larghezza:
        return testo
    spazi = [i for i, c in enumerate(testo) if c == " "]
    meta = len(testo) / 2
    i = min(spazi, key=lambda s: abs(s - meta))
    return testo[:i] + "\n" + testo[i + 1 :]


def ora_srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    argomenti = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    argomenti.add_argument("--piano", default=str(RADICE / "piano.json"))
    argomenti.add_argument("--build", default=str(RADICE / "build"))
    args = argomenti.parse_args()

    piano = json.loads(Path(args.piano).read_text(encoding="utf-8"))
    build = Path(args.build)
    build.mkdir(parents=True, exist_ok=True)
    motore = piano.get("motore", "kokoro")
    kokoro = prepara_kokoro()
    supertonic = prepara_supertonic() if motore == "supertonic" else None
    asr = prepara_asr() if supertonic and piano.get("candidati", 4) > 1 else None

    # le letture già fatte si riusano: si rigenerano solo i segmenti con testo o impostazioni cambiate
    cache = build / "cache_voce"
    cache.mkdir(exist_ok=True)
    impostazioni = {k: piano.get(k) for k in ("motore", "voce", "velocita", "passi", "riferimento")}

    tracce, segmenti, t = [], [], 0.0
    for seg in piano["segmenti"]:
        parole = analizza(seg["testo"])
        chiave = hashlib.sha1(json.dumps([impostazioni, seg["testo"]], ensure_ascii=False).encode()).hexdigest()[:16]
        if (cache / f"{chiave}.json").exists():
            audio, sr = sf.read(cache / f"{chiave}.wav", dtype="float32")
            tempi = json.loads((cache / f"{chiave}.json").read_text())["tempi"]
        else:
            if supertonic:
                audio, sr, tempi = sintetizza_supertonic(supertonic, kokoro, asr, piano, parole)
            else:
                audio, sr, tempi = sintetizza_kokoro(kokoro, piano["voce"], piano["velocita"], parole)
            sf.write(cache / f"{chiave}.wav", audio, sr, subtype="FLOAT")
            (cache / f"{chiave}.json").write_text(json.dumps({"tempi": [list(map(float, c)) for c in tempi]}))
        t += seg["pausa_prima"]
        inizio = t
        durata = len(audio) / sr
        info_parole = [
            {"w": vis, "t0": round(inizio + a, 3), "t1": round(inizio + b, 3)} for (vis, _), (a, b) in zip(parole, tempi)
        ]
        segmenti.append(
            {
                "id": seg["id"],
                "inizio": round(inizio, 3),
                "fine": round(inizio + durata, 3),
                "testo": " ".join(vis for vis, _ in parole),
                "parole": info_parole,
                "cue": dividi_sottotitoli(info_parole, piano.get("caratteri_sottotitolo", 78)),
            }
        )
        g = np.gcd(SR_USCITA, int(sr))
        tracce.append((inizio, resample_poly(audio, SR_USCITA // g, int(sr) // g).astype(np.float32)))
        print(f"{seg['id']:<10} {inizio:6.2f}s → {inizio + durata:6.2f}s  ({durata:.2f}s)")
        t += durata + seg["pausa_dopo"]

    durata_totale = t + piano["coda"]
    voce = np.zeros(int(durata_totale * SR_USCITA) + 1, dtype=np.float32)
    for inizio, audio in tracce:
        i = int(round(inizio * SR_USCITA))
        voce[i : i + len(audio)] += audio[: len(voce) - i]
    sf.write(build / "voce.wav", voce, SR_USCITA, subtype="FLOAT")

    timeline = {"durata": round(durata_totale, 3), "segmenti": segmenti}
    (build / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")

    scrivi_srt(segmenti, build)
    print(f"Durata totale: {durata_totale:.2f}s")


def scrivi_srt(segmenti, build):
    cue = [c for s in segmenti for c in s["cue"]]
    righe = []
    for n, c in enumerate(cue, 1):
        fine = c["t1"] + 0.35
        if n < len(cue):
            fine = min(fine, cue[n]["t0"] - 0.08)  # il sottotitolo successivo parte 0,05 s prima della voce
        righe.append(f"{n}\n{ora_srt(c['t0'] - 0.05)} --> {ora_srt(fine)}\n{a_capo(c['testo'])}\n")
    (Path(build) / "sottotitoli.srt").write_text("\n".join(righe), encoding="utf-8")


if __name__ == "__main__":
    main()
