# Renders gunshot-model variants so earshot can rank them. python3 tools/gun_trials.py
import os, sys, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_sfx import gunshot, SR
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gun_trials')
os.makedirs(OUT, exist_ok=True)
V = {
  'a_base':      {},
  'b_hotter':    {'drive': 6},
  'c_roomy':     {'tail_tau': 0.45, 'tail_db': -8, 'length': 1.0},
  'd_tight':     {'blast_tau': 0.007, 'tail_tau': 0.15, 'tail_db': -14, 'length': 0.45},
  'e_heavy':     {'push_db': 0, 'push_tau': 0.06, 'drive': 5},
  'f_outdoor':   {'refl_db': -16, 'tail_tau': 0.6, 'tail_db': -10, 'tail_band': (150, 2500), 'length': 1.2},
  'g_bright':    {'blast_band': (800, 14000), 'blast_tau': 0.009, 'drive': 5},
  'h_dark':      {'blast_band': (150, 6000), 'push_db': -1, 'drive': 4},
}
for name, kw in V.items():
    y = gunshot(**kw)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', os.path.join(OUT, name + '.wav')], input=(y * 32767).astype(np.int16).tobytes())
print('ok', len(V))
