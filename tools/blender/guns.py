# Realistic weapon models for BDN Duels. Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/blender/guns.py -- striker [--no-render]
# Writes public/models/<id>.glb and review renders tools/blender/review/<id>_side.png / _3q.png.
# Coordinates are game viewmodel space (see gunkit.py). Moving parts are named groups the game
# animates: mag, pump, bolt, spin, string; "muzzle" marks the barrel tip.
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, gunkit as K
importlib.reload(K)
from gunkit import box, prism, cyl, tube, rod, cut, cutter_box, cutter_cyl, rail, group, reparent, marker, array

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PI = math.pi

# ---------------------------------------------------------------- shared sub-assemblies
def red_dot(m, y, z, hood=0.05):
    """Holographic-style sight: rail base, boxy hood with an open window, glass + lit reticle."""
    box('optic_base', (0.036, 0.012, 0.085), (0, y - 0.03, z), m['body'], 0.001)
    hood_o = box('optic_hood', (0.046, hood, 0.075), (0, y, z), m['body'], 0.0025, seg=3)
    cut(hood_o, cutter_box('optic_window', (0.036, hood - 0.014, 0.1), (0, y + 0.003, z)))
    box('optic_glass', (0.036, hood - 0.014, 0.002), (0, y + 0.003, z - 0.03), m['glass'], 0)
    cyl('optic_dot', 0.0016, 0.001, (0, y + 0.003, z - 0.0285), m['dot'], segs=12, bevel=0)
    cyl('optic_knob', 0.007, 0.012, (0.028, y - 0.004, z + 0.015), m['poly'], axis='x', segs=16)
    box('optic_btn', (0.004, 0.01, 0.022), (-0.024, y - 0.008, z + 0.012), m['rubber'], 0.0008)

def ar_grip(m, mat=None):
    prism('grip', [(0.035, -0.028), (-0.006, -0.028), (-0.008, -0.042), (0.022, -0.148), (0.058, -0.152),
                   (0.066, -0.142), (0.046, -0.06), (0.044, -0.028)], 0.03, mat or m['furn'], bevel=0.003, seg=3)

def trigger_group(m, z0=-0.035, y0=-0.034):
    box('tguard_bottom', (0.012, 0.005, 0.078), (0, y0 - 0.03, z0 - 0.028), m['body'], 0.001)
    box('tguard_front', (0.012, 0.03, 0.006), (0, y0 - 0.014, z0 - 0.066), m['body'], 0.001)
    prism('trigger', [(z0 - 0.022, y0), (z0 - 0.026, y0 - 0.014), (z0 - 0.02, y0 - 0.026), (z0 - 0.014, y0 - 0.024),
                      (z0 - 0.018, y0 - 0.012), (z0 - 0.014, y0)], 0.006, m['steel'], bevel=0.0006)

def stanag(m, at, name='mag', curve=1.0, length=0.19, width=0.024, mat=None):
    """Curved box magazine hanging below `at` (top-center), grouped as `name` for reload anims."""
    g = group(name, at=at)
    zt, yt = at[2], at[1]
    c = curve
    d = 0.058  # front-to-back depth stays constant down the curve
    fz = [zt - 0.03, zt - 0.032 - 0.004 * c, zt - 0.04 - 0.014 * c, zt - 0.05 - 0.03 * c]
    fy = [yt + 0.02, yt - length * 0.35, yt - length * 0.7, yt - length]
    front = list(zip(fz, fy))
    back = [(z + d, y - (0.01 if i == 3 else 0)) for i, (z, y) in enumerate(front)][::-1]
    body = prism(name + '_body', front + back, width, mat or m['steel'], bevel=0.0015, seg=2)
    zb = (front[-1][0] + back[0][0]) / 2
    box(name + '_plate', (width + 0.006, 0.01, 0.07), (0, yt - length - 0.004, zb), m['poly'], 0.002, rot=(-0.12 * c, 0, 0))
    reparent([K.bpy.data.objects[name + '_body'], K.bpy.data.objects[name + '_plate']], g)
    return g

# ---------------------------------------------------------------- weapons
def striker():
    """AR-pattern carbine at real proportions: 21 cm receiver, 36 cm M-LOK handguard, 14.5" barrel."""
    m = K.std_mats(furniture='#121315')
    # ---- upper receiver
    up = prism('upper', [(0.05, 0.0), (0.05, 0.034), (0.044, 0.042), (-0.165, 0.042), (-0.165, 0.0)], 0.05, m['body'], bevel=0.0012)
    cut(up, cutter_box('eject_port', (0.02, 0.018, 0.062), (0.026, 0.02, -0.06)))
    box('dust_cover', (0.0016, 0.021, 0.066), (0.0255, 0.02, -0.06), m['steel'], 0.0004)
    box('bolt_face', (0.002, 0.012, 0.03), (0.022, 0.02, -0.06), m['bright'], 0.0003)
    cyl('fwd_assist_hsg', 0.009, 0.026, (0.022, 0.03, 0.012), m['body'], axis='z', segs=16, rot=(0, 0.22, 0))
    cyl('fwd_assist', 0.0065, 0.014, (0.026, 0.03, 0.03), m['steel'], axis='z', segs=16, rot=(0, 0.22, 0))
    box('brass_deflector', (0.008, 0.016, 0.016), (0.027, 0.032, -0.006), m['body'], 0.003, seg=3)
    rail('rail_top', 0.21, (0, 0.045, -0.058), m['body'])
    box('charging_handle', (0.024, 0.007, 0.03), (0, 0.037, 0.062), m['body'], 0.0008)
    box('charging_latch', (0.046, 0.009, 0.011), (0, 0.037, 0.076), m['body'], 0.0025, seg=3)
    # ---- lower receiver
    lo = prism('lower', [(0.05, 0.0), (0.05, -0.008), (0.036, -0.021), (-0.068, -0.021), (-0.074, -0.05),
                         (-0.152, -0.058), (-0.165, -0.034), (-0.165, 0.0)], 0.048, m['body'], bevel=0.0012)
    cut(lo, cutter_box('magwell', (0.027, 0.07, 0.07), (0, -0.04, -0.112)))
    for zz in (0.03, -0.14):
        cyl(f'pin{zz}', 0.0035, 0.052, (0, -0.008, zz), m['steel'], axis='x', segs=12, bevel=0.0004)
    box('mag_release', (0.008, 0.01, 0.011), (0.025, -0.012, -0.064), m['steel'], 0.0012)
    box('bolt_catch', (0.004, 0.024, 0.009), (-0.025, -0.004, -0.07), m['steel'], 0.0008)
    sel = cyl('selector', 0.0075, 0.005, (-0.026, -0.008, 0.012), m['steel'], axis='x', segs=16)
    box('selector_lever', (0.003, 0.004, 0.018), (-0.028, -0.008, 0.02), m['steel'], 0.0006)
    # ---- trigger group + grip
    box('tguard_bottom', (0.011, 0.005, 0.078), (0, -0.05, -0.036), m['body'], 0.0012)
    box('tguard_front', (0.011, 0.03, 0.006), (0, -0.036, -0.072), m['body'], 0.0012)
    prism('trigger', [(-0.022, -0.02), (-0.026, -0.032), (-0.021, -0.043), (-0.016, -0.042), (-0.019, -0.031), (-0.016, -0.02)], 0.006, m['steel'], bevel=0.0005)
    gr = prism('grip', [(0.0, -0.021), (0.04, -0.021), (0.052, -0.031), (0.064, -0.122), (0.058, -0.134), (0.03, -0.134),
                        (0.022, -0.12), (0.016, -0.09), (0.008, -0.072), (0.004, -0.05)], 0.029, m['furn'], bevel=0.003, seg=3)
    for i in range(6):
        cut(gr, cutter_box(f'grip_tex{i}', (0.034, 0.003, 0.012), (0, -0.05 - i * 0.012, 0.058 + i * 0.0006), rot=(0.25, 0, 0)))
    # ---- buffer tube + stock
    cyl('buffer', 0.015, 0.19, (0, 0.024, 0.145), m['body'], axis='z', segs=24)
    cyl('castle_nut', 0.019, 0.01, (0, 0.024, 0.055), m['steel'], axis='z', segs=12)
    st = prism('stock', [(0.105, 0.046), (0.24, 0.05), (0.254, 0.042), (0.254, -0.07), (0.236, -0.075), (0.196, -0.036),
                          (0.15, -0.012), (0.105, 0.004)], 0.042, m['furn'], bevel=0.003, seg=3)
    cut(st, cutter_box('stock_window', (0.05, 0.022, 0.044), (0, -0.026, 0.205), rot=(0.42, 0, 0)))
    box('buttpad', (0.044, 0.114, 0.012), (0, -0.012, 0.259), m['rubber'], 0.003, seg=3)
    box('stock_lever', (0.01, 0.01, 0.034), (0, 0.0, 0.13), m['steel'], 0.001)
    cyl('sling_loop', 0.006, 0.046, (0, 0.03, 0.235), m['steel'], axis='x', segs=12)
    # ---- handguard (octagonal M-LOK) + rail, barrel, brake
    hg = cyl('handguard', 0.029, 0.355, (0, 0.024, -0.343), m['body'], axis='z', segs=8, rot=(0, 0, PI / 8), bevel=0.0015)
    for side in (-1, 1):
        for i in range(5):
            cut(hg, cutter_box(f'mlok{side}{i}', (0.012, 0.008, 0.032), (side * 0.029, 0.02, -0.215 - i * 0.06)))
    for i in range(5):
        cut(hg, cutter_box(f'mlokb{i}', (0.008, 0.012, 0.032), (0, -0.005, -0.215 - i * 0.06)))
    rail('rail_hg', 0.35, (0, 0.051, -0.343), m['body'])
    cyl('barrel_in', 0.0095, 0.36, (0, 0.024, -0.34), m['steel'], axis='z', segs=20)
    cyl('gas_block', 0.013, 0.022, (0, 0.024, -0.47), m['steel'], axis='z', segs=16)
    cyl('barrel', 0.0095, 0.17, (0, 0.024, -0.6), m['steel'], axis='z', segs=20)
    mb = cyl('brake', 0.0125, 0.058, (0, 0.024, -0.69), m['steel'], axis='z', segs=20)
    for i in range(3):
        cut(mb, cutter_box(f'brake_port{i}', (0.04, 0.006, 0.0075), (0, 0.03, -0.674 - i * 0.012)))
    cut(mb, cutter_cyl('brake_bore', 0.0055, 0.08, (0, 0.024, -0.69), axis='z'))
    # ---- sights + optic
    box('rear_sight', (0.022, 0.012, 0.022), (0, 0.054, 0.035), m['body'], 0.0015)
    box('front_sight', (0.02, 0.011, 0.026), (0, 0.062, -0.505), m['body'], 0.0015)
    red_dot(m, 0.1, -0.085, hood=0.054)
    box('optic_riser', (0.03, 0.026, 0.06), (0, 0.06, -0.085), m['body'], 0.0015)
    stanag(m, (0, -0.01, -0.112), length=0.17)
    marker('muzzle', (0, 0.024, -0.72))
    marker('left_hand', (-0.005, -0.012, -0.33))
    return {'muzzle': (0, 0.024, -0.72)}


def scope(m, y, z_rear, z_front, r=0.016, obj=0.022, name='scope', mat=None):
    """Riflescope along z: tube, objective bell, eyepiece, turrets, rings, lenses."""
    mat = mat or m['body']
    L = z_rear - z_front; zc = (z_rear + z_front) / 2
    cyl(name + '_tube', r, L * 0.62, (0, y, zc + L * 0.02), mat, segs=32)
    cyl(name + '_bell', obj, L * 0.22, (0, y, z_front + L * 0.11), mat, segs=32)
    cyl(name + '_taper', r, L * 0.08, (0, y, z_front + L * 0.26), mat, segs=32, r2=obj)
    cyl(name + '_eye', r * 1.25, L * 0.16, (0, y, z_rear - L * 0.08), mat, segs=32)
    cyl(name + '_eye_t', r, L * 0.06, (0, y, z_rear - L * 0.19), mat, segs=32, r2=r * 1.25)
    cyl(name + '_tur_top', r * 0.75, r * 1.4, (0, y + r * 1.4, zc), m['poly'], axis='y', segs=24)
    cyl(name + '_tur_side', r * 0.75, r * 1.4, (r * 1.4, y, zc), m['poly'], axis='x', segs=24)
    cyl(name + '_lens_f', obj * 0.85, 0.002, (0, y, z_front - 0.0005), m['glass'], segs=32, bevel=0)
    cyl(name + '_lens_r', r * 1.05, 0.002, (0, y, z_rear + 0.0005), m['glass'], segs=32, bevel=0)
    for k, zz in enumerate((zc + L * 0.2, zc - L * 0.2)):
        cyl(f'{name}_ring{k}', r * 1.22, 0.014, (0, y, zz), m['steel'], segs=24)
        box(f'{name}_ringbase{k}', (0.024, y - 0.04, 0.016), (0, (y + 0.04) / 2 + 0.0, zz), m['steel'], 0.001)

def iron_sights(m, y, z_rear, z_front, base=0.0):
    box('irons_rear', (0.026, 0.016, 0.014), (0, y - 0.006, z_rear), m['body'], 0.0015)
    cut(K.bpy.data.objects['irons_rear'], cutter_box('irons_notch', (0.006, 0.01, 0.03), (0, y + 0.003, z_rear)))
    box('irons_front_base', (0.02, 0.012, 0.018), (0, y - 0.012, z_front), m['body'], 0.0015)
    box('irons_front_post', (0.0035, 0.014, 0.004), (0, y - 0.001, z_front), m['steel'], 0.0004)

def triburst():
    """Burst rifle: SCAR-style aluminum upper, tan polymer lower + folding stock, 2.5x optic."""
    m = K.std_mats(furniture='#a08a63', accent='#a08a63')
    up = prism('upper', [(0.06, 0.0), (0.06, 0.04), (0.05, 0.048), (-0.36, 0.048), (-0.38, 0.03), (-0.38, 0.0)], 0.054, m['body'], bevel=0.0015)
    cut(up, cutter_box('eject', (0.02, 0.018, 0.06), (0.028, 0.02, -0.05)))
    box('bolt_face', (0.002, 0.012, 0.03), (0.025, 0.02, -0.05), m['bright'], 0.0003)
    rail('rail_top', 0.42, (0, 0.051, -0.16), m['body'])
    for side in (-1, 1):
        for i in range(4):
            cut(up, cutter_box(f'tb_slot{side}{i}', (0.012, 0.008, 0.028), (side * 0.027, 0.022, -0.24 - i * 0.034)))
    box('charging', (0.012, 0.014, 0.022), (-0.032, 0.032, -0.2), m['steel'], 0.002)
    lo = prism('lower', [(0.06, 0.0), (0.06, -0.012), (0.04, -0.024), (-0.07, -0.024), (-0.076, -0.052), (-0.154, -0.06),
                         (-0.168, -0.036), (-0.172, 0.0)], 0.05, m['furn'], bevel=0.002, seg=3)
    cut(lo, cutter_box('magwell', (0.028, 0.07, 0.07), (0, -0.04, -0.112)))
    box('tguard', (0.012, 0.006, 0.08), (0, -0.052, -0.036), m['furn'], 0.002)
    prism('trigger', [(-0.022, -0.024), (-0.026, -0.034), (-0.021, -0.044), (-0.016, -0.043), (-0.019, -0.033), (-0.016, -0.024)], 0.006, m['steel'], bevel=0.0005)
    ar_grip(m)
    cyl('selector', 0.0075, 0.005, (-0.026, -0.01, 0.012), m['steel'], axis='x', segs=16)
    # folding stock: hinge block, skeleton arm, cheek piece, butt
    box('hinge', (0.04, 0.05, 0.03), (0, 0.02, 0.075), m['body'], 0.003, seg=3)
    st = prism('stock', [(0.09, 0.044), (0.255, 0.052), (0.27, 0.04), (0.27, -0.075), (0.25, -0.08), (0.2, -0.03), (0.13, -0.004), (0.09, 0.0)], 0.04, m['furn'], bevel=0.003, seg=3)
    cut(st, cutter_box('stock_hole', (0.06, 0.03, 0.07), (0, -0.018, 0.2), rot=(0.35, 0, 0)))
    box('cheek', (0.042, 0.016, 0.1), (0, 0.06, 0.2), m['furn'], 0.004, seg=3)
    box('butt', (0.044, 0.125, 0.012), (0, -0.015, 0.274), m['rubber'], 0.003, seg=3)
    # barrel + flash hider
    cyl('barrel', 0.0095, 0.24, (0, 0.022, -0.5), m['steel'], segs=20)
    cyl('gas_block', 0.013, 0.03, (0, 0.022, -0.39), m['steel'], segs=16)
    fh = cyl('flash_hider', 0.012, 0.05, (0, 0.022, -0.65), m['steel'], segs=20)
    for i in range(4):
        a = i * PI / 2 + PI / 4
        cut(fh, cutter_box(f'fh_slot{i}', (0.004, 0.03, 0.035), (math.cos(a) * 0.012, 0.022 + math.sin(a) * 0.012, -0.665), rot=(0, 0, a)))
    # 2.5x prism-style optic (sight center y = 0.1)
    box('optic_mount', (0.03, 0.03, 0.08), (0, 0.068, -0.1), m['body'], 0.002)
    box('optic_body', (0.044, 0.044, 0.1), (0, 0.1, -0.1), m['body'], 0.004, seg=3)
    cyl('optic_obj', 0.022, 0.03, (0, 0.1, -0.165), m['body'], segs=32)
    cyl('optic_eye', 0.018, 0.02, (0, 0.1, -0.04), m['rubber'], segs=32)
    cyl('optic_lens_f', 0.019, 0.002, (0, 0.1, -0.181), m['glass'], segs=32, bevel=0)
    cyl('optic_lens_r', 0.015, 0.002, (0, 0.1, -0.029), m['glass'], segs=32, bevel=0)
    cyl('optic_dot', 0.0014, 0.001, (0, 0.1, -0.031), m['dot'], segs=12, bevel=0)
    cyl('optic_knob', 0.008, 0.012, (0.028, 0.1, -0.1), m['poly'], axis='x', segs=16)
    stanag(m, (0, -0.012, -0.112), length=0.16, mat=m['poly'])
    marker('muzzle', (0, 0.022, -0.675))
    marker('left_hand', (-0.005, -0.008, -0.3))
    return {}

def wasp():
    """Compact 9 mm SMG: boxy steel receiver, straight mag, folding wire stock, vertical grip."""
    m = K.std_mats(furniture='#16171a', accent='#4a4f63')
    rc = prism('receiver', [(0.06, -0.02), (0.06, 0.05), (0.045, 0.06), (-0.27, 0.06), (-0.28, 0.045), (-0.28, -0.02)], 0.048, m['body'], bevel=0.0015)
    cut(rc, cutter_box('eject', (0.02, 0.018, 0.05), (0.025, 0.035, -0.05)))
    for i in range(4):
        cut(rc, cutter_box(f'vent{i}', (0.06, 0.008, 0.018), (0, 0.036, -0.17 - i * 0.026)))
    rail('rail_top', 0.2, (0, 0.063, -0.08), m['body'])
    box('cocking', (0.014, 0.012, 0.03), (-0.03, 0.045, -0.2), m['steel'], 0.002)
    cyl('barrel', 0.009, 0.08, (0, 0.03, -0.32), m['steel'], segs=20)
    cyl('nut', 0.014, 0.022, (0, 0.03, -0.29), m['steel'], segs=16)
    trigger_group(m, z0=-0.03, y0=-0.02)
    prism('grip', [(-0.004, -0.02), (0.038, -0.02), (0.05, -0.03), (0.062, -0.12), (0.056, -0.132), (0.028, -0.132), (0.02, -0.118), (0.006, -0.05)], 0.03, m['furn'], bevel=0.003, seg=3)
    lw = prism('magwell', [(-0.105, -0.02), (-0.105, -0.06), (-0.155, -0.06), (-0.155, -0.02)], 0.036, m['body'], bevel=0.002)
    # straight double-stack mag (grouped for reload anims)
    g = group('mag', at=(0, -0.04, -0.13))
    mb = box('mag_body', (0.026, 0.2, 0.036), (0, -0.12, -0.13), m['steel'], 0.0015)
    box('mag_plate', (0.032, 0.012, 0.044), (0, -0.224, -0.13), m['poly'], 0.002)
    reparent([mb, K.bpy.data.objects['mag_plate']], g)
    # vertical foregrip
    box('fg_mount', (0.026, 0.012, 0.04), (0, -0.026, -0.24), m['body'], 0.0015)
    cyl('fg', 0.014, 0.09, (0, -0.075, -0.24), m['furn'], axis='y', segs=24, bevel=0.002)
    cyl('fg_cap', 0.016, 0.01, (0, -0.124, -0.24), m['furn'], axis='y', segs=24)
    # folded wire stock along the right side
    for yy in (0.035, -0.005):
        cyl(f'stock_rod{yy}', 0.0045, 0.22, (0.031, yy, -0.06), m['steel'], segs=12)
    box('stock_butt', (0.01, 0.06, 0.014), (0.031, 0.015, -0.17), m['rubber'], 0.002)
    box('stock_hinge', (0.016, 0.05, 0.02), (0.03, 0.015, 0.055), m['steel'], 0.002)
    iron_sights(m, 0.075, 0.03, -0.26)
    marker('muzzle', (0, 0.03, -0.36))
    marker('left_hand', (0, -0.1, -0.24))
    return {}

def breacher():
    """Pump shotgun: steel receiver, tube magazine, ribbed polymer pump, synthetic stock, bead."""
    m = K.std_mats(furniture='#1a1b1d')
    rc = prism('receiver', [(0.06, -0.022), (0.06, 0.05), (0.04, 0.066), (-0.2, 0.066), (-0.21, 0.05), (-0.21, -0.022)], 0.054, m['body'], bevel=0.002)
    cut(rc, cutter_box('eject', (0.02, 0.026, 0.07), (0.028, 0.035, -0.07)))
    cut(rc, cutter_box('load_port', (0.03, 0.03, 0.08), (0, -0.03, -0.08)))
    cyl('barrel', 0.0125, 0.52, (0, 0.042, -0.47), m['steel'], segs=24)
    cut(K.bpy.data.objects['barrel'], cutter_cyl('bore', 0.0095, 0.6, (0, 0.042, -0.47), axis='z', segs=24))
    rib = box('vent_rib', (0.01, 0.006, 0.5), (0, 0.058, -0.47), m['steel'], 0.0008)
    cyl('bead', 0.0028, 0.006, (0, 0.064, -0.71), m['brass'], axis='y', segs=12)
    cyl('mag_tube', 0.011, 0.44, (0, 0.006, -0.43), m['steel'], segs=20)
    cyl('mag_cap', 0.013, 0.025, (0, 0.006, -0.655), m['steel'], segs=20)
    box('barrel_clamp', (0.02, 0.05, 0.016), (0, 0.025, -0.62), m['steel'], 0.002)
    g = group('pump', at=(0, -0.006, -0.42))
    pm = cyl('pump_body', 0.022, 0.17, (0, 0.002, -0.42), m['furn'], segs=24, bevel=0.003)
    for i in range(7):
        cut(pm, cutter_cyl(f'pump_groove{i}', 0.03, 0.006, (0, 0.002, -0.355 - i * 0.022), axis='z', segs=24) if False else cutter_box(f'pump_groove{i}', (0.05, 0.004, 0.006), (0, -0.018, -0.36 - i * 0.02)))
    reparent([pm], g)
    trigger_group(m, z0=-0.035, y0=-0.022)
    prism('grip', [(0.02, -0.02), (0.07, -0.01), (0.09, -0.03), (0.1, -0.11), (0.094, -0.124), (0.066, -0.124), (0.058, -0.1), (0.04, -0.05)], 0.032, m['furn'], bevel=0.003, seg=3)
    st = prism('stock', [(0.06, 0.05), (0.27, 0.035), (0.29, 0.025), (0.29, -0.09), (0.27, -0.094), (0.1, -0.06), (0.06, -0.022)], 0.044, m['furn'], bevel=0.004, seg=3)
    box('butt', (0.046, 0.13, 0.016), (0, -0.03, 0.296), m['rubber'], 0.004, seg=3)
    box('safety', (0.012, 0.008, 0.012), (0, 0.068, 0.03), m['steel'], 0.002)
    cyl('slide_release', 0.004, 0.012, (-0.028, -0.012, -0.0), m['steel'], axis='x', segs=12)
    marker('muzzle', (0, 0.042, -0.73))
    marker('left_hand', (-0.005, -0.01, -0.42))
    return {}

def twinfang():
    """Side-by-side double barrel: blued barrels, walnut forend + stock, case-hardened action."""
    m = K.std_mats()
    walnut = K.material('M_Furniture', '#5a3018', 0.0, 0.42, coat=0.4)
    action = K.material('M_Accent', '#6f6a62', 0.9, 0.33)
    prism('action', [(0.05, -0.02), (0.05, 0.03), (0.03, 0.05), (-0.08, 0.05), (-0.09, 0.0), (-0.07, -0.03), (0.02, -0.035)], 0.06, action, bevel=0.003, seg=3)
    for x in (-0.0175, 0.0175):
        b = cyl(f'barrel{x}', 0.0165, 0.6, (x, 0.03, -0.38), m['steel'], segs=28)
        cut(b, cutter_cyl(f'bore{x}', 0.0125, 0.7, (x, 0.03, -0.38), axis='z', segs=24))
    box('rib', (0.012, 0.008, 0.58), (0, 0.048, -0.38), m['steel'], 0.001)
    box('rib_low', (0.012, 0.01, 0.4), (0, 0.012, -0.3), m['steel'], 0.001)
    cyl('bead', 0.0025, 0.006, (0, 0.055, -0.67), m['brass'], axis='y', segs=12)
    prism('forend', [(-0.1, 0.012), (-0.34, 0.012), (-0.35, 0.0), (-0.33, -0.022), (-0.12, -0.03), (-0.1, -0.015)], 0.05, walnut, bevel=0.004, seg=3)
    box('lever', (0.012, 0.008, 0.03), (0, 0.054, 0.04), action, 0.002, rot=(0, 0.3, 0))
    for zz in (-0.012, -0.03):
        prism(f'trigger{zz}', [(zz, -0.03), (zz - 0.004, -0.042), (zz + 0.002, -0.052), (zz + 0.006, -0.05), (zz + 0.003, -0.04), (zz + 0.006, -0.03)], 0.006, m['bright'], bevel=0.0005)
    box('tguard', (0.01, 0.005, 0.07), (0, -0.058, -0.02), action, 0.002)
    st = prism('stock', [(0.05, 0.035), (0.12, 0.012), (0.3, 0.03), (0.31, 0.02), (0.31, -0.1), (0.29, -0.104), (0.13, -0.07), (0.07, -0.06), (0.05, -0.03)], 0.044, walnut, bevel=0.005, seg=3)
    box('butt', (0.046, 0.13, 0.012), (0, -0.036, 0.315), m['rubber'], 0.004, seg=3)
    marker('muzzle', (0, 0.03, -0.68))
    marker('left_hand', (0, -0.02, -0.25))
    return {}

def longshot():
    """Bolt-action sniper on an aluminum chassis: fluted heavy barrel, brake, 6-24x scope, bipod."""
    m = K.std_mats(furniture='#3d4a3a', accent='#3d4a3a')
    ch = prism('chassis', [(0.07, 0.0), (0.07, 0.03), (-0.42, 0.03), (-0.44, 0.0), (-0.42, -0.03), (-0.07, -0.03), (-0.07, -0.05),
                           (-0.16, -0.05), (-0.17, -0.03), (0.07, -0.025)], 0.056, m['furn'], bevel=0.002)
    for i in range(5):
        cut(ch, cutter_box(f'ch_hole{i}', (0.07, 0.022, 0.04), (0, 0.004, -0.2 - i * 0.05)))
    rc = cyl('receiver', 0.022, 0.24, (0, 0.04, -0.04), m['steel'], segs=32)
    cut(rc, cutter_box('eject', (0.02, 0.016, 0.07), (0.02, 0.05, -0.06)))
    g = group('bolt', at=(0.05, 0.04, 0.0))
    bb = cyl('bolt_body', 0.011, 0.11, (0.0, 0.045, 0.04), m['bright'], segs=20)
    bh = cyl('bolt_handle', 0.004, 0.05, (0.028, 0.04, 0.03), m['bright'], axis='x', segs=12)
    bk = cyl('bolt_knob', 0.009, 0.016, (0.055, 0.04, 0.03), m['poly'], axis='x', segs=16)
    reparent([bb, bh, bk], g)
    rail('rail', 0.24, (0, 0.066, -0.06), m['body'])
    b = cyl('barrel', 0.0125, 0.56, (0, 0.04, -0.44), m['steel'], segs=24, r2=0.0105)
    for i in range(6):
        a = i * PI / 3
        cut(b, cutter_box(f'flute{i}', (0.004, 0.004, 0.3), (math.cos(a) * 0.0125, 0.04 + math.sin(a) * 0.0125, -0.42), rot=(0, 0, a)))
    br = cyl('brake', 0.016, 0.06, (0, 0.04, -0.73), m['steel'], segs=24)
    for i in range(3):
        cut(br, cutter_box(f'brk{i}', (0.05, 0.008, 0.01), (0, 0.042, -0.71 - i * 0.016)))
    cut(br, cutter_cyl('brk_bore', 0.007, 0.08, (0, 0.04, -0.73), axis='z'))
    trigger_group(m, z0=-0.03, y0=-0.025)
    prism('grip', [(0.0, -0.025), (0.045, -0.025), (0.058, -0.035), (0.07, -0.13), (0.064, -0.14), (0.034, -0.14), (0.026, -0.12), (0.01, -0.06)], 0.03, m['poly'], bevel=0.003, seg=3)
    g2 = group('mag', at=(0, -0.05, -0.12))
    mg = box('mag_body', (0.034, 0.08, 0.075), (0, -0.075, -0.12), m['steel'], 0.002)
    reparent([mg], g2)
    # skeleton stock with cheek riser
    st = prism('stock', [(0.07, 0.03), (0.3, 0.03), (0.315, 0.02), (0.315, -0.1), (0.3, -0.105), (0.24, -0.06), (0.12, -0.05), (0.07, -0.025)], 0.046, m['furn'], bevel=0.003, seg=3)
    cut(st, cutter_box('stock_hole', (0.06, 0.035, 0.12), (0, -0.02, 0.2)))
    box('cheek', (0.044, 0.026, 0.13), (0, 0.05, 0.2), m['poly'], 0.004, seg=3)
    box('butt', (0.048, 0.14, 0.014), (0, -0.035, 0.32), m['rubber'], 0.004, seg=3)
    # folded bipod under the forend
    box('bipod_mount', (0.03, 0.014, 0.03), (0, -0.036, -0.4), m['steel'], 0.002)
    for x in (-0.01, 0.01):
        cyl(f'bipod_leg{x}', 0.0045, 0.16, (x, -0.044, -0.32), m['steel'], segs=12)
    scope(m, 0.1, 0.07, -0.29, r=0.017, obj=0.026)
    marker('muzzle', (0, 0.04, -0.76))
    marker('left_hand', (-0.005, -0.04, -0.36))
    return {}

def quill():
    """Crossbow: walnut stock, aluminum rail, recurve limbs with cams, string + bolt, red dot."""
    m = K.std_mats(furniture='#5a3018')
    wood = K.material('M_Furniture', '#5a3018', 0.0, 0.42, coat=0.4)
    prism('stock', [(0.06, 0.04), (0.3, 0.02), (0.31, 0.01), (0.31, -0.09), (0.29, -0.094), (0.12, -0.05), (0.06, -0.035)], 0.044, wood, bevel=0.004, seg=3)
    prism('grip', [(-0.004, -0.02), (0.04, -0.02), (0.054, -0.032), (0.066, -0.122), (0.06, -0.134), (0.032, -0.134), (0.024, -0.12), (0.01, -0.06)], 0.03, wood, bevel=0.003, seg=3)
    trigger_group(m, z0=-0.03, y0=-0.02)
    prism('body', [(0.06, -0.02), (0.06, 0.04), (-0.4, 0.04), (-0.42, 0.02), (-0.42, -0.02)], 0.05, m['body'], bevel=0.002)
    box('flight_rail', (0.016, 0.006, 0.44), (0, 0.044, -0.18), m['bright'], 0.001)
    box('riser', (0.07, 0.05, 0.05), (0, 0.025, -0.43), m['body'], 0.004, seg=3)
    box('foot_stirrup', (0.08, 0.008, 0.06), (0, -0.01, -0.47), m['body'], 0.003)
    tip = []
    for sx in (-1, 1):
        a = 0.24
        box(f'limb{sx}', (0.3, 0.014, 0.042), (sx * 0.17, 0.03, -0.41), m['poly'], 0.003, seg=3, rot=(0, -sx * a, 0))
        box(f'limb_tip{sx}', (0.05, 0.012, 0.03), (sx * 0.33, 0.03, -0.37), m['poly'], 0.003, seg=3, rot=(0, -sx * (a + 0.5), 0))
        tx, tz = sx * 0.345, -0.36
        cyl(f'cam{sx}', 0.02, 0.012, (tx, 0.03, tz), m['body'], axis='y', segs=24)
        cyl(f'axle{sx}', 0.004, 0.03, (tx, 0.03, tz), m['bright'], axis='y', segs=12)
        tip.append((tx, 0.042, tz))
    gs = group('string', at=(0, 0.055, -0.3))
    nock = (0, 0.05, -0.24)
    st1 = rod('string_l', tip[0], nock, 0.0016, m['poly'])
    st2 = rod('string_r', tip[1], nock, 0.0016, m['poly'])
    reparent([st1, st2], gs)
    gb = group('bolt', at=(0, 0.06, -0.36))
    sh = cyl('bolt_shaft', 0.004, 0.42, (0, 0.052, -0.39), m['steel'], segs=12)
    hd = cyl('bolt_head', 0.007, 0.03, (0, 0.052, -0.615), m['bright'], segs=12, r2=0.001)
    fl = box('bolt_fletch', (0.002, 0.02, 0.05), (0, 0.06, -0.21), K.material('M_Fletch', '#e0423a', 0, 0.6), 0.0006)
    reparent([sh, hd, fl], gb)
    red_dot(m, 0.08, -0.05, hood=0.04)
    box('optic_riser', (0.03, 0.012, 0.06), (0, 0.048, -0.05), m['body'], 0.0015)
    marker('muzzle', (0, 0.052, -0.6))
    marker('left_hand', (0, -0.025, -0.28))
    return {}

def buzzsaw():
    """Rotary minigun: six-barrel cluster (spins), motor housing, carry handle, ammo box + feed chute."""
    m = K.std_mats(furniture='#2e3238', accent='#c98b2c')
    hs = cyl('housing', 0.07, 0.3, (0, 0.0, -0.05), m['body'], segs=32, bevel=0.004)
    for i in range(6):
        cut(hs, cutter_box(f'hs_vent{i}', (0.15, 0.006, 0.03), (0, 0.04, 0.03 - i * 0.04)))
    cyl('motor', 0.045, 0.1, (0, 0.0, 0.14), m['steel'], segs=24)
    cyl('motor_cap', 0.05, 0.02, (0, 0.0, 0.19), m['accent'], segs=24)
    sp = group('spin', at=(0, 0, -0.2))
    parts = []
    for i in range(6):
        a = i / 6 * PI * 2
        b = cyl(f'barrel{i}', 0.0095, 0.5, (math.cos(a) * 0.035, math.sin(a) * 0.035, -0.45), m['steel'], segs=16)
        parts.append(b)
    for k, zz in enumerate((-0.25, -0.5, -0.68)):
        parts.append(cyl(f'clamp{k}', 0.05, 0.016, (0, 0, zz), m['body'] if k else m['accent'], segs=24))
    parts.append(cyl('hub', 0.03, 0.06, (0, 0, -0.22), m['steel'], segs=24))
    reparent(parts, sp)
    # carry handle on top (left hand) + rear grips
    box('handle_post_f', (0.02, 0.06, 0.02), (0, 0.09, -0.16), m['body'], 0.002)
    box('handle_post_r', (0.02, 0.06, 0.02), (0, 0.09, -0.02), m['body'], 0.002)
    cyl('handle', 0.014, 0.17, (0, 0.12, -0.09), m['rubber'], segs=20)
    prism('grip', [(0.06, -0.06), (0.1, -0.06), (0.11, -0.07), (0.12, -0.16), (0.114, -0.172), (0.084, -0.172), (0.076, -0.15), (0.062, -0.09)], 0.034, m['poly'], bevel=0.003, seg=3)
    box('grip_mount', (0.03, 0.03, 0.06), (0, -0.06, 0.07), m['body'], 0.002)
    box('trigger', (0.006, 0.02, 0.008), (0, -0.075, 0.055), m['steel'], 0.0008)
    # ammo box (left side) + feed chute
    g = group('mag', at=(-0.13, -0.03, -0.02))
    ab = box('ammo_box', (0.11, 0.12, 0.14), (-0.13, -0.03, -0.02), K.material('M_Ammo', '#4f5a3c', 0.2, 0.6), 0.004, seg=3)
    lid = box('ammo_lid', (0.115, 0.012, 0.145), (-0.13, 0.035, -0.02), m['steel'], 0.002)
    reparent([ab, lid], g)
    for i in range(5):
        box(f'chute{i}', (0.03, 0.028, 0.05), (-0.075 + i * 0.012, -0.0 + i * 0.006, -0.02), m['steel'], 0.002, rot=(0, 0, -0.3))
    marker('muzzle', (0, 0, -0.72))
    marker('left_hand', (0, 0.12, -0.1))
    return {}

# ---------------------------------------------------------------- secondaries
def pistol_sights(m, y, z_rear, z_front):
    r = box('sight_rear', (0.03, 0.012, 0.012), (0, y - 0.004, z_rear), m['steel'], 0.0012)
    cut(r, cutter_box('sight_notch', (0.007, 0.01, 0.03), (0, y + 0.002, z_rear)))
    box('sight_front', (0.006, 0.012, 0.01), (0, y - 0.004, z_front), m['steel'], 0.0008)
    for x in (-0.007, 0.007):
        cyl(f'sight_dot{x}', 0.0015, 0.001, (x, y - 0.002, z_rear + 0.0065), K.material('M_Tritium', '#7dffb0', 0, 0.4, emit=('#7dffb0', 2.0)), segs=10, bevel=0)
    cyl('sight_dot_f', 0.0015, 0.001, (0, y - 0.002, z_front + 0.0055), K.material('M_Tritium', '#7dffb0', 0, 0.4, emit=('#7dffb0', 2.0)), segs=10, bevel=0)

def sidekick():
    """Striker-fired 9 mm pistol: serrated steel slide, polymer frame with rail, flared magwell."""
    m = K.std_mats(furniture='#1c1d20', accent='#2a2c30')
    sl = prism('slide', [(0.035, 0.022), (0.035, 0.062), (0.028, 0.07), (-0.19, 0.07), (-0.2, 0.062), (-0.2, 0.022)], 0.03, m['body'], bevel=0.0018, seg=2)
    cut(sl, cutter_box('eject', (0.02, 0.016, 0.04), (0.012, 0.065, -0.04)))
    for i in range(7):
        for sx in (-1, 1):
            cut(sl, cutter_box(f'serr{i}{sx}', (0.004, 0.034, 0.003), (sx * 0.015, 0.046, 0.026 - i * 0.006)))
    cyl('barrel_crown', 0.0075, 0.012, (0, 0.045, -0.198), m['steel'], segs=20)
    cut(K.bpy.data.objects['barrel_crown'], cutter_cyl('bore', 0.0045, 0.03, (0, 0.045, -0.198), axis='z'))
    box('barrel_hood', (0.018, 0.014, 0.024), (0, 0.064, -0.035), m['steel'], 0.001)
    fr = prism('frame', [(0.035, 0.024), (0.03, 0.006), (-0.012, 0.004), (-0.035, -0.012), (-0.07, -0.006), (-0.19, 0.0), (-0.19, 0.024)], 0.028, m['furn'], bevel=0.002, seg=2)
    for i in range(3):
        cut(fr, cutter_box(f'rail{i}', (0.032, 0.004, 0.006), (0, 0.004, -0.12 - i * 0.02)))
    box('tguard', (0.014, 0.006, 0.05), (0, -0.032, -0.03), m['furn'], 0.002, rot=(0.12, 0, 0))
    prism('trigger', [(-0.006, -0.002), (-0.01, -0.016), (-0.006, -0.026), (-0.001, -0.025), (-0.003, -0.014), (0.0, -0.002)], 0.006, m['poly'], bevel=0.0005)
    gr = prism('grip', [(0.04, 0.012), (0.0, 0.0), (-0.005, -0.012), (0.012, -0.12), (0.05, -0.122), (0.06, -0.112), (0.048, 0.0)], 0.031, m['furn'], bevel=0.003, seg=3)
    for i in range(6):
        cut(gr, cutter_box(f'stip{i}', (0.036, 0.0025, 0.03), (0, -0.03 - i * 0.014, 0.034 + i * 0.002), rot=(0.18, 0, 0)))
    box('slide_stop', (0.004, 0.006, 0.026), (-0.016, 0.02, -0.03), m['steel'], 0.0008)
    box('mag_rel', (0.004, 0.01, 0.01), (-0.016, 0.0, -0.002), m['poly'], 0.001)
    g = group('mag', at=(0, -0.12, 0.024))
    mb = prism('mag_body', [(0.008, 0.0), (0.0, -0.01), (0.014, -0.122), (0.048, -0.124), (0.04, 0.0)], 0.022, m['steel'], bevel=0.0012)
    mp = box('mag_plate', (0.028, 0.01, 0.046), (0, -0.128, 0.03), m['poly'], 0.0025, rot=(0.12, 0, 0))
    reparent([mb, mp], g)
    pistol_sights(m, 0.08, 0.02, -0.185)
    marker('muzzle', (0, 0.045, -0.21))
    marker('left_hand', (-0.028, -0.07, 0.0))
    return {}

def revolver(m, metal, grip_mat, glass=False):
    """Shared revolver: frame, 6-shot fluted cylinder (named 'cyl'), full-lug barrel, hammer, grips."""
    fr = prism('frame', [(0.06, 0.06), (0.06, 0.0), (0.03, -0.01), (-0.09, -0.008), (-0.1, 0.012), (-0.1, 0.066), (-0.06, 0.07), (0.02, 0.07)], 0.032, metal, bevel=0.002)
    cut(fr, cutter_box('cyl_window', (0.05, 0.07, 0.092), (0, 0.033, -0.04)))
    g = group('cyl', at=(0, 0.033, -0.04))
    cy = cyl('cylinder', 0.034, 0.088, (0, 0.033, -0.04), metal, segs=32, bevel=0.003)
    for i in range(6):
        a = i * PI / 3 + PI / 6
        cut(cy, cutter_box(f'flute{i}', (0.012, 0.012, 0.06), (math.cos(a) * 0.036, 0.033 + math.sin(a) * 0.036, -0.04), rot=(0, 0, a)))
        cut(cy, cutter_cyl(f'chamber{i}', 0.0062, 0.1, (math.cos(a + PI / 6) * 0.021, 0.033 + math.sin(a + PI / 6) * 0.021, -0.04), axis='z', segs=12))
    reparent([cy], g)
    b = cyl('barrel', 0.012, 0.21, (0, 0.05, -0.19), metal, segs=24)
    cut(b, cutter_cyl('bore', 0.006, 0.3, (0, 0.05, -0.19), axis='z', segs=16))
    box('lug', (0.02, 0.02, 0.2), (0, 0.035, -0.19), metal, 0.003)
    box('rib', (0.01, 0.008, 0.2), (0, 0.064, -0.19), metal, 0.001)
    box('front_sight', (0.006, 0.014, 0.018), (0, 0.072, -0.28), metal, 0.001)
    box('rear_sight', (0.022, 0.008, 0.012), (0, 0.072, 0.02), metal, 0.001)
    cut(K.bpy.data.objects['rear_sight'], cutter_box('rs_notch', (0.006, 0.01, 0.03), (0, 0.075, 0.02)))
    prism('hammer', [(0.06, 0.06), (0.075, 0.08), (0.082, 0.076), (0.07, 0.052)], 0.01, metal if glass else m['steel'], bevel=0.001)
    box('tguard', (0.012, 0.006, 0.05), (0, -0.04, 0.0), metal, 0.002, rot=(0.15, 0, 0))
    prism('trigger', [(0.0, -0.008), (-0.006, -0.022), (0.0, -0.034), (0.005, -0.032), (0.002, -0.02), (0.006, -0.008)], 0.006, metal if glass else m['steel'], bevel=0.0005)
    prism('grip', [(0.06, 0.004), (0.03, -0.012), (0.035, -0.06), (0.05, -0.115), (0.08, -0.12), (0.092, -0.1), (0.075, -0.03), (0.07, 0.004)], 0.036, grip_mat, bevel=0.004, seg=3)
    if not glass:
        for sx in (-1, 1):
            cyl(f'grip_screw{sx}', 0.004, 0.004, (sx * 0.018, -0.06, 0.06), m['steel'], axis='x', segs=12)
    cyl('ejector_rod', 0.0035, 0.06, (0, 0.022, -0.115), metal, segs=12)

def judge():
    m = K.std_mats(accent='#3b3e43')
    walnut = K.material('M_Furniture', '#5a3018', 0.0, 0.4, coat=0.4)
    revolver(m, K.material('M_Body', '#5c6068', 1.0, 0.22), walnut)  # stainless
    marker('muzzle', (0, 0.05, -0.295))
    marker('left_hand', (-0.03, -0.075, 0.03))
    return {}

def glasscannon():
    m = K.std_mats()
    glass = K.material('M_GlassWeapon', '#cfeeff', 0.0, 0.02, alpha=0.3)
    revolver(m, glass, glass, glass=True)
    box('crystal_core', (0.012, 0.012, 0.012), (0, 0.033, -0.04), K.material('M_Core', '#9ff0ff', 0, 0.2, emit=('#7fe8ff', 3.0)), 0.003, rot=(0.6, 0.6, 0))
    marker('muzzle', (0, 0.05, -0.3))
    marker('left_hand', (-0.03, -0.075, 0.03))
    return {}

def hornet():
    """Machine pistol: stamped receiver, mag through the grip, folded wire stock, top cocking knob."""
    m = K.std_mats(furniture='#1c1d20', accent='#4a4f63')
    rc = prism('receiver', [(0.06, 0.005), (0.06, 0.068), (0.05, 0.075), (-0.16, 0.075), (-0.17, 0.065), (-0.17, 0.005)], 0.042, m['body'], bevel=0.0018)
    cut(rc, cutter_box('eject', (0.02, 0.016, 0.04), (0.02, 0.05, -0.05)))
    for i in range(3):
        for sx in (-1, 1):
            cut(rc, cutter_box(f'groove{i}{sx}', (0.004, 0.006, 0.18), (sx * 0.021, 0.02 + i * 0.016, -0.05)))
    box('cock_knob', (0.014, 0.012, 0.016), (0, 0.082, 0.03), m['steel'], 0.004, seg=3)
    cyl('barrel', 0.008, 0.06, (0, 0.04, -0.195), m['steel'], segs=16)
    cyl('barrel_nut', 0.014, 0.018, (0, 0.04, -0.172), m['steel'], segs=16)
    box('tguard', (0.014, 0.006, 0.06), (0, -0.028, -0.04), m['body'], 0.002)
    prism('trigger', [(-0.02, 0.004), (-0.024, -0.01), (-0.02, -0.02), (-0.015, -0.019), (-0.017, -0.008), (-0.014, 0.004)], 0.006, m['steel'], bevel=0.0005)
    prism('grip', [(-0.004, 0.005), (0.04, 0.005), (0.046, -0.006), (0.052, -0.1), (0.044, -0.11), (0.0, -0.11), (-0.006, -0.1)], 0.034, m['furn'], bevel=0.003, seg=3)
    g = group('mag', at=(0, -0.1, 0.02))
    mb = box('mag_body', (0.024, 0.2, 0.034), (0, -0.07, 0.02), m['steel'], 0.0015, rot=(0.0, 0, 0))
    mp = box('mag_plate', (0.03, 0.01, 0.04), (0, -0.172, 0.02), m['poly'], 0.002)
    reparent([mb, mp], g)
    for yy in (0.055, 0.02):
        cyl(f'stock_rod{yy}', 0.0035, 0.18, (0.024, yy, -0.04), m['steel'], segs=10)
    box('stock_pad', (0.008, 0.05, 0.012), (0.024, 0.038, -0.13), m['steel'], 0.002)
    iron_sights(m, 0.083, 0.05, -0.155)
    marker('muzzle', (0, 0.04, -0.23))
    marker('left_hand', (-0.03, -0.08, -0.02))
    return {}

def boomer():
    """Hand cannon: massive single barrel with a bell muzzle, break-open frame, loaded iron ball."""
    m = K.std_mats(furniture='#3a2618', accent='#8a6a3a')
    brass = K.material('M_Accent', '#b08d57', 1.0, 0.3)
    b = cyl('barrel', 0.042, 0.24, (0, 0.045, -0.15), m['steel'], segs=40, bevel=0.002)
    cut(b, cutter_cyl('bore', 0.03, 0.4, (0, 0.045, -0.15), axis='z', segs=32))
    bell = cyl('bell', 0.05, 0.03, (0, 0.045, -0.275), brass, segs=40, r2=0.054)
    cut(bell, cutter_cyl('bell_bore', 0.031, 0.1, (0, 0.045, -0.275), axis='z', segs=32))
    for k, zz in enumerate((-0.07, -0.18)):
        cyl(f'band{k}', 0.046, 0.016, (0, 0.045, zz), brass, segs=40)
    prism('frame', [(0.06, 0.07), (0.06, -0.005), (0.02, -0.02), (-0.04, -0.015), (-0.04, 0.07)], 0.05, m['body'], bevel=0.003, seg=2)
    cyl('hinge', 0.012, 0.06, (0, 0.0, -0.035), m['steel'], axis='x', segs=16)
    prism('hammer', [(0.06, 0.06), (0.08, 0.085), (0.088, 0.08), (0.072, 0.05)], 0.012, m['steel'], bevel=0.001)
    box('tguard', (0.014, 0.006, 0.055), (0, -0.042, 0.005), brass, 0.002)
    prism('trigger', [(0.0, -0.018), (-0.006, -0.03), (0.0, -0.04), (0.005, -0.038), (0.002, -0.028), (0.006, -0.018)], 0.006, m['steel'], bevel=0.0005)
    prism('grip', [(0.06, -0.005), (0.03, -0.02), (0.035, -0.07), (0.05, -0.125), (0.085, -0.13), (0.098, -0.11), (0.078, -0.03), (0.07, -0.005)], 0.04, m['furn'], bevel=0.004, seg=3)
    box('sight_rear', (0.024, 0.012, 0.012), (0, 0.093, -0.045), m['steel'], 0.001)
    box('sight_front', (0.006, 0.012, 0.012), (0, 0.093, -0.255), brass, 0.001)
    g = group('ball', at=(0, 0.045, -0.262))
    import bmesh as _bm
    bm = _bm.new(); _bm.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.027)
    _bm.ops.translate(bm, vec=K.B(0, 0.045, -0.262), verts=bm.verts)
    ball = K._link('ball_mesh', bm, K.material('M_Iron', '#2a2c2f', 0.9, 0.45)); K.smooth(ball); reparent([ball], g)
    marker('muzzle', (0, 0.045, -0.29))
    marker('left_hand', (-0.03, -0.075, 0.02))
    return {}

def signal():
    """Flare pistol: orange polymer, fat break-action barrel, ribbed grip."""
    m = K.std_mats(furniture='#e86a1c', accent='#e86a1c')
    orange = m['furn']
    b = cyl('barrel', 0.03, 0.2, (0, 0.045, -0.13), orange, segs=36, bevel=0.002)
    cut(b, cutter_cyl('bore', 0.021, 0.4, (0, 0.045, -0.13), axis='z', segs=28))
    for k, zz in enumerate((-0.04, -0.12, -0.2)):
        cyl(f'ring{k}', 0.032, 0.008, (0, 0.045, zz), orange, segs=36)
    cyl('muzzle_ring', 0.033, 0.014, (0, 0.045, -0.235), m['poly'], segs=36)
    cut(K.bpy.data.objects['muzzle_ring'], cutter_cyl('mr_bore', 0.021, 0.05, (0, 0.045, -0.235), axis='z', segs=28))
    prism('frame', [(0.055, 0.07), (0.055, -0.004), (0.02, -0.016), (-0.035, -0.012), (-0.035, 0.012), (0.0, 0.016), (0.0, 0.07)], 0.044, orange, bevel=0.003, seg=2)
    cyl('hinge', 0.009, 0.05, (0, 0.012, -0.03), m['steel'], axis='x', segs=16)
    prism('hammer', [(0.055, 0.055), (0.07, 0.078), (0.078, 0.074), (0.065, 0.046)], 0.012, m['poly'], bevel=0.001)
    box('tguard', (0.014, 0.007, 0.055), (0, -0.04, 0.005), orange, 0.002)
    prism('trigger', [(0.0, -0.016), (-0.006, -0.028), (0.0, -0.038), (0.005, -0.036), (0.002, -0.026), (0.006, -0.016)], 0.006, m['poly'], bevel=0.0005)
    gr = prism('grip', [(0.055, -0.004), (0.026, -0.016), (0.03, -0.07), (0.045, -0.122), (0.08, -0.126), (0.092, -0.106), (0.072, -0.03), (0.066, -0.004)], 0.04, orange, bevel=0.004, seg=3)
    for i in range(5):
        cut(gr, cutter_box(f'grip_rib{i}', (0.046, 0.004, 0.06), (0, -0.04 - i * 0.016, 0.06 + i * 0.003), rot=(0.2, 0, 0)))
    box('sight', (0.008, 0.008, 0.02), (0, 0.078, -0.05), m['poly'], 0.001)
    marker('muzzle', (0, 0.045, -0.25))
    marker('left_hand', (-0.03, -0.075, 0.02))
    return {}

# ---------------------------------------------------------------- melee (hand at origin, blade toward +y)
def mm():
    m = K.std_mats()
    m['blade'] = K.material('M_Blade', '#c9ced6', 1.0, 0.16)
    m['edge'] = K.material('M_Edge', '#eef2f6', 1.0, 0.08)
    m['wood'] = K.material('M_Wood', '#6a3e22', 0.0, 0.5, coat=0.3)
    m['wrap'] = K.material('M_Wrap', '#1b1c22', 0.0, 0.8)
    return m

def blade(name, pts, thick, mat, x=0.0):
    """Blade slab from a side profile [(z, y)], with a heavy chamfer so the edges read as ground."""
    return prism(name, pts, thick, mat, x=x, bevel=thick * 0.42, seg=1)

def knife():
    """Balisong: two channel handles (they pivot for the flip inspect), latch, tanto-ish blade."""
    m = mm()
    blade('blade', [(0.006, 0.064), (0.006, 0.17), (0.0, 0.188), (-0.011, 0.178), (-0.011, 0.07), (-0.006, 0.062)], 0.0035, m['blade'])
    box('tang_pin', (0.016, 0.006, 0.006), (0, 0.066, 0), m['bright'], 0.0015)
    for nm, z in (('handle_a', 0.0068), ('handle_b', -0.0068)):
        g = group(nm, at=(0, 0.064, z))
        h = box(nm + '_body', (0.016, 0.13, 0.008), (0, 0.0, z), m['body'], 0.002, seg=2)
        for i in range(4):
            cut(h, cutter_cyl(f'{nm}_hole{i}', 0.0032, 0.03, (0, -0.045 + i * 0.026, z), axis='x', segs=12))
        cap = box(nm + '_cap', (0.017, 0.008, 0.0085), (0, -0.064, z), m['steel'], 0.002)
        pin = cyl(nm + '_pin', 0.0035, 0.018, (0, 0.06, z), m['bright'], axis='x', segs=12)
        parts = [h, cap, pin]
        if nm == 'handle_a': parts.append(box('latch', (0.006, 0.03, 0.004), (0, -0.06, z + 0.006), m['bright'], 0.001))
        reparent(parts, g)
    marker('tip', (0, 0.19, 0))
    return {}

def karambit():
    """Karambit: hooked claw blade, finger ring at the pommel, textured grip scales."""
    m = mm()
    blade('blade', [(0.008, 0.055), (-0.004, 0.09), (-0.026, 0.125), (-0.058, 0.142), (-0.07, 0.136), (-0.05, 0.12), (-0.024, 0.098),
                    (-0.012, 0.07), (-0.012, 0.05)], 0.004, m['blade'])
    hd = prism('handle', [(0.012, 0.055), (0.014, 0.0), (0.008, -0.05), (-0.014, -0.05), (-0.016, 0.0), (-0.014, 0.055)], 0.018, m['poly'], bevel=0.004, seg=3)
    for i in range(5):
        cut(hd, cutter_box(f'groove{i}', (0.024, 0.003, 0.04), (0, -0.035 + i * 0.018, 0), rot=(0.4, 0, 0)))
    # finger ring: a loop of short rods in the blade plane (y-z), below the grip
    N = 16
    ringp = [(0, -0.075 + math.sin(i / N * 2 * PI) * 0.019, math.cos(i / N * 2 * PI) * 0.019) for i in range(N + 1)]
    for i in range(N):
        rod(f'ring{i}', ringp[i], ringp[i + 1], 0.0045, m['steel'])
    for y in (0.0, 0.035):
        cyl(f'pin{y}', 0.003, 0.02, (0, y, 0), m['bright'], axis='x', segs=10)
    marker('tip', (0, 0.142, -0.07))
    return {}

def rapier():
    """Rapier: swept hilt (knuckle bow, side rings, quillons), wire-wrapped grip, long thin blade."""
    m = mm()
    gold = K.material('M_Hilt', '#b9933f', 1.0, 0.28)
    blade('blade', [(0.006, 0.09), (0.004, 0.75), (0.0, 0.98), (-0.004, 0.75), (-0.006, 0.09)], 0.005, m['blade'])
    box('ricasso', (0.008, 0.04, 0.016), (0, 0.105, 0), m['blade'], 0.001)
    grip = cyl('grip', 0.012, 0.11, (0, 0.0, 0), m['wrap'], axis='y', segs=16)
    for i in range(10):
        cyl(f'wire{i}', 0.0128, 0.003, (0, -0.045 + i * 0.01, 0), gold, axis='y', segs=16, bevel=0)
    cyl('ferrule', 0.014, 0.012, (0, 0.06, 0), gold, axis='y', segs=16)
    import bmesh as _bm
    cyl('pommel', 0.02, 0.026, (0, -0.07, 0), gold, axis='y', segs=24, r2=0.012)
    box('quillons', (0.2, 0.01, 0.01), (0, 0.075, 0), gold, 0.004, seg=2)
    for sx in (-1, 1):
        cyl(f'quillon_end{sx}', 0.009, 0.014, (sx * 0.1, 0.075, 0), gold, axis='x', segs=12)
    # knuckle bow: arc from the guard down to the pommel, in front of the fingers
    pts = [(0.075 - 0.145 * t, math.sin(t * PI) * 0.055) for t in [i / 8 for i in range(9)]]
    for i in range(8):
        (y0, z0), (y1, z1) = pts[i], pts[i + 1]
        rod(f'bow{i}', (0, y0, -z0), (0, y1, -z1), 0.0045, gold)
    for sx in (-1, 1):
        tor = cyl(f'side_ring{sx}', 0.03, 0.006, (sx * 0.02, 0.085, -0.012), gold, axis='y', segs=24)
        cut(tor, cutter_cyl(f'side_ring_hole{sx}', 0.024, 0.04, (sx * 0.02, 0.085, -0.012), axis='y', segs=20))
    marker('tip', (0, 0.98, 0))
    return {}

def bat():
    """Wooden baseball bat with a knob, tapered handle wrapped in grip tape, and a sticker band."""
    m = mm()
    ash = K.material('M_Wood', '#c89a62', 0.0, 0.42, coat=0.6)
    tape = K.material('M_Tape', '#141414', 0.0, 0.9)
    tape2 = K.material('M_Tape2', '#e8e8e8', 0.0, 0.85)
    cyl('knob', 0.03, 0.016, (0, -0.125, 0), ash, axis='y', segs=32, r2=0.017)
    cyl('handle', 0.0135, 0.32, (0, 0.04, 0), ash, axis='y', segs=24, r2=0.019)
    cyl('taper', 0.019, 0.16, (0, 0.28, 0), ash, axis='y', segs=32, r2=0.033)
    cyl('barrel', 0.033, 0.32, (0, 0.52, 0), ash, axis='y', segs=40, r2=0.034)
    cyl('cap', 0.034, 0.01, (0, 0.685, 0), ash, axis='y', segs=40, r2=0.03)
    # grip tape: angled overlapping wraps up the handle, plus a white tape band near the barrel
    for i in range(12):
        y = -0.105 + i * 0.016
        r_h = 0.0135 + (y + 0.12) / 0.32 * 0.0055
        cyl(f'tape{i}', r_h + 0.0011, 0.0155, (0, y, 0), tape, axis='y', segs=24, rot=(0.12, 0, 0.0), bevel=0.0006)
    for i in range(3):
        cyl(f'band{i}', 0.0335, 0.012, (0, 0.44 + i * 0.011, 0), tape2, axis='y', segs=40, rot=(0.06, 0, 0), bevel=0.0005)
    box('label', (0.002, 0.05, 0.03), (0.033, 0.56, 0), K.material('M_Label', '#1c3d8a', 0.0, 0.5), 0.0005)
    marker('tip', (0, 0.69, 0))
    return {}

def shard():
    """Crystal Shard: a small kitchen-knife silhouette cut from clear crystal (faceted, all glass)."""
    m = mm()
    glass = K.material('M_GlassWeapon', '#d8f4ff', 0.0, 0.02, alpha=0.3)
    blade('blade', [(0.006, 0.05), (0.006, 0.14), (-0.002, 0.2), (-0.03, 0.08), (-0.03, 0.05)], 0.006, glass)
    prism('handle', [(0.008, 0.05), (0.012, 0.0), (0.008, -0.052), (-0.016, -0.054), (-0.02, 0.0), (-0.016, 0.05)], 0.02, glass, bevel=0.005, seg=2)
    box('bolster', (0.022, 0.008, 0.04), (0, 0.05, -0.006), glass, 0.003)
    box('core', (0.004, 0.06, 0.004), (0, 0.11, -0.01), K.material('M_Core', '#9ff0ff', 0, 0.2, emit=('#7fe8ff', 2.5)), 0.001)
    marker('tip', (0, 0.2, 0))
    return {}

def katana():
    """Katana: diamond-wrapped tsuka, round tsuba, brass habaki, curved blade with a hamon line."""
    m = mm()
    brass = K.material('M_Hilt', '#a8843c', 1.0, 0.3)
    sori = lambda t: 0.035 * t * t
    spine = [(sori(t) * 1.0 - 0.0, 0.17 + 0.86 * t) for t in [i / 10 for i in range(11)]]
    edge = [(z - 0.03 * (1 - t * 0.35), y) for (z, y), t in zip(spine, [i / 10 for i in range(11)])]
    tip = (spine[-1][0] - 0.012, spine[-1][1] + 0.04)
    pts = [(z + 0.0, y) for z, y in spine] + [tip] + [(z, y) for z, y in edge[::-1]]
    blade('blade', [(-z, y) for z, y in pts], 0.007, m['blade'])
    hamon = [(-(z - 0.022 + 0.003 * math.sin(i * 1.7)), y) for i, (z, y) in enumerate(edge)]
    box('habaki', (0.012, 0.03, 0.036), (0, 0.18, 0.012), brass, 0.002)
    tsuba = cyl('tsuba', 0.045, 0.008, (0, 0.16, 0.01), m['steel'], axis='y', segs=32)
    for i in range(4):
        a = i * PI / 2 + PI / 4
        cut(tsuba, cutter_cyl(f'tsuba_hole{i}', 0.008, 0.03, (math.cos(a) * 0.03, 0.16, 0.01 + math.sin(a) * 0.03), axis='y', segs=12))
    cyl('tsuka', 0.017, 0.27, (0, 0.02, 0.0), K.material('M_Same', '#e8e0cc', 0.0, 0.7), axis='y', segs=16)
    for i in range(9):
        box(f'ito{i}', (0.036, 0.016, 0.006), (0, -0.095 + i * 0.027, 0), m['wrap'], 0.002, rot=(0, 0.0, 0.6 if i % 2 else -0.6))
    cyl('kashira', 0.019, 0.016, (0, -0.122, 0), brass, axis='y', segs=16)
    marker('tip', (0, 1.06, -0.03))
    return {}

def doubleedge():
    """Double-edged longsword: diamond-section blade with a fuller, steel crossguard, leather grip, pommel."""
    m = mm()
    blade('blade', [(0.022, 0.13), (0.019, 0.7), (0.0, 0.84), (-0.019, 0.7), (-0.022, 0.13)], 0.008, m['blade'])
    cut(K.bpy.data.objects['blade'], cutter_box('fuller_r', (0.004, 0.42, 0.008), (0.004, 0.38, 0)))
    cut(K.bpy.data.objects['blade'], cutter_box('fuller_l', (0.004, 0.42, 0.008), (-0.004, 0.38, 0)))
    box('guard', (0.24, 0.02, 0.026), (0, 0.11, 0), m['steel'], 0.006, seg=3)
    for sx in (-1, 1):
        box(f'guard_tip{sx}', (0.024, 0.03, 0.03), (sx * 0.12, 0.112, 0), m['steel'], 0.006, seg=3)
    cyl('grip', 0.016, 0.22, (0, -0.01, 0), K.material('M_Leather', '#3a2416', 0.0, 0.7), axis='y', segs=16)
    for i in range(6):
        cyl(f'grip_ring{i}', 0.0168, 0.004, (0, -0.1 + i * 0.036, 0), K.material('M_Leather2', '#2a190f', 0.0, 0.7), axis='y', segs=16)
    p = cyl('pommel', 0.026, 0.03, (0, -0.135, 0), m['steel'], axis='z', segs=24)
    marker('tip', (0, 0.84, 0))
    return {}

def scythe():
    """War scythe: curved ash snath with a side handle, steel collar, long crescent blade with a bevel."""
    m = mm()
    ash = K.material('M_Wood', '#7a5233', 0.0, 0.5, coat=0.25)
    pts = [(math.sin(t * 1.2) * 0.04, -0.4 + 1.42 * t) for t in [i / 12 for i in range(13)]]
    for i in range(12):
        (z0, y0), (z1, y1) = pts[i], pts[i + 1]
        rod(f'snath{i}', (0, y0, z0), (0, y1, z1), 0.018, ash, segs=14)
    cyl('nib', 0.012, 0.12, (0.06, 0.35, 0.0), ash, axis='x', segs=12)
    cyl('nib_grip', 0.014, 0.06, (0.11, 0.35, 0.0), m['wrap'], axis='x', segs=12)
    top = pts[-1]
    cyl('collar', 0.024, 0.06, (0, top[1] - 0.02, top[0]), m['steel'], axis='y', segs=20)
    cyl('end_cap', 0.022, 0.02, (0, top[1] + 0.02, top[0]), m['steel'], axis='y', segs=20)
    # crescent: outer arc and inner arc in the x-y plane (blade sweeps to the left, edge facing down)
    cx, cy, R = -0.32, top[1] - 0.14, 0.36
    outer = [(cx + math.cos(a) * R, cy + math.sin(a) * R) for a in [0.35 + i * 0.22 for i in range(11)]]
    inner = [(cx + math.cos(a) * (R - 0.07 * (1 - i / 11)), cy - 0.02 + math.sin(a) * (R - 0.07 * (1 - i / 11)) * 0.9) for i, a in enumerate([0.35 + i * 0.22 for i in range(11)])]
    import bmesh as _bm
    bm = _bm.new(); th = 0.006
    loop = outer + [(outer[-1][0] - 0.02, outer[-1][1] - 0.03)] + inner[::-1]
    vs = [bm.verts.new(K.B(x, y, -th / 2)) for x, y in loop]
    f = bm.faces.new(vs)
    r = _bm.ops.extrude_face_region(bm, geom=[f]); nv = [e for e in r['geom'] if isinstance(e, _bm.types.BMVert)]
    _bm.ops.translate(bm, verts=nv, vec=K.B(0, 0, th) - K.B(0, 0, 0)); _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    bl = K._link('blade', bm, m['blade']); K.finish(bl, th * 0.42, 1)
    box('blade_tang', (0.05, 0.04, 0.012), (-0.02, top[1] - 0.02, top[0]), m['steel'], 0.003)
    marker('tip', (outer[-1][0], outer[-1][1], 0))
    return {}

def hammer():
    """Sledgehammer: forged steel head with chamfered striking faces, fiberglass handle, rubber grip."""
    m = mm()
    fg = K.material('M_Furniture', '#e0a020', 0.0, 0.45, coat=0.4)
    cyl('handle', 0.018, 0.62, (0, 0.2, 0), fg, axis='y', segs=20)
    cyl('grip', 0.021, 0.2, (0, -0.02, 0), m['rubber'], axis='y', segs=20)
    for i in range(6):
        cyl(f'grip_rib{i}', 0.0222, 0.006, (0, -0.1 + i * 0.03, 0), m['rubber'], axis='y', segs=20)
    cyl('end', 0.024, 0.02, (0, -0.125, 0), m['rubber'], axis='y', segs=20)
    hd = box('head', (0.27, 0.12, 0.12), (0, 0.5, 0), m['steel'], 0.012, seg=2)
    for sx in (-1, 1):
        cyl(f'face{sx}', 0.056, 0.03, (sx * 0.145, 0.5, 0), m['bright'], axis='x', segs=8, rot=(PI / 8, 0, 0), bevel=0.006)
    box('wedge', (0.03, 0.006, 0.02), (0, 0.562, 0), m['steel'], 0.001)
    marker('tip', (0, 0.58, 0))
    return {}

def axe():
    """Felling axe: hickory haft with a swell, forged head with a bearded bit and a polished edge."""
    m = mm()
    hickory = K.material('M_Wood', '#8a5a32', 0.0, 0.48, coat=0.3)
    cyl('haft', 0.016, 0.6, (0, 0.17, 0), hickory, axis='y', segs=16)
    cyl('swell', 0.021, 0.06, (0, -0.1, 0), hickory, axis='y', segs=16, r2=0.016)
    hd = prism('head', [(0.03, 0.39), (0.03, 0.45), (-0.04, 0.455), (-0.13, 0.5), (-0.15, 0.48), (-0.15, 0.34), (-0.13, 0.33), (-0.06, 0.38), (-0.03, 0.39)], 0.034, m['steel'], bevel=0.004, seg=2)
    edge = blade('edge', [(-0.13, 0.495), (-0.152, 0.48), (-0.152, 0.34), (-0.13, 0.335), (-0.138, 0.34), (-0.138, 0.48)], 0.012, m['edge'])
    cyl('eye_wedge', 0.006, 0.04, (0, 0.47, 0.0), m['bright'], axis='y', segs=10)
    marker('tip', (0, 0.48, -0.15))
    return {}

BUILD = {'striker': striker, 'triburst': triburst, 'wasp': wasp, 'breacher': breacher, 'twinfang': twinfang,
         'longshot': longshot, 'quill': quill, 'buzzsaw': buzzsaw,
         'sidekick': sidekick, 'judge': judge, 'glasscannon': glasscannon, 'hornet': hornet, 'boomer': boomer, 'signal': signal,
         'knife': knife, 'karambit': karambit, 'rapier': rapier, 'bat': bat, 'shard': shard, 'katana': katana,
         'doubleedge': doubleedge, 'scythe': scythe, 'hammer': hammer, 'axe': axe}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ids = [a for a in argv if not a.startswith('--')] or list(BUILD)
    report = {}
    for gid in ids:
        K.reset(); K.MATS.clear(); K.root('Gun_' + gid)
        info = BUILD[gid]()
        st = K.stats()
        size = K.export(os.path.join(ROOT_DIR, 'public', 'models', gid + '.glb'))
        shots = [] if '--no-render' in argv else K.render_review(os.path.join(ROOT_DIR, 'tools', 'blender', 'review', gid + '.png'))
        report[gid] = {**st, 'glb_kb': round(size / 1024), 'shots': shots, **info}
    print('@@JSON@@' + json.dumps(report))
