"""Generate Robot Arm Lab's sound effects (original, synthesized; no third-party audio).

Run: python3 tools/make_sounds.py   -> writes public/audio/*.wav
Soft sine tones with short attack and exponential decay; 22.05 kHz, 16-bit mono.
"""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"


def tone(freq, dur, vol=0.5, decay=6.0, harmonic=0.15, attack=0.008):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / attack) * math.exp(-decay * t)
        s = math.sin(2 * math.pi * freq * t) + harmonic * math.sin(4 * math.pi * freq * t)
        out.append(vol * env * s / (1 + harmonic))
    return out


def seq(notes, gap):
    """notes: list of (freq, dur, vol); each starts `gap` seconds after the previous."""
    total = int(RATE * (gap * (len(notes) - 1) + max(d for _, d, _ in notes))) + 1
    buf = [0.0] * total
    for k, (f, d, v) in enumerate(notes):
        start = int(RATE * gap * k)
        for i, s in enumerate(tone(f, d, v)):
            buf[start + i] += s
    return buf


def write(name, samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = min(1.0, 0.9 / peak)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(32767 * s * scale)) for s in samples))


# Grab: short, soft pop.
write("grab.wav", tone(740, 0.09, vol=0.45, decay=40, harmonic=0.3))
# Correct: cheerful rising chime C6-E6-G6.
write("correct.wav", seq([(1047, 0.25, 0.5), (1319, 0.25, 0.5), (1568, 0.4, 0.55)], gap=0.07))
# Wrong: gentle falling "boo-boop", low and quiet (a soft "try again", not a buzzer).
write("wrong.wav", [0.6 * s for s in seq([(392, 0.18, 0.5), (311, 0.28, 0.5)], gap=0.14)])
# End of round: short arpeggio C5-E5-G5-C6.
write("end.wav", seq([(523, 0.3, 0.5), (659, 0.3, 0.5), (784, 0.3, 0.5), (1047, 0.6, 0.6)], gap=0.1))
