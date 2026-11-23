# Searches the gunshot model's parameters so earshot hears "gunshot" rather than "snare/kick".
# Run with earshot's Python: ~/earshot/.venv/bin/python tools/gun_search.py [rounds] [pop]
# Writes the best parameter sets to tools/gun_best.json (used by build_sfx.py).
import os, sys, json, wave, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.expanduser('~/earshot'))
from build_sfx import gunshot, SR
from earshot import vocab
from earshot.match import score_queries

TARGET = 'a single gunshot'
ALTS = ['a snare hit', 'a kick drum', 'a punchy impact hit', 'a door slam']
SPACE = {  # name: (lo, hi, log-scale?)
    'blast_tau': (0.003, 0.03, True), 'push_tau': (0.015, 0.12, True), 'push_db': (-12, 3, False),
    'refl_db': (-20, -4, False), 'tail_tau': (0.08, 0.7, True), 'tail_db': (-20, -4, False), 'drive': (1.5, 9, False),
    'blast_lo': (100, 1500, True), 'blast_hi': (4000, 15000, True), 'push_hi': (300, 2000, True),
    'tail_lo': (100, 800, True), 'tail_hi': (1500, 8000, True),
}
v = vocab.get()

def to_kw(p):
    return dict(blast_tau=p['blast_tau'], blast_band=(p['blast_lo'], p['blast_hi']), push_tau=p['push_tau'],
                push_band=(50, p['push_hi']), push_db=p['push_db'], refl_db=p['refl_db'], tail_tau=p['tail_tau'],
                tail_band=(p['tail_lo'], p['tail_hi']), tail_db=p['tail_db'], drive=p['drive'],
                length=min(1.2, 0.15 + p['tail_tau'] * 2.2))

def score(p, path):
    y = gunshot(**to_kw(p), seed=1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())
    a = vocab.embed_file(path)
    r = score_queries(a, [TARGET], ALTS, v)[0]
    return r['z'] + 3 * r['p_vs_alts'], r['z'], r['p_vs_alts']

def sample(rng, around=None, sigma=0.25):
    p = {}
    for k, (lo, hi, lg) in SPACE.items():
        if around is None: u = rng.random()
        else:
            c = (np.log(around[k] / lo) / np.log(hi / lo)) if lg else (around[k] - lo) / (hi - lo)
            u = float(np.clip(c + rng.normal(0, sigma), 0, 1))
        p[k] = lo * (hi / lo) ** u if lg else lo + (hi - lo) * u
    return p

if __name__ == '__main__':
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    pop = int(sys.argv[2]) if len(sys.argv) > 2 else 16
    rng = np.random.default_rng(3)
    tmp = os.path.join(tempfile.gettempdir(), 'bdn_gun_try.wav')
    scored = []
    for r in range(rounds):
        elite = [s[1] for s in sorted(scored, key=lambda s: -s[0])[:4]]
        for i in range(pop):
            p = sample(rng) if r == 0 or not elite else sample(rng, elite[i % len(elite)], 0.25 / (1 + r * 0.5))
            sc, z, pv = score(p, tmp)
            scored.append((sc, p, z, pv))
        best = max(scored, key=lambda s: s[0])
        print(f'round {r + 1}: best z {best[2]:+.2f}  p(gunshot vs drums/door) {best[3]:.2f}', flush=True)
    top = sorted(scored, key=lambda s: -s[0])[:6]
    json.dump([dict(kw={k: (list(v) if isinstance(v, tuple) else v) for k, v in to_kw(p).items()}, z=z, p=pv) for sc, p, z, pv in top],
              open(os.path.join(HERE, 'gun_best.json'), 'w'), indent=1)
    for sc, p, z, pv in top: print(f'z {z:+.2f} p {pv:.2f}  ' + ' '.join(f'{k}={p[k]:.3g}' for k in SPACE))
