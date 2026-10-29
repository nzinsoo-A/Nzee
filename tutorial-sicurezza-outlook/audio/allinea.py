"""Allinea due letture dello stesso testo con il DTW sulle MFCC.

Serve a ricavare i tempi delle parole per le voci che non li forniscono
(Supertonic): si sintetizza lo stesso testo con Kokoro, che i tempi li dà,
e li si trasferisce sulla lettura di Supertonic seguendo il percorso DTW.
"""

import numpy as np
from scipy.fft import dct
from scipy.signal import resample_poly

SR = 16000
PASSO = 160  # 10 ms
FINESTRA = 400  # 25 ms


def _filtri_mel(n_mel=40, n_fft=512):
    mel = lambda f: 2595 * np.log10(1 + f / 700)
    inv = lambda m: 700 * (10 ** (m / 2595) - 1)
    punti = inv(np.linspace(mel(60), mel(7600), n_mel + 2))
    bin_ = np.floor((n_fft + 1) * punti / SR).astype(int)
    filtri = np.zeros((n_mel, n_fft // 2 + 1))
    for i in range(1, n_mel + 1):
        a, b, c = bin_[i - 1], bin_[i], bin_[i + 1]
        filtri[i - 1, a:b] = (np.arange(a, b) - a) / max(b - a, 1)
        filtri[i - 1, b:c] = (c - np.arange(b, c)) / max(c - b, 1)
    return filtri


FILTRI = _filtri_mel()


def caratteristiche(audio, sr):
    """MFCC (13) + delta, normalizzate per media e varianza, una riga ogni 10 ms."""
    if sr != SR:
        g = np.gcd(int(sr), SR)
        audio = resample_poly(audio, SR // g, int(sr) // g)
    audio = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])
    n = 1 + max(0, (len(audio) - FINESTRA) // PASSO)
    idx = np.arange(FINESTRA)[None, :] + PASSO * np.arange(n)[:, None]
    trame = audio[np.minimum(idx, len(audio) - 1)] * np.hamming(FINESTRA)
    spettro = np.abs(np.fft.rfft(trame, 512)) ** 2
    logmel = np.log(spettro @ FILTRI.T + 1e-8)
    mfcc = dct(logmel, type=2, axis=1, norm="ortho")[:, 1:14]
    energia = logmel.mean(axis=1, keepdims=True)
    delta = np.gradient(mfcc, axis=0)
    x = np.hstack([mfcc, delta, energia])
    return (x - x.mean(axis=0)) / (x.std(axis=0) + 1e-6)


def dtw(a, b, banda=0.25):
    """Percorso DTW (coppie di indici) tra le sequenze a e b, con una banda di Sakoe-Chiba."""
    n, m = len(a), len(b)
    costo = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(axis=2))
    larg = int(max(n, m) * banda) + abs(n - m)
    acc = np.full((n + 1, m + 1), np.inf)
    acc[0, 0] = 0
    for i in range(1, n + 1):
        centro = int(i * m / n)
        j0, j1 = max(1, centro - larg), min(m, centro + larg)
        for j in range(j0, j1 + 1):
            acc[i, j] = costo[i - 1, j - 1] + min(acc[i - 1, j], acc[i, j - 1], acc[i - 1, j - 1])
    i, j, percorso = n, m, []
    while i > 0 and j > 0:
        percorso.append((i - 1, j - 1))
        passi = [(acc[i - 1, j - 1], i - 1, j - 1), (acc[i - 1, j], i - 1, j), (acc[i, j - 1], i, j - 1)]
        _, i, j = min(passi)
    return np.array(percorso[::-1])


def mappa_tempi(audio_rif, sr_rif, audio_dest, sr_dest, tempi):
    """Converte istanti (s) della lettura di riferimento in istanti della lettura di destinazione."""
    a, b = caratteristiche(audio_rif, sr_rif), caratteristiche(audio_dest, sr_dest)
    percorso = dtw(a, b)
    # per ogni trama di riferimento, la media delle trame di destinazione a cui è allineata
    somme = np.zeros(len(a))
    conti = np.zeros(len(a))
    np.add.at(somme, percorso[:, 0], percorso[:, 1])
    np.add.at(conti, percorso[:, 0], 1)
    dest = somme / np.maximum(conti, 1)
    t_rif = np.arange(len(a)) * PASSO / SR
    t_dest = dest * PASSO / SR
    return [float(np.interp(t, t_rif, t_dest)) for t in tempi]
