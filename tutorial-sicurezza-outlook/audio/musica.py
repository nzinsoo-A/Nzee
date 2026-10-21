"""Compone e sintetizza una base lo-fi originale per il video (nessun campione esterno).

Accordi Fmaj9 – Em11 – Dm9 – Cmaj9 a 80 BPM, con piano elettrico (sintesi FM),
basso, batteria morbida «swingata», fruscio da vinile e un piccolo motivo di
kalimba in apertura e in chiusura. La durata segue build/timeline.json.

Scrive build/musica.wav (48 kHz, stereo).
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Chorus, Compressor, HighpassFilter, LowpassFilter, Pedalboard, Reverb

RADICE = Path(__file__).resolve().parent.parent
BUILD = RADICE / "build"
SR = 48000
BPM = 80
BATTITO = 60 / BPM
BATTUTA = 4 * BATTITO
SWING = 0.57  # 0.5 = dritto; più alto = sedicesimi in levare più «pigri»
rng = np.random.default_rng(7)

# accordi: (basso MIDI, voci della mano destra MIDI)
ACCORDI = [
    (41, [57, 60, 64, 67]),  # Fmaj9  (A C E G)
    (40, [57, 59, 62, 67]),  # Em11   (A B D G)
    (38, [57, 60, 64, 65]),  # Dm9    (A C E F)
    (36, [55, 59, 62, 64]),  # Cmaj9  (G B D E)
]


def hz(nota):
    return 440.0 * 2 ** ((nota - 69) / 12)


def tempo_passo(battuta, passo):
    """Istante (s) di un sedicesimo nella battuta, con lo swing sui sedicesimi in levare."""
    coppia, dispari = divmod(passo, 2)
    sedicesimo = BATTITO / 4
    return battuta * BATTUTA + coppia * 2 * sedicesimo + (2 * SWING * sedicesimo if dispari else 0)


def aggiungi(traccia, t, suono, guadagno=1.0):
    i = int(round(t * SR))
    if i >= traccia.shape[-1]:
        return
    n = min(suono.shape[-1], traccia.shape[-1] - i)
    traccia[..., i : i + n] += guadagno * suono[..., :n]


# ---------- Strumenti ----------

def piano_elettrico(nota, durata, vel):
    """Rhodes semplificato: FM a rapporto 1 più un «tine» metallico all'attacco, con tremolo stereo."""
    coda = 0.6
    t = np.arange(int((durata + coda) * SR)) / SR
    f = hz(nota) * (1 + 0.0022 * np.sin(2 * np.pi * 0.45 * t))  # leggero «wow» da nastro
    fase = 2 * np.pi * np.cumsum(f) / SR
    indice = (0.9 + 1.4 * vel) * np.exp(-t / 0.35)
    corpo = np.sin(fase + indice * np.sin(fase))
    tine = 0.18 * vel * np.exp(-t / 0.04) * np.sin(14 * fase + 0.8 * np.sin(fase))
    decadimento = np.exp(-t / (1.6 if nota < 60 else 1.1))
    attacco = np.clip(t / 0.006, 0, 1)
    rilascio = np.clip((durata + coda - t) / coda, 0, 1) ** 2 * np.where(t < durata, 1, np.exp(-(t - durata) / 0.12))
    mono = (corpo + tine) * decadimento * attacco * rilascio * (0.35 + 0.65 * vel)
    trem = 0.12 * np.sin(2 * np.pi * 4.6 * t)
    return np.stack([mono * (1 + trem), mono * (1 - trem)])


def basso(nota, durata, vel):
    t = np.arange(int((durata + 0.15) * SR)) / SR
    f = hz(nota)
    onda = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t) + 0.06 * np.sin(6 * np.pi * f * t)
    env = np.clip(t / 0.012, 0, 1) * (0.75 + 0.25 * np.exp(-t / 0.18)) * np.where(t < durata, 1, np.exp(-(t - durata) / 0.05))
    mono = np.tanh(1.4 * onda * env) * vel
    return np.stack([mono, mono])


def cassa(vel):
    t = np.arange(int(0.5 * SR)) / SR
    f = 48 + 72 * np.exp(-t / 0.035)
    corpo = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.26)
    click = rng.normal(0, 1, len(t)) * np.exp(-t / 0.0025) * 0.25
    mono = np.tanh(1.6 * (corpo + click)) * vel
    return np.stack([mono, mono])


def rullante(vel):
    t = np.arange(int(0.45 * SR)) / SR
    rumore = rng.normal(0, 1, len(t))
    rumore = np.convolve(rumore, np.ones(3) / 3, mode="same")  # un po' più scuro
    corpo = 0.6 * np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.045)
    mono = (0.55 * rumore * np.exp(-t / 0.11) + corpo) * vel
    return np.stack([mono * 0.95, mono])


def charleston(vel, aperto=False):
    t = np.arange(int((0.35 if aperto else 0.09) * SR)) / SR
    rumore = rng.normal(0, 1, len(t))
    rumore = rumore - np.convolve(rumore, np.ones(6) / 6, mode="same")  # passa-alto grezzo
    mono = rumore * np.exp(-t / (0.12 if aperto else 0.022)) * vel
    return np.stack([mono * 0.8, mono])


def kalimba(nota, vel):
    t = np.arange(int(2.2 * SR)) / SR
    f = hz(nota)
    mono = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.55)
    mono *= np.clip(t / 0.003, 0, 1) * vel
    return np.stack([mono * 0.9, mono])


def vinile(durata):
    n = int(durata * SR)
    fruscio = rng.normal(0, 1, n)
    fruscio = np.convolve(fruscio, np.ones(24) / 24, mode="same") * 0.010
    crepitii = np.zeros(n)
    posizioni = rng.integers(0, n, int(durata * 9))
    crepitii[posizioni] = rng.normal(0, 1, len(posizioni)) * rng.uniform(0.2, 1, len(posizioni))
    crepitii = np.convolve(crepitii, np.exp(-np.arange(40) / 6), mode="same") * 0.05
    return np.stack([fruscio + crepitii, fruscio * 0.9 + np.roll(crepitii, 37)])


# ---------- Arrangiamento ----------

def componi(durata):
    battute_totali = int(np.ceil(durata / BATTUTA)) + 1
    lunghezza = int((durata + 1) * SR)
    ep, bs, bat, kal = (np.zeros((2, lunghezza)) for _ in range(4))
    # l'ultimo accordo cade su una battuta e suona fino alla fine
    battuta_finale = int((durata - 3.2) // BATTUTA)
    for b in range(battute_totali):
        if b > battuta_finale:
            break
        radice, voci = ACCORDI[b % 4]
        finale = b == battuta_finale
        intro = b < 2
        # piano elettrico: accordo sul primo tempo e una «spinta» sul levare del secondo tempo
        colpi = [(0, 1.9 * BATTITO, 0.8)] if finale or intro else [(0, 1.55 * BATTITO, 0.78), (tempo_passo(0, 7), 1.3 * BATTITO, 0.62)]
        for inizio, dur, vel in colpi:
            if finale:
                dur = durata - b * BATTUTA - 0.3
            for k, nota in enumerate(voci):
                strum = 0.018 * k + rng.uniform(0, 0.008)
                v = vel * rng.uniform(0.85, 1.0)
                aggiungi(ep, b * BATTUTA + inizio + strum, piano_elettrico(nota, dur, v), 0.16)
            aggiungi(ep, b * BATTUTA + inizio, piano_elettrico(radice + 12, dur, vel * 0.7), 0.12)
        if intro or finale:
            continue
        # basso: fondamentale sul primo tempo, ripresa sul levare del terzo, nota di passaggio a fine giro
        aggiungi(bs, b * BATTUTA, basso(radice, 1.4 * BATTITO, 0.9), 0.32)
        aggiungi(bs, tempo_passo(b, 10), basso(radice + (7 if b % 2 else 0), 0.9 * BATTITO, 0.75), 0.32)
        if b % 4 == 3:
            aggiungi(bs, tempo_passo(b, 14), basso(radice + 2, 0.4 * BATTITO, 0.6), 0.3)
        # batteria
        pausa = (b - 2) % 8 == 7  # ogni otto battute un piccolo stacco
        for passo in (0, 10) + ((7,) if b % 4 == 1 else ()):
            if not (pausa and passo == 10):
                aggiungi(bat, tempo_passo(b, passo) + 0.004, cassa(0.9 if passo == 0 else 0.7), 0.5)
        for passo in (4, 12):
            aggiungi(bat, tempo_passo(b, passo) + 0.012, rullante(0.8 * rng.uniform(0.9, 1.0)), 0.22)
        # charleston in ottavi, con qualche sedicesimo «fantasma» in levare (è lì che si sente lo swing)
        for passo in list(range(0, 16, 2)) + ([7, 15] if b % 2 else [15]):
            if pausa and passo >= 12:
                continue
            aperto = passo == 14 and b % 2 == 1
            vel = (0.55 if passo % 4 == 0 else 0.4 if passo % 2 == 0 else 0.22) * rng.uniform(0.8, 1.0)
            aggiungi(bat, tempo_passo(b, passo), charleston(vel, aperto), 0.10)
        if pausa:
            for k, passo in enumerate((12, 13, 14, 15)):
                aggiungi(bat, tempo_passo(b, passo) + 0.01, rullante(0.35 + 0.1 * k), 0.16)
    # motivo di kalimba (pentatonica di Do) in apertura e sull'accordo finale
    motivo = [(0, 76), (0.5, 79), (1.0, 81), (1.75, 79), (2.5, 76), (3.0, 74), (4.0, 72), (4.75, 74), (5.5, 76)]
    for battiti, nota in motivo:
        aggiungi(kal, battiti * BATTITO + 0.02, kalimba(nota, 0.6), 0.07)
    for battiti, nota in [(0, 84), (0.75, 81), (1.5, 79), (2.5, 76)]:
        aggiungi(kal, battuta_finale * BATTUTA + battiti * BATTITO + 0.03, kalimba(nota, 0.55), 0.06)
    return ep, bs, bat, kal


def main():
    durata = json.loads((BUILD / "timeline.json").read_text())["durata"]
    ep, bs, bat, kal = componi(durata)
    effetti_ep = Pedalboard([HighpassFilter(90), LowpassFilter(3800), Chorus(rate_hz=0.6, depth=0.15, mix=0.25), Reverb(room_size=0.55, damping=0.55, wet_level=0.24, dry_level=0.85, width=0.95)])
    effetti_basso = Pedalboard([LowpassFilter(520)])
    effetti_bat = Pedalboard([HighpassFilter(35), LowpassFilter(7200), Compressor(threshold_db=-18, ratio=3, attack_ms=8, release_ms=120), Reverb(room_size=0.25, wet_level=0.08, dry_level=0.95)])
    effetti_kal = Pedalboard([Reverb(room_size=0.7, damping=0.4, wet_level=0.35, dry_level=0.8)])
    f32 = lambda x: x.astype(np.float32)
    db = lambda g: 10 ** (g / 20)
    # bilanciamento: piano elettrico in primo piano, batteria e basso appena sotto, vinile appena percepibile
    mix = (
        db(-7.3) * effetti_ep(f32(ep), SR)
        + db(-10.2) * effetti_basso(f32(bs), SR)
        + db(-8.1) * effetti_bat(f32(bat), SR)
        + effetti_kal(f32(kal), SR)
        + Pedalboard([HighpassFilter(200)])(f32(vinile(ep.shape[-1] / SR)), SR)
    )
    master = Pedalboard([HighpassFilter(35), LowpassFilter(10500), Compressor(threshold_db=-24, ratio=2, attack_ms=20, release_ms=200)])
    mix = master(mix.astype(np.float32), SR)
    mix *= min(1.0, db(-6) / np.abs(mix).max())  # margine: picchi al massimo a -6 dBFS
    n = int(durata * SR)
    mix = mix[:, :n]
    dissolvenza = np.ones(n)
    dissolvenza[: int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR))
    dissolvenza[-int(2.0 * SR) :] *= np.linspace(1, 0, int(2.0 * SR)) ** 1.5
    mix *= dissolvenza
    sf.write(BUILD / "musica.wav", mix.T, SR, subtype="FLOAT")
    print(f"musica: {durata:.2f}s, picco {20 * np.log10(np.abs(mix).max() + 1e-9):.1f} dBFS")


if __name__ == "__main__":
    main()
