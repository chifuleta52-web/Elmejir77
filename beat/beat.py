"""Beat de trap oscuro / melancolico (piano + cuerdas + 808), 140 BPM, Re menor.
Todo sintetizado desde cero con numpy. Uso: python3 beat.py"""
import numpy as np, wave

SR = 44100
BPM = 140
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4
TOTAL_BARS = 72
N = int((TOTAL_BARS * BAR + 5) * SR)
rng = np.random.default_rng(7)

NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def hz(name):
    p = NOTES[name[0]]; rest = name[1:]
    if rest[0] == '#': p += 1; rest = rest[1:]
    elif rest[0] == 'b': p -= 1; rest = rest[1:]
    return 440 * 2 ** ((p + 12 * (int(rest) + 1) - 69) / 12)

def bus(): return np.zeros((N, 2))
def add(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[:N - i]
    a = (pan + 1) * np.pi / 4
    buf[i:i + len(sig), 0] += sig * gain * np.cos(a) * 1.414
    buf[i:i + len(sig), 1] += sig * gain * np.sin(a) * 1.414

def filt(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = np.ones_like(f)
    if hi: H /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: H *= 1 - 1 / np.sqrt(1 + (f / lo) ** (2 * order))
    if x.ndim == 2: H = H[:, None]
    return np.fft.irfft(X * H, len(x), axis=0)

def tt(d): return np.arange(int(d * SR)) / SR
def fade(x, a=0.003, r=0.02):
    na, nr = int(a * SR), int(r * SR)
    x[:na] *= np.linspace(0, 1, na); x[-nr:] *= np.linspace(1, 0, nr)
    return x

# ---------- instrumentos ----------
_pc = {}
def piano(f, dur=2.6):
    k = (round(f, 2), dur)
    if k not in _pc:
        t = tt(dur); y = np.zeros_like(t)
        for det in (0.9993, 1.0007):
            for n in range(1, 13):
                fn = n * f * det * np.sqrt(1 + 0.0004 * n * n)
                if fn > 9000: break
                dec = (0.9 + 0.45 * n) * (f / 220) ** 0.35
                y += np.sin(2 * np.pi * fn * t + n) / n ** 1.25 * np.exp(-t * dec)
        y += filt(rng.standard_normal(len(t)), 800, 5000) * np.exp(-t / 0.012) * 0.25
        _pc[k] = fade(y * 0.25, 0.004, 0.25)
    return _pc[k]

def strings(f, dur, seed):
    r = np.random.default_rng(seed)
    t = tt(dur + 0.6); y = np.zeros_like(t)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t + r.uniform(0, 6))
    for det in (-7, 0, 6):
        fd = f * 2 ** ((det + r.uniform(-2, 2)) / 1200)
        ph = 2 * np.pi * np.cumsum(fd * vib) / SR
        for n in range(1, 40):
            if n * fd > 6000: break
            y += np.sin(n * ph + r.uniform(0, 6)) / n / (1 + (n * fd / 2200) ** 2)
    env = np.minimum(1, t / 0.3) * np.minimum(1, (t[-1] - t) / 0.6)
    return y * env * 0.12

def s808(f, dur):
    t = tt(dur)
    fr = f * (1 + 1.6 * np.exp(-t / 0.018))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.9)
    return fade(np.tanh(y * 2.8) * 0.8, 0.002, 0.03)

def kick():
    t = tt(0.3)
    y = np.sin(2 * np.pi * np.cumsum(45 + 130 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.11)
    y[:90] += rng.standard_normal(90) * np.linspace(0.5, 0, 90)
    return fade(y, 0.0005, 0.02)

def snare():
    t = tt(0.35); n = rng.standard_normal(len(t))
    body = filt(n, 180, 9000) * np.exp(-t / 0.09) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.6
    clap = np.zeros_like(t)
    cn = filt(rng.standard_normal(len(t)), 900, 4500)
    for d in (0, 0.011, 0.022):
        i = int(d * SR); clap[i:] += cn[:len(t) - i] * np.exp(-t[:len(t) - i] / (0.012 if d < 0.02 else 0.13))
    return fade(body + clap * 0.9, 0.0005, 0.03)

def hat(open_=False):
    t = tt(0.4 if open_ else 0.08)
    return fade(filt(rng.standard_normal(len(t)), 7500, None, 3) * np.exp(-t / (0.14 if open_ else 0.022)), 0.0005, 0.01)

def bell(f, dur=2.2):
    t = tt(dur)
    y = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t / 0.35) * np.sin(2 * np.pi * 3.5 * f * t))
    return fade(y * np.exp(-t / 0.8) * 0.3, 0.002, 0.1)

def riser(dur):
    t = tt(dur)
    return fade(filt(rng.standard_normal(len(t)), 2500) * (t / dur) ** 3 * 0.5, 0.01, 0.01)

def impact():
    t = tt(2.5)
    return fade(np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t / 0.1)) / SR) * np.exp(-t / 0.5)
                + filt(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.7) * 0.35, 0.001, 0.1)

# ---------- composicion ----------
CH = [  # bajo piano, arpegio (corcheas), acorde cuerdas, 808
    ('D2', ['D4','F4','A4','F4','D5','A4','F4','A4'], ['D3','A3','F4'], 'D2'),
    ('Bb1', ['D4','F4','Bb4','F4','D5','Bb4','F4','Bb4'], ['Bb2','F3','D4'], 'Bb1'),
    ('G1', ['D4','G4','Bb4','G4','D5','Bb4','G4','Bb4'], ['G2','D3','Bb3'], 'G1'),
    ('A1', ['C#4','E4','A4','E4','C#5','A4','E5','C#5'], ['A2','E3','C#4'], 'A1'),
]
TOP = ['A5', 'Bb5', 'G5', 'E5']                       # linea aguda de cuerdas
LEAD = [                                              # campana del coro: (paso, nota) por compas
    [[(0,'A5'),(6,'G5'),(8,'F5'),(12,'D5')], [(0,'F5'),(8,'D5'),(12,'F5')],
     [(0,'G5'),(6,'F5'),(8,'D5'),(12,'Bb4')], [(0,'E5'),(8,'C#5'),(12,'E5'),(14,'A5')]],
    [[(0,'D6'),(6,'C6'),(8,'A5'),(12,'F5')], [(0,'Bb5'),(8,'A5'),(12,'F5')],
     [(0,'G5'),(4,'A5'),(8,'Bb5'),(12,'D6')], [(0,'C#6'),(8,'A5'),(12,'E5')]],
]
KICKS = [[0, 6, 10], [0, 3, 10], [0, 6, 10, 13], [0, 7, 10, 14]]

def section(b):
    if b < 8: return 'intro'
    if b < 24: return 'verse'
    if b < 32: return 'hook'
    if b < 48: return 'verse'
    if b < 56: return 'hook'
    if b < 60: return 'bridge'
    if b < 68: return 'hook'
    return 'outro'

P_in, P, S, D, B8, FX, BL = (bus() for _ in range(7))
hits808 = []
for b in range(TOTAL_BARS):
    t0 = b * BAR; sec = section(b); c = CH[b % 4]
    last_before_hook = b in (23, 47, 59)
    # piano
    pb = P_in if sec == 'intro' else P
    if b == 71:
        for n in ['D2', 'D3', 'A3', 'D4', 'F4', 'A4']: add(pb, piano(hz(n), 5), t0, 0.9)
    else:
        add(pb, piano(hz(c[0])), t0, 0.9); add(pb, piano(hz(c[0]) * 2), t0, 0.6)
        for i, n in enumerate(c[1]):
            vel = (0.95 if i % 4 == 0 else 0.6) + rng.uniform(-0.08, 0.08)
            if sec == 'outro' and i > 4: continue
            add(pb, piano(hz(n)), t0 + i * 2 * STEP + rng.uniform(0, 0.006), vel, pan=(i % 3 - 1) * 0.25)
    # cuerdas
    sg = {'intro': 0.5 if b >= 4 else 0, 'verse': 0.35 if (b - 8) % 16 >= 8 else 0,
          'hook': 1.0, 'bridge': 0.7, 'outro': 0.5}[sec]
    if sg and b != 71:
        for j, n in enumerate(c[2] + ([TOP[b % 4]] if sec in ('hook', 'bridge') else [])):
            for ch, pan in ((0, -0.7), (1, 0.7)):
                add(S, strings(hz(n), BAR, b * 31 + j * 7 + ch), t0, sg * (0.7 if j == 3 else 1), pan)
    # campana
    if sec in ('hook', 'bridge'):
        for s, n in LEAD[(b // 4) % 2][b % 4]:
            add(BL, bell(hz(n)), t0 + s * STEP, 0.8 if sec == 'hook' else 0.55, pan=0.15)
    # bateria
    if sec in ('verse', 'hook'):
        mute_low = b == 39
        ks = KICKS[(b + (b // 8)) % 4]
        if last_before_hook: ks = [k for k in ks if k < 8]
        for k in ks:
            if not mute_low:
                add(D, kick(), t0 + k * STEP, 0.95)
                hits808.append((t0 + k * STEP, hz(c[3]) * (2 if (k == 13 or k == 14) else 1)))
        if not last_before_hook:
            add(D, snare(), t0 + 8 * STEP, 0.8)
            if b % 4 == 3: add(D, snare(), t0 + 15 * STEP, 0.4)
        else:  # redoble hacia el coro
            for i in range(8): add(D, snare(), t0 + (8 + i) * STEP * 0.5 + 4 * STEP * (i >= 0), 0.25 + 0.06 * i)
        # hi-hats con rolls
        roll = rng.choice([None, 6, 12, 14], p=[0.3, 0.2, 0.3, 0.2]) if sec == 'hook' or b % 2 else None
        for s in range(0, 16, 2 if sec == 'verse' and (b - 8) % 16 < 8 else 1):
            if roll is not None and s in (roll, roll + 1): continue
            if last_before_hook and s >= 8: continue
            v = (0.55 if s % 4 == 0 else 0.38 if s % 2 == 0 else 0.22) + rng.uniform(-0.04, 0.04)
            add(D, hat(), t0 + s * STEP, v, pan=0.25)
        if roll is not None:
            n = int(rng.choice([3, 4, 6]))
            for i in range(n): add(D, hat(), t0 + (roll + 2 * i / n) * STEP, 0.2 + 0.3 * i / n, pan=0.25)
        if b % 2 == 1 and not last_before_hook: add(D, hat(True), t0 + 14 * STEP, 0.3, pan=-0.2)
    if last_before_hook: add(FX, riser(BAR), t0, 0.6)
    if b in (24, 48, 60): add(FX, impact(), t0, 0.8)
    if b == 8: add(FX, impact(), t0, 0.5)

hits808.sort()
for i, (t, f) in enumerate(hits808):
    nxt = hits808[i + 1][0] if i + 1 < len(hits808) else t + BAR
    add(B8, s808(f, min(nxt - t, BAR * 0.9)), t, 0.85)

# vinilo
cr = np.zeros(N); idx = rng.integers(0, N, N // 2500); cr[idx] = rng.uniform(-1, 1, len(idx))
cr = filt(cr, 1500, 7000) * 0.5 + filt(rng.standard_normal(N), 300, 3000) * 0.004
tb = np.arange(N) / SR / BAR
crg = np.where((tb < 8) | ((tb >= 56) & (tb < 60)) | (tb >= 68), 1.0, 0.3)
vinyl = np.stack([cr * crg, np.roll(cr, 977) * crg], 1) * 0.25

# reverb (convolucion con ruido decreciente)
def reverb(x, decay=2.2, seed=1):
    r = np.random.default_rng(seed); t = tt(decay * 1.6)
    ir = filt(r.standard_normal((len(t), 2)), 250, 5500) * np.exp(-t / (decay / 4))[:, None]
    ir /= np.sqrt((ir ** 2).sum(0)); n = len(x) + len(ir)
    return np.fft.irfft(np.fft.rfft(x, n, axis=0) * np.fft.rfft(ir, n, axis=0), n, axis=0)[:len(x)]

P_in = filt(P_in, 250, 1400)                           # intro "filtrada"
mel = P * 0.9 + P_in * 1.3 + S * 0.55 + BL * 0.5
mix = mel + reverb(P * 0.25 + P_in * 0.5 + S * 0.35 + BL * 0.45 + D * 0.04 + FX * 0.3) * 0.9
mix = filt(mix, 110)                                   # espacio para el 808
mix += D * 0.8 + B8 * 0.55 + FX * 0.5 + vinyl
mix = np.tanh(mix * 1.05)
end = int((TOTAL_BARS * BAR + 4.5) * SR); mix = mix[:end]
mix[-SR * 2:] *= np.linspace(1, 0, SR * 2)[:, None]
mix *= 0.97 / np.abs(mix).max()
with wave.open('trap_oscuro_140bpm_Dm.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', len(mix) / SR, 's')
