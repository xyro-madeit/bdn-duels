# Renders the raw ingredients for BDN Duels' sound effects from earshot's sound bank.
# Run with earshot's Python:  ~/earshot/.venv/bin/python tools/render_ingredients.py
# Output: tools/sfx_src/<name>.wav (source material only; the game uses the mixes from build_sfx.py)
import os, sys
sys.path.insert(0, os.path.expanduser('~/earshot'))
from earshot.forge.sfx import sfx_render

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx_src')
os.makedirs(OUT, exist_ok=True)

# name: (bank id, kwargs)
ING = {
    # gun layers: transient crack, low body, tail
    'crack_snap': ('click/snap', {}), 'crack_pro': ('pro_click/snap', {}), 'crack_shutter': ('shutter/snap', {}),
    'crack_knock': ('knock/snap', {}), 'crack_latch': ('toggle/latch', {}),
    'body_kick': ('cut_hit/kick', {}), 'body_punch': ('cut_hit/punch', {}), 'body_sub': ('cut_hit/sub', {}),
    'body_short': ('pro_impact/short', {}), 'body_air': ('cut_hit/air', {}),
    'tail_air': ('pro_impact/air', {}), 'tail_rumble': ('pro_impact/rumble', {}), 'tail_drop': ('sub_drop/punch', {}),
    'tail_whoosh': ('whoosh_fast/tight', {'dur': 0.4}),
    # melee
    'swing_blade': ('swish/blade', {}), 'swing_stick': ('swish/stick', {}), 'swing_zing': ('swish/zing', {}),
    'swing_whip': ('whoosh_fast/whip', {'dur': 0.5}), 'swing_heavy': ('whoosh_fast/heavy', {'dur': 0.6}),
    'swing_fist': ('swish/flick', {}),
    'mhit_punch': ('cut_hit/punch', {}), 'mhit_metal': ('impact/metal', {}), 'mhit_wood': ('knock/wood', {}),
    # explosions / big hits
    'boom_blast': ('impact/blast', {}), 'boom_classic': ('impact/classic', {}), 'boom_rumble': ('pro_impact/rumble', {}),
    'boom_deep': ('pro_impact/deep', {}),
    # movement + handling
    'dash': ('whoosh_fast/crisp', {'dur': 0.45}), 'slide': ('swipe/cloth', {}), 'throw': ('swish/soft', {}),
    'bounce': ('knock/plastic', {}), 'pin': ('toggle/micro', {}), 'pump_a': ('toggle/rocker', {}), 'pump_b': ('shutter/film', {}),
    'bolt': ('toggle/latch', {}), 'dry': ('click/thock', {}), 'land': ('pro_pop_in/deep', {}), 'step': ('pro_tap/soft', {}),
    'twang': ('pro_zip/down_warm', {}), 'flash_ring': ('pro_notify/ding_2296', {}), 'smoke_hiss': ('reverse_swell/breath', {}),
    'bullet_tick': ('pro_tap/knock', {}),
    # round 2: everything that was still synthesized
    'shell_a': ('fit/click/floss_lid', {}), 'shell_b': ('knock/plastic', {}),
    'pad_zip': ('pro_zip/up_hi', {}), 'pad_air': ('whoosh_fast/crisp', {'dur': 0.4}),
    'crackle': ('pro_typing_key/crackle', {}), 'ignite_gust': ('whoosh_big/gust', {'dur': 0.9}), 'ignite_swell': ('impact/swell', {}),
    'ghost_rev': ('reverse_swell/ring', {}), 'ghost_shim': ('shimmer/m2', {}),
    'zap_glitch': ('glitch/burst', {}), 'zap_blast': ('impact/blast', {}),
    'pop_double': ('pro_pop/double', {}), 'pop_bloop': ('pro_pop/bloop', {}),
    'glass_click': ('pro_click/glass', {}), 'glass_tap': ('tap/glass', {}), 'glass_tink': ('click/tink', {}),
    'hurt_punch': ('impact/punch', {}), 'inspect_cloth': ('swipe/cloth', {}), 'inspect_micro': ('toggle/micro', {}),
    'land_light': ('fit/land.light/finger_wood', {}), 'step_b': ('tap/knuckle', {}),
    'pixel_scr': ('glitch/scramble', {}), 'spot_sting': ('pro_logo_sting/swell_sting', {}), 'balloon_zip': ('pro_zip/up', {}),
}

only = sys.argv[1:]
for name, (sid, kw) in ING.items():
    if only and name not in only: continue
    path = os.path.join(OUT, name + '.wav')
    r = sfx_render(sid, out=path, **kw)
    print(f'{name:14s} <- {sid:22s} ok')
