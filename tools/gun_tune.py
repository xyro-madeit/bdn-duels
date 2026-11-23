# Per-gun polish: tries noise seeds and drive amounts for each GUNM entry, keeps what earshot hears as
# most gunshot-like. Writes tools/gun_tune.json, which build_sfx.py merges over GUNM.
# Run: ~/earshot/.venv/bin/python tools/gun_tune.py
import os, sys, json, wave, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.expanduser('~/earshot'))
from build_sfx import gunshot, SR, BASE, GUNM
from earshot import vocab
from earshot.match import score_queries
v = vocab.get(); tmp = os.path.join(tempfile.gettempdir(), 'bdn_tune.wav'); out = {}
for name, ov in GUNM.items():
    best = None
    for seed in range(8):
        for drive in (5.0, 8.0, 11.0):
            y = gunshot(**{**BASE, **ov, 'seed': seed, 'drive': drive})
            with wave.open(tmp, 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())
            r = score_queries(vocab.embed_file(tmp), ['a single gunshot'], ['a snare hit', 'a kick drum', 'a door slam'], v)[0]
            sc = r['z'] + 3 * r['p_vs_alts']
            if not best or sc > best[0]: best = (sc, seed, drive, r['z'], r['p_vs_alts'])
    out[name] = {'seed': best[1], 'drive': best[2]}
    print(f'{name:14s} seed {best[1]} drive {best[2]:4.1f}  z {best[3]:+.2f} p {best[4]:.2f}', flush=True)
json.dump(out, open(os.path.join(HERE, 'gun_tune.json'), 'w'), indent=1)
