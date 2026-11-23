# Builds BDN Duels' combat sounds by layering earshot bank renders (tools/sfx_src) with a little
# shaped noise, then exports small mono MP3s to public/sfx. Run: python3 tools/build_sfx.py [--wav]
# Each recipe is a list of layers; a gun = powder crack (noise) + transient + low body + tail.
import json, os, sys, subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sfx_src')
OUT = os.path.join(ROOT, 'public', 'sfx')
WAVOUT = os.path.join(ROOT, 'tools', 'sfx_mix')
SR = 48000
rng = np.random.default_rng(7)

def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SRC, name + '.wav'), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x / max(1e-9, np.abs(x).max())

def resample(x, rate):  # rate > 1 = higher and shorter
    if rate == 1: return x
    idx = np.arange(0, len(x) - 1, rate)
    return np.interp(idx, np.arange(len(x)), x)

def band(x, lo, hi):  # brick-ish FFT band-pass with soft edges
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))

def noise_burst(dur, tau, lo, hi):
    n = int(dur * SR); t = np.arange(n) / SR
    x = band(rng.standard_normal(n), lo, hi) * np.exp(-t / tau)
    x[: int(0.0008 * SR)] *= np.linspace(0, 1, int(0.0008 * SR))  # tiny attack ramp, no click
    return x / max(1e-9, np.abs(x).max())

def fade_trim(x, length, fade=0.06):
    n = min(len(x), int(length * SR)); x = x[:n].copy(); f = min(n, int(fade * SR))
    x[n - f:] *= np.linspace(1, 0, f) ** 2
    return x

def mix(layers, total=None):
    parts = []
    for L in layers:
        if L[0] == 'noise':
            _, dur, tau, lo, hi, db, delay = L; x = noise_burst(dur, tau, lo, hi)
        else:
            name, db, delay = L[0], L[1], L[2]; opt = L[3] if len(L) > 3 else {}
            x = load(name)
            if opt.get('rate'): x = resample(x, opt['rate'])
            if opt.get('band'): x = band(x, *opt['band'])
            if opt.get('trim'): x = fade_trim(x, opt['trim'], opt.get('fade', 0.06))
        parts.append((x * 10 ** (db / 20), int(delay * SR)))
    n = max(len(x) + d for x, d in parts)
    y = np.zeros(n)
    for x, d in parts: y[d:d + len(x)] += x
    if total: y = fade_trim(y, total)
    # gentle soft-clip glue, then peak at -1 dBFS
    y = np.tanh(y * 1.4) / np.tanh(1.4)
    return y / max(1e-9, np.abs(y).max()) * 10 ** (-1 / 20)

# ---------------------------------------------------------------- gunshot model
# Gunshots aren't drums: no pitched thump. A clipped broadband muzzle blast, a noisy low "push",
# dense early reflections off nearby walls and a decaying room tail.
def gunshot(blast_tau=0.012, blast_band=(300, 12000), push_tau=0.04, push_band=(60, 900), push_db=-3,
            refl=(0.007, 0.013, 0.021, 0.034), refl_db=-9, tail_tau=0.25, tail_band=(250, 5000), tail_db=-12,
            length=0.7, drive=3.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(length * SR); t = np.arange(n) / SR
    def burst(tau, lo, hi):
        x = band(r.standard_normal(n), lo, hi) * np.exp(-t / tau)
        x[: int(0.0005 * SR)] *= np.linspace(0, 1, int(0.0005 * SR))
        return x / max(1e-9, np.abs(x).max())
    blast = burst(blast_tau, *blast_band)
    y = blast + burst(push_tau, *push_band) * 10 ** (push_db / 20)
    for i, d in enumerate(refl):  # early reflections: filtered, quieter copies of the blast
        k = int(d * SR); e = band(blast, 400, 6000 - i * 900) * 10 ** ((refl_db - i * 2) / 20)
        y[k:] += e[: n - k]
    tail = band(r.standard_normal(n), *tail_band) * np.exp(-t / tail_tau) * np.minimum(1, t / 0.012)
    y += tail / max(1e-9, np.abs(tail).max()) * 10 ** (tail_db / 20)
    y = np.tanh(y * drive) / np.tanh(drive)  # the recorder clips: that hard edge reads as "gun"
    f = int(0.05 * SR); y[-f:] *= np.linspace(1, 0, f) ** 2
    return y / max(1e-9, np.abs(y).max()) * 10 ** (-1 / 20)


# ---------------------------------------------------------------- melee hit model
# Body hits: a low, damped thud + a short broadband slap; blades add a bright noise "shhk" that rises then dies.
def fleshhit(thud_f=90, thud_tau=0.05, slap_tau=0.006, slap_band=(800, 7000), slap_db=-3, slice_db=-60,
             slice_band=(2500, 11000), slice_len=0.09, length=0.35, drive=3.0, seed=0):
    r = np.random.default_rng(seed); n = int(length * SR); t = np.arange(n) / SR
    f = thud_f * (1 + 1.2 * np.exp(-t / 0.012))  # quick downward pitch drop
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / thud_tau)
    thud += band(r.standard_normal(n), 40, 400) * np.exp(-t / thud_tau) * 0.6
    slap = band(r.standard_normal(n), *slap_band) * np.exp(-t / slap_tau)
    y = thud / np.abs(thud).max() + slap / np.abs(slap).max() * 10 ** (slap_db / 20)
    if slice_db > -50:
        env = np.clip(t / (slice_len * 0.3), 0, 1) * np.exp(-np.maximum(0, t - slice_len * 0.3) / (slice_len * 0.4))
        sl = band(r.standard_normal(n), *slice_band) * env
        y += sl / np.abs(sl).max() * 10 ** (slice_db / 20)
    y = np.tanh(y * drive) / np.tanh(drive)
    k = int(0.03 * SR); y[-k:] *= np.linspace(1, 0, k) ** 2
    return y / max(1e-9, np.abs(y).max()) * 10 ** (-1 / 20)

# ---------------------------------------------------------------- recipes
# Firearms use the gunshot model. BASE is the winner of tools/gun_search.py (earshot: "a single gunshot"
# z +3.3, picked over snare/kick/door 72% of the time); each gun bends it toward its own character.
BASE = dict(blast_tau=0.0168, blast_band=(793, 6780), push_tau=0.0518, push_band=(50, 1010), push_db=3,
            refl_db=-18.2, tail_tau=0.317, tail_band=(768, 1870), tail_db=-4.65, drive=8.0, length=0.85)
GUNM = {
  'gun_striker':  {},
  'gun_triburst': {'blast_tau': 0.013, 'tail_tau': 0.26, 'length': 0.7, 'seed': 1},
  'gun_wasp':     {'blast_tau': 0.009, 'blast_band': (1200, 9000), 'push_db': -4, 'tail_tau': 0.18, 'tail_db': -8, 'length': 0.45, 'seed': 2},
  'gun_hornet':   {'blast_tau': 0.009, 'blast_band': (1400, 10000), 'push_db': -4, 'tail_tau': 0.18, 'tail_db': -8, 'length': 0.45, 'seed': 3},
  'gun_breacher': {'blast_tau': 0.03, 'blast_band': (300, 5500), 'push_tau': 0.09, 'tail_tau': 0.4, 'length': 1.0, 'seed': 4},
  'gun_twinfang': {'blast_tau': 0.035, 'blast_band': (250, 5000), 'push_tau': 0.11, 'tail_tau': 0.45, 'length': 1.1, 'seed': 5},
  'gun_longshot': {'blast_tau': 0.02, 'blast_band': (700, 9000), 'push_tau': 0.07, 'tail_tau': 0.6, 'tail_db': -5, 'length': 1.4, 'seed': 6},
  'gun_sidekick': {'blast_tau': 0.011, 'blast_band': (1000, 8000), 'push_db': -2, 'tail_tau': 0.22, 'tail_db': -7, 'length': 0.55, 'seed': 7},
  'gun_judge':    {'blast_tau': 0.02, 'blast_band': (600, 6500), 'push_tau': 0.07, 'tail_tau': 0.38, 'length': 0.95, 'seed': 8},
  'gun_buzzsaw':  {'blast_tau': 0.006, 'blast_band': (1000, 9000), 'push_db': -6, 'tail_tau': 0.07, 'tail_db': -12, 'length': 0.18, 'seed': 9},
  'gun_boomer':   {'blast_tau': 0.035, 'blast_band': (200, 4000), 'push_tau': 0.12, 'tail_tau': 0.5, 'length': 1.2, 'seed': 10},
}
_tune = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gun_tune.json')
if os.path.exists(_tune):  # per-gun seed/drive picked by tools/gun_tune.py
    for _k, _v in json.load(open(_tune)).items():
        if _k in GUNM and _k != 'gun_hornet': GUNM[_k].update(_v)
GUNM['gun_hornet'].update(seed=5, drive=11.0)
G = {
  # not gunpowder, so these stay layered from the bank
  'gun_quill':    [('twang', 0, 0, {'rate': 1.3, 'trim': 0.18}), ('crack_latch', -8, 0), ('tail_whoosh', -6, 0.02, {'trim': 0.3})],
  'gun_signal':   [('body_kick', -2, 0, {'rate': 1.6}), ('noise', 0.6, 0.25, 2500, 9000, -6, 0.01), ('tail_whoosh', -8, 0.0, {'trim': 0.4})],
}
OTHER = {
  # melee swings
  'swing_light':  [('swing_blade', 0, 0)],
  'swing_blade':  [('swing_zing', 0, 0), ('swing_blade', -6, 0.02)],
  'swing_heavy':  [('swing_heavy', 0, 0, {'trim': 0.55}), ('swing_stick', -8, 0.05)],
  'swing_fist':   [('swing_fist', 0, 0, {'rate': 1.15})],
  # melee hits
  # explosions
  'boom_frag':    [('noise', 0.6, 0.12, 80, 5000, -2, 0), ('boom_blast', 0, 0, {'trim': 1.8, 'fade': 0.8}), ('boom_rumble', -6, 0.02, {'trim': 1.2})],
  'boom_small':   [('noise', 0.35, 0.07, 120, 5000, -3, 0), ('boom_classic', 0, 0, {'trim': 1.0, 'fade': 0.5})],
  'boom_slam':    [('boom_deep', 0, 0, {'trim': 1.0, 'fade': 0.5}), ('mhit_punch', -4, 0, {'rate': 0.7})],
  'smoke':        [('smoke_hiss', 0, 0), ('noise', 1.2, 0.6, 3000, 11000, -12, 0.05)],
  # movement + handling
  'dash':         [('dash', 0, 0)],
  'slide':        [('slide', 0, 0)],
  'throw':        [('throw', 0, 0, {'rate': 1.2})],
  'bounce':       [('bounce', 0, 0)],
  'pin':          [('pin', 0, 0), ('crack_latch', -8, 0.04)],
  'pump':         [('pump_a', 0, 0), ('pump_b', -2, 0.12)],
  'bolt':         [('bolt', 0, 0), ('crack_latch', -4, 0.16, {'rate': 0.85})],
  'dry':          [('dry', 0, 0)],
  'land':         [('land', 0, 0, {'rate': 0.85})],
  'step':         [('step', 0, 0, {'rate': 0.8})],
  'impact':       [('bullet_tick', 0, 0, {'rate': 1.3}), ('noise', 0.05, 0.01, 2000, 9000, -8, 0)],
  # round 2: replaces the remaining synth cues
  'shell':        [('shell_a', 0, 0, {'rate': 0.9}), ('shell_b', -6, 0.03, {'rate': 1.2})],
  'pad':          [('pad_zip', 0, 0), ('pad_air', -4, 0.02)],
  'burn':         [('crackle', 0, 0, {'trim': 0.25}), ('noise', 0.2, 0.05, 1500, 7000, -10, 0.0)],
  'ignite':       [('ignite_gust', 0, 0, {'trim': 0.9, 'fade': 0.4}), ('ignite_swell', -4, 0.05, {'trim': 0.9, 'fade': 0.4}), ('glass_click', -6, 0), ('glass_tap', -8, 0.01)],
  'fire':         [('crackle', -2, 0, {'trim': 0.3}), ('crackle', -5, 0.18, {'rate': 0.8, 'trim': 0.3}), ('noise', 1.2, 0.6, 400, 3000, -12, 0)],
  'ghost':        [('ghost_rev', 0, 0, {'trim': 2.2, 'fade': 0.6}), ('ghost_shim', -5, 0.3, {'trim': 1.8, 'fade': 0.6})],
  'zap':          [('zap_blast', 0, 0, {'trim': 1.0, 'fade': 0.5}), ('zap_glitch', -3, 0.0)],
  'pop':          [('pop_double', 0, 0), ('pop_bloop', -4, 0.06)],
  'shatter':      [('glass_click', 0, 0), ('glass_tap', -2, 0.01), ('glass_tink', -4, 0.03, {'rate': 1.3}), ('noise', 0.35, 0.06, 4000, 14000, -8, 0)],
  'hurt':         [('hurt_punch', 0, 0, {'rate': 0.75, 'trim': 0.3})],
  'inspect':      [('inspect_cloth', 0, 0), ('inspect_micro', -6, 0.15)],
  'land_soft':    [('land_light', 0, 0, {'rate': 0.8})],
  'step2':        [('step_b', 0, 0, {'rate': 0.7})],
  'pixel':        [('pixel_scr', 0, 0)],
  'spotlight':    [('spot_sting', 0, 0)],
  'balloon':      [('balloon_zip', 0, 0), ('pop_bloop', -6, 0.1)],
}

def combine(*parts):  # (array, dB) pairs, summed from t=0, peak -1 dBFS
    n = max(len(a) for a, _ in parts); y = np.zeros(n)
    for a, db in parts: y[:len(a)] += a * 10 ** (db / 20)
    return y / max(1e-9, np.abs(y).max()) * 10 ** (-1 / 20)

PUNCH = dict(thud_f=108, thud_tau=0.021, slap_tau=0.011, slap_band=(1466, 5998), slap_db=0, drive=3.9, seed=25)
FX = {  # sounds built from the models plus bank layers
  'mhit_blunt': lambda: combine((mix([('mhit_punch', 0, 0)]), 0), (fleshhit(**PUNCH), -3)),
  'mhit_blade': lambda: combine((fleshhit(**{**PUNCH, 'slice_db': -2, 'slice_len': 0.12}), 0),
                                (mix([('mhit_metal', 0, 0, {'trim': 0.4, 'rate': 1.5})]), -9)),
  'mhit_heavy': lambda: combine((mix([('mhit_metal', 0, 0, {'trim': 0.6, 'rate': 0.85})]), 0),
                                (fleshhit(**{**PUNCH, 'thud_f': 65, 'thud_tau': 0.06, 'drive': 5}), -2)),
  'flashbang':  lambda: combine((gunshot(**{**BASE, 'blast_band': (900, 13000), 'blast_tau': 0.02, 'tail_tau': 0.5,
                                            'tail_band': (1500, 6000), 'length': 1.3, 'drive': 11, 'seed': 4}), 0),
                                (mix([('flash_ring', 0, 0, {'rate': 0.9})]), -16)),
}

if __name__ == '__main__':
    wav = '--wav' in sys.argv
    os.makedirs(OUT, exist_ok=True); os.makedirs(WAVOUT, exist_ok=True)
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    jobs = {**{k: ('m', v) for k, v in GUNM.items()}, **{k: ('l', v) for k, v in {**G, **OTHER}.items()},
            **{k: ('f', v) for k, v in FX.items()}}
    for name, (kind, spec) in jobs.items():
        if only and name not in only: continue
        y = gunshot(**{**BASE, **spec}) if kind == 'm' else spec() if kind == 'f' else mix(spec)
        pcm = (y * 32767).astype(np.int16).tobytes()
        wpath = os.path.join(WAVOUT, name + '.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', wpath], input=pcm)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wpath, '-ac', '1', '-b:a', '96k', os.path.join(OUT, name + '.mp3')])
        print(f'{name:14s} {len(y) / SR:.2f}s')
