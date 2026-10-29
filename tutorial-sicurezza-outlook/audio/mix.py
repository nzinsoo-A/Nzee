"""Mixa voce, musica ed effetti nella colonna sonora finale.

Legge build/voce.wav, build/musica.wav e build/effetti.json (istanti dei clic e
delle notifiche, scritti da video/render.mjs) e scrive build/audio.wav.
La musica si abbassa da sola quando parla la voce («ducking»).
"""

import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, Pedalboard, PeakFilter

RADICE = Path(__file__).resolve().parent.parent
BUILD = RADICE / "build"
SR = 48000
rng = np.random.default_rng(3)
db = lambda g: 10 ** (g / 20)

MUSICA_DB = -1.0  # livello della musica quando la voce tace
ABBASSAMENTO_DB = -11.0  # quanto scende la musica mentre la voce parla
VOCE_DB = 0.0
STILE = "computer"


def clic_mouse():
    """Clic di un mouse: pressione e rilascio, due piccoli transitori brillanti."""
    def colpo(livello, tono):
        t = np.arange(int(0.03 * SR)) / SR
        rumore = rng.normal(0, 1, len(t))
        rumore = rumore - np.convolve(rumore, np.ones(8) / 8, mode="same")
        return livello * (0.6 * rumore * np.exp(-t / 0.0028) + 0.5 * np.sin(2 * np.pi * tono * t) * np.exp(-t / 0.004))
    suono = np.zeros(int(0.12 * SR))
    p = colpo(db(-21), 3200)
    r = colpo(db(-28), 3900)
    suono[: len(p)] += p
    i = int(0.075 * SR)
    suono[i : i + len(r)] += r
    return suono


def tocco():
    """Tocco sullo schermo del telefono: un «tic» morbido, più discreto del clic del mouse."""
    t = np.arange(int(0.05 * SR)) / SR
    rumore = rng.normal(0, 1, len(t))
    rumore = rumore - np.convolve(rumore, np.ones(10) / 10, mode="same")
    return db(-25) * (0.5 * rumore * np.exp(-t / 0.003) + 0.6 * np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.006))


def tasto_tastiera():
    """Il «tic» della tastiera di iOS, un po' diverso a ogni tasto."""
    t = np.arange(int(0.03 * SR)) / SR
    rumore = rng.normal(0, 1, len(t))
    rumore = rumore - np.convolve(rumore, np.ones(5) / 5, mode="same")
    tono = rng.uniform(2600, 3400)
    return db(rng.uniform(-33, -30)) * (0.7 * rumore * np.exp(-t / 0.0018) + 0.35 * np.sin(2 * np.pi * tono * t) * np.exp(-t / 0.0035))


def campanella():
    """«Ding» di notifica a due note (Do e Sol, nella tonalità della musica)."""
    t = np.arange(int(1.2 * SR)) / SR
    suono = np.zeros(len(t))
    for ritardo, f in ((0, 1046.5), (0.11, 1568.0)):
        tt = np.clip(t - ritardo, 0, None)
        nota = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.08)) * np.exp(-tt / 0.35)
        suono += np.where(t >= ritardo, nota, 0) * np.clip(tt / 0.002, 0, 1)
    return suono * db(-27)


def inviluppo_voce(voce):
    """1 dove parla la voce, 0 dove tace; le pause brevi non fanno risalire la musica."""
    finestra = int(0.02 * SR)
    energia = np.sqrt(np.convolve(voce ** 2, np.ones(finestra) / finestra, mode="same"))
    attiva = energia > db(-45)
    # tiene «attiva» la voce anche nelle pause più brevi di 0,9 s
    tenuta = int(0.9 * SR)
    indici = np.flatnonzero(attiva)
    pieno = np.zeros(len(voce), dtype=bool)
    if len(indici):
        salti = np.flatnonzero(np.diff(indici) > tenuta)
        inizi = np.concatenate([[indici[0]], indici[salti + 1]])
        fini = np.concatenate([indici[salti], [indici[-1]]])
        for a, b in zip(inizi, fini):
            pieno[max(0, a - int(0.25 * SR)) : b + int(0.2 * SR)] = True  # anticipa un poco la discesa
    # ammorbidisce (a blocchi di 10 ms): discesa in ~0,25 s, risalita in ~0,7 s
    passo = SR // 100
    blocchi = pieno[: len(pieno) // passo * passo].reshape(-1, passo).mean(axis=1)
    env = np.zeros(len(blocchi))
    su, giu = np.exp(-1 / 25), np.exp(-1 / 70)
    v = 0.0
    for i, x in enumerate(blocchi):
        c = su if x > v else giu
        v = c * v + (1 - c) * x
        env[i] = v
    return np.interp(np.arange(len(voce)), np.arange(len(env)) * passo + passo / 2, env)


def main():
    voce, sr_v = sf.read(BUILD / "voce.wav", dtype="float32")
    musica, sr_m = sf.read(BUILD / "musica.wav", dtype="float32")
    assert sr_v == sr_m == SR
    effetti = json.loads((BUILD / "effetti.json").read_text())
    n = max(len(voce), len(musica))
    voce = np.pad(voce, (0, n - len(voce)))
    musica = np.pad(musica, ((0, n - len(musica)), (0, 0)))

    # voce: pulizia dei bassi, un filo di presenza e compressione leggera
    catena_voce = Pedalboard([HighpassFilter(80), PeakFilter(3200, 1.5, 0.9), Compressor(threshold_db=-22, ratio=2.5, attack_ms=6, release_ms=90)])
    voce = catena_voce(voce[None, :], SR)[0] * db(VOCE_DB)
    # normalizza la voce a un picco di -3 dBFS (il volume finale lo fissa poi loudnorm)
    voce *= db(-3) / np.abs(voce).max()

    env = inviluppo_voce(voce)
    guadagno = db(MUSICA_DB) * (1 - env * (1 - db(ABBASSAMENTO_DB)))
    musica = musica * guadagno[:, None]

    sfx = np.zeros(n)
    telefono = STILE == "telefono"
    for t in effetti["clic"]:
        s = tocco() if telefono else clic_mouse()
        i = int(t * SR)
        sfx[i : i + len(s)] += s[: max(0, n - i)]
    for t in effetti.get("tasti", []) if telefono else []:
        s = tasto_tastiera()
        i = int(t * SR)
        sfx[i : i + len(s)] += s[: max(0, n - i)]
    for t in effetti.get("notifiche", []):
        s = campanella()
        i = int(t * SR)
        sfx[i : i + len(s)] += s[: max(0, n - i)]

    mix = musica + (voce + sfx)[:, None]
    picco = np.abs(mix).max()
    if picco > db(-1):
        mix *= db(-1) / picco
    sf.write(BUILD / "audio.wav", mix, SR, subtype="FLOAT")
    print(f"audio: {n / SR:.2f}s, {len(effetti['clic'])} clic, {len(effetti.get('notifiche', []))} notifiche, picco {20 * np.log10(np.abs(mix).max()):.1f} dBFS")
    normalizza(BUILD / "audio.wav", BUILD / "audio_finale.wav")


def normalizza(ingresso, uscita, lufs=-16.0, picco=-1.5):
    """Loudness standard per il web in due passate (ffmpeg loudnorm)."""
    filtro = f"loudnorm=I={lufs}:TP={picco}:LRA=11"
    misura = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(ingresso), "-af", filtro + ":print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    m = json.loads(misura[misura.rindex("{") : misura.rindex("}") + 1])
    filtro += (
        f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
        f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(ingresso), "-af", filtro, "-ar", str(SR), "-c:a", "pcm_s24le", str(uscita)],
        check=True,
    )
    print(f"normalizzato a {lufs} LUFS → {uscita.name}")


if __name__ == "__main__":
    import argparse

    argomenti = argparse.ArgumentParser()
    argomenti.add_argument("--build", default=str(BUILD), help="cartella con voce.wav, musica.wav ed effetti.json")
    argomenti.add_argument("--stile", choices=["computer", "telefono"], default="computer", help="suoni di clic e tastiera")
    args = argomenti.parse_args()
    BUILD, STILE = Path(args.build), args.stile
    main()
