# Physical sound models for cues the earshot bank doesn't cover well (glass, fire, footsteps,
# body hits, lightning). Each model's parameters are searched so earshot hears the target
# description over the given alternatives (same approach as gun_search.py).
# Run: ~/earshot/.venv/bin/python tools/fx_search.py [names...]  -> tools/sfx_mix/<name>.wav + public/sfx/<name>.mp3
import os, sys, json, wave, tempfile, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, os.path.expanduser('~/earshot'))
from build_sfx import band, SR
from earshot import vocab
from earshot.match import score_queries

def norm(y, db=-1):
    k = int(0.01 * SR); y[-k:] *= np.linspace(1, 0, k)
    return y / max(1e-9, np.abs(y).max()) * 10 ** (db / 20)

def env(n, a, tau):
    t = np.arange(n) / SR; e = np.exp(-t / tau); k = max(1, int(a * SR)); e[:k] *= np.linspace(0, 1, k); return e

def glass(p, r):
    n = int(p['len'] * SR); y = np.zeros(n); t = np.arange(n) / SR
    y += band(r.standard_normal(n), p['nlo'], 16000) * env(n, 0.0005, p['ntau']) * p['noise']   # crack
    for i in range(int(p['pings'])):                                                          # shards ringing
        f = np.exp(r.uniform(np.log(p['flo']), np.log(9000))); d = r.uniform(0, p['spread']); k = int(d * SR)
        s = np.sin(2 * np.pi * f * t[: n - k]) * np.exp(-t[: n - k] / r.uniform(0.01, p['ptau'])) * r.uniform(0.3, 1)
        y[k:] += s
    for i in range(int(p['tinkles'])):                                                        # pieces landing
        k = int(r.uniform(0.08, p['len'] - 0.05) * SR); m = min(n - k, int(0.03 * SR))
        y[k:k + m] += band(r.standard_normal(m), 3000, 14000) * np.exp(-np.arange(m) / SR / 0.004) * r.uniform(0.2, 0.6)
    return np.tanh(y * p['drive']) / np.tanh(p['drive'])

def fire(p, r):
    n = int(p['len'] * SR)
    rum = band(r.standard_normal(n), 40, p['rhi']) * p['rumble']
    hiss = band(r.standard_normal(n), 2000, 9000) * p['hiss'] * (0.7 + 0.3 * np.sin(np.arange(n) / SR * 3))
    y = rum / np.abs(rum).max() + hiss / max(1e-9, np.abs(hiss).max())
    for i in range(int(p['pops'] * p['len'])):                                                  # crackle pops
        k = int(r.uniform(0, p['len'] - 0.02) * SR); m = int(r.uniform(0.002, 0.012) * SR)
        y[k:k + m] += band(r.standard_normal(m), p['plo'], 12000) * np.exp(-np.arange(m) / SR / 0.002) * r.uniform(0.3, 1) * p['popamp']
    return np.tanh(y * 1.5)

def step(p, r):
    n = int(0.22 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for k0, amp in ((0, 1.0), (p['gap'], p['toe'])):
        k = int(k0 * SR); m = n - k
        thud = np.sin(2 * np.pi * p['f'] * t[:m] * (1 + 0.5 * np.exp(-t[:m] / 0.01))) * np.exp(-t[:m] / p['ttau'])
        grit = band(r.standard_normal(m), p['glo'], 7000) * np.exp(-t[:m] / p['gtau']) * p['grit']
        y[k:] += (thud + grit) * amp
    return np.tanh(y * 2)

def body(p, r):
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = p['f'] * (1 + 1.5 * np.exp(-t / 0.01))
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / p['ttau'])
    slap = band(r.standard_normal(n), p['slo'], 6000) * np.exp(-t / p['stau']) * p['slap']
    cloth = band(r.standard_normal(n), 300, 2500) * env(n, 0.003, 0.04) * p['cloth']
    return np.tanh((thud + slap + cloth) * 2.5)

def zap(p, r):
    n = int(p['len'] * SR); t = np.arange(n) / SR
    crack = band(r.standard_normal(n), 800, 14000) * env(n, 0.0003, p['ctau'])
    sizzle = band(r.standard_normal(n), 3000, 12000) * (r.random(n) < p['den']).astype(float) * np.exp(-t / p['stau']) * 3
    roll = band(r.standard_normal(n), 30, 300) * env(n, 0.02, p['rtau']) * p['roll']
    return np.tanh((crack + sizzle + roll) * p['drive'])

MODELS = {
    'shatter': (glass, 'glass breaking', ['a gunshot', 'a door knock', 'a bell'], {
        'len': (0.4, 0.9), 'nlo': (800, 4000), 'ntau': (0.005, 0.04), 'noise': (0.3, 1.5), 'pings': (8, 40), 'flo': (1500, 4000),
        'spread': (0.01, 0.12), 'ptau': (0.03, 0.2), 'tinkles': (2, 14), 'drive': (1, 4)}),
    'fire': (fire, 'fire crackling', ['rain', 'static noise', 'frying food'], {
        'len': (1.2, 1.2), 'rhi': (150, 600), 'rumble': (0.3, 1.0), 'hiss': (0.05, 0.4), 'pops': (8, 40), 'plo': (500, 3000), 'popamp': (1, 4)}),
    'step': (step, 'a footstep', ['a door knock', 'a click', 'a kick drum'], {
        'gap': (0.02, 0.08), 'toe': (0.3, 0.9), 'f': (60, 160), 'ttau': (0.01, 0.05), 'glo': (500, 3000), 'gtau': (0.005, 0.04), 'grit': (0.2, 1.5)}),
    'hurt': (body, 'a punch hitting a body', ['a kick drum', 'a door slam', 'a gunshot'], {
        'f': (60, 140), 'ttau': (0.02, 0.08), 'slo': (400, 2000), 'stau': (0.004, 0.03), 'slap': (0.2, 1.5), 'cloth': (0.0, 0.8)}),
    'zap': (zap, 'a lightning strike', ['an explosion', 'a gunshot', 'static noise'], {
        'len': (0.8, 1.6), 'ctau': (0.01, 0.08), 'den': (0.002, 0.05), 'stau': (0.1, 0.5), 'rtau': (0.2, 0.8), 'roll': (0.3, 2.0), 'drive': (1, 5)}),
}

def search(name, rounds=4, pop=14):
    fn, q, alts, space = MODELS[name]
    v = vocab.get(); tmp = os.path.join(tempfile.gettempdir(), f'bdn_{name}.wav'); rng = np.random.default_rng(5)
    def sample(c=None, sig=0.25):
        out = {}
        for k, (lo, hi) in space.items():
            u = rng.random() if c is None else float(np.clip((c[k] - lo) / max(1e-9, hi - lo) + rng.normal(0, sig), 0, 1))
            out[k] = lo + (hi - lo) * u
        return out
    def score(p):
        y = norm(fn(p, np.random.default_rng(1)))
        with wave.open(tmp, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())
        r = score_queries(vocab.embed_file(tmp), [q], alts, v)[0]; return r['z'] + 3 * r['p_vs_alts'], r['z'], r['p_vs_alts'], y
    best = []
    for rd in range(rounds):
        el = [b[1] for b in sorted(best, key=lambda b: -b[0][0])[:3]]
        for i in range(pop):
            p = sample() if not el else sample(el[i % len(el)], 0.25 / (1 + rd * 0.6))
            best.append((score(p), p))
    (sc, z, pv, y), p = max(best, key=lambda b: b[0][0])
    wp = os.path.join(HERE, 'sfx_mix', name + '.wav')
    with wave.open(wp, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wp, '-ac', '1', '-b:a', '96k', os.path.join(ROOT, 'public', 'sfx', name + '.mp3')])
    print(f'{name:8s} z {z:+.2f} p {pv:.2f}  ({q})', flush=True)
    return p

if __name__ == '__main__':
    names = sys.argv[1:] or list(MODELS)
    res = {n: search(n) for n in names}
    json.dump(res, open(os.path.join(HERE, 'fx_best.json'), 'w'), indent=1)
