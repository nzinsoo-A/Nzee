"""Genera la voce narrante con Kokoro (voce «Sara») e i tempi di ogni parola.

Legge piano.json e scrive in build/:
  voce.wav          la voce già posizionata sulla linea del tempo (48 kHz, mono)
  timeline.json     inizio e fine di segmenti, parole e sottotitoli
  sottotitoli.srt   gli stessi sottotitoli in formato SRT

Nel testo del piano, {visibile|pronuncia} separa ciò che appare nei sottotitoli
da ciò che legge la voce (es. {e-mail|imèil}), così le parole inglesi
vengono pronunciate all'italiana.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

RADICE = Path(__file__).resolve().parent.parent
BUILD = RADICE / "build"
MODELLI = BUILD / "modelli"
SR_USCITA = 48000

URL_MODELLO = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
URL_VOCI = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

MARCATURA = re.compile(r"\{([^|{}]+)\|([^{}]+)\}")
SEGNAPOSTO = re.compile(r"§(\d+)§")


def scarica(url, destinazione):
    if not destinazione.exists():
        print(f"Scarico {destinazione.name}…")
        urllib.request.urlretrieve(url, destinazione)


def prepara_modello():
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
    return con_durate, voci


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


def sintetizza(kokoro, piano, parole):
    testo_tts = " ".join(p for _, p in parole)
    audio, sr, fonemi = kokoro.create_timed(testo_tts, piano["voce"], speed=piano["velocita"], lang="it")
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


def dividi_sottotitoli(parole):
    """Spezza un segmento in sottotitoli brevi (al massimo due righe), preferendo la punteggiatura."""
    blocchi, attuale = [], []
    for i, p in enumerate(parole):
        attuale.append(p)
        testo = " ".join(x["w"] for x in attuale)
        prossima = parole[i + 1]["w"] if i + 1 < len(parole) else None
        fine_frase = p["w"][-1] in ".!?"
        pausa = p["w"][-1] in ",:;»" and len(testo) >= 30
        troppo_lungo = prossima is not None and len(testo) + 1 + len(prossima) > 78
        if fine_frase or pausa or troppo_lungo or prossima is None:
            blocchi.append(attuale)
            attuale = []
    # un frammento cortissimo si unisce al blocco precedente, se ci sta
    uniti = []
    for b in blocchi:
        testo = " ".join(x["w"] for x in b)
        if uniti and len(testo) < 14 and len(" ".join(x["w"] for x in uniti[-1])) + len(testo) < 84:
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
    from kokoro_onnx import Kokoro

    piano = json.loads((RADICE / "piano.json").read_text(encoding="utf-8"))
    modello, voci = prepara_modello()
    kokoro = Kokoro(str(modello), str(voci))

    BUILD.mkdir(exist_ok=True)
    tracce, segmenti, t = [], [], 0.0
    for seg in piano["segmenti"]:
        parole = analizza(seg["testo"])
        audio, sr, tempi = sintetizza(kokoro, piano, parole)
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
                "cue": dividi_sottotitoli(info_parole),
            }
        )
        tracce.append((inizio, resample_poly(audio, SR_USCITA, sr).astype(np.float32)))
        print(f"{seg['id']:<10} {inizio:6.2f}s → {inizio + durata:6.2f}s  ({durata:.2f}s)")
        t += durata + seg["pausa_dopo"]

    durata_totale = t + piano["coda"]
    voce = np.zeros(int(durata_totale * SR_USCITA) + 1, dtype=np.float32)
    for inizio, audio in tracce:
        i = int(round(inizio * SR_USCITA))
        voce[i : i + len(audio)] += audio[: len(voce) - i]
    sf.write(BUILD / "voce.wav", voce, SR_USCITA, subtype="FLOAT")

    timeline = {"durata": round(durata_totale, 3), "segmenti": segmenti}
    (BUILD / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")

    scrivi_srt(segmenti)
    print(f"Durata totale: {durata_totale:.2f}s")


def scrivi_srt(segmenti):
    cue = [c for s in segmenti for c in s["cue"]]
    righe = []
    for n, c in enumerate(cue, 1):
        fine = c["t1"] + 0.35
        if n < len(cue):
            fine = min(fine, cue[n]["t0"] - 0.08)  # il sottotitolo successivo parte 0,05 s prima della voce
        righe.append(f"{n}\n{ora_srt(c['t0'] - 0.05)} --> {ora_srt(fine)}\n{a_capo(c['testo'])}\n")
    (BUILD / "sottotitoli.srt").write_text("\n".join(righe), encoding="utf-8")


if __name__ == "__main__":
    main()
