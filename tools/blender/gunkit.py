# Gun modeling kit for BDN Duels (Blender 4.5+, headless).
# Parts are given in GAME coordinates (three.js viewmodel space, meters): x right, y up, z back (+)
# so the barrel points to -z, and the origin is where the right hand grips. That matches
# src/weapons/models.js, so anchors (muzzle, mag, left hand) line up with the old builders.
# Blender is Z-up, -Y forward-ish; we map game (x, y, z) -> blender (x, -z, y), and the glTF
# exporter's +Y-up conversion maps it straight back.
#
# Workflow per gun (blender-hardsurface-modeling, mid-poly): primitives/profiles -> boolean cuts ->
# Bevel (angle, harden normals) -> Weighted Normal; PBR values from blender-pbr-materials.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

def B(x, y, z): return Vector((x, -z, y))

# ---------------------------------------------------------------- scene
def reset():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for d in list(c): c.remove(d)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    global ROOT, CUT
    CUT = bpy.data.collections.new('Cutters'); sc.collection.children.link(CUT)
    CUT.hide_render = True
    ROOT = None

def root(name):
    global ROOT
    ROOT = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(ROOT)
    return ROOT

# ---------------------------------------------------------------- materials (linear values)
MATS = {}
def material(name, color, metal=0.0, rough=0.5, emit=None, alpha=1.0, coat=0.0):
    # same name again = override the earlier definition (a gun can restyle its furniture after std_mats)
    m = MATS.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = srgb(color)
    bsdf.inputs['Base Color'].default_value = (*c, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if coat and 'Coat Weight' in bsdf.inputs: bsdf.inputs['Coat Weight'].default_value = coat
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*srgb(emit[0]), 1)
        bsdf.inputs['Emission Strength'].default_value = emit[1]
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    MATS[name] = m
    return m

def srgb(hexcol):
    h = hexcol.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

# Standard gun materials. Names are roles the game reads (wraps repaint Body/Furniture/Accent).
def std_mats(furniture='#2a2b2e', accent='#3a3d42'):
    return {
        'body': material('M_Body', '#3a3e45', 0.75, 0.38),          # hard-anodized aluminum
        'furn': material('M_Furniture', furniture, 0.0, 0.55),       # polymer furniture
        'poly': material('M_Polymer', '#202124', 0.0, 0.68),          # black polymer
        'steel': material('M_Steel', '#3b3e43', 1.0, 0.3),           # parkerized steel
        'bright': material('M_Bright', '#b8bdc4', 1.0, 0.18),        # bare / polished steel
        'accent': material('M_Accent', accent, 0.6, 0.4),
        'rubber': material('M_Rubber', '#121212', 0.0, 0.85),
        'glass': material('M_Glass', '#9fd8e8', 0.0, 0.02, alpha=0.12),
        'dot': material('M_Dot', '#ff2a3a', 0.0, 0.4, emit=('#ff1a2a', 1.5)),
        'brass': material('M_Brass', '#b08d57', 1.0, 0.28),
        'wood': material('M_Wood', '#6a3e22', 0.0, 0.48, coat=0.3),
    }

# ---------------------------------------------------------------- object helpers
def _link(name, bm, mat, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat: me.materials.append(mat)
    ob.parent = parent or ROOT
    return ob

def smooth(ob):
    me = ob.data
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()

def finish(ob, bevel=0.0012, seg=2, angle=30, wn=True):
    """Mid-poly stack: Bevel (angle, harden) -> Weighted Normal, smooth shading."""
    if bevel > 0:
        m = ob.modifiers.new('Bevel', 'BEVEL')
        m.width = bevel; m.segments = seg; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle)
        m.use_clamp_overlap = True; m.harden_normals = True; m.miter_outer = 'MITER_ARC'
    if wn:
        w = ob.modifiers.new('WeightedNormal', 'WEIGHTED_NORMAL'); w.keep_sharp = True; w.weight = 50; w.mode = 'FACE_AREA'
    smooth(ob)
    return ob

def prism(name, pts, width, mat, x=0.0, bevel=0.0012, seg=2, parent=None, taper=None):
    """Side-profile extrusion. pts = [(z, y), ...] in game space (outline, either winding),
    extruded symmetrically along x around `x`. taper=(sx_front...) not used; keep simple."""
    bm = bmesh.new()
    vs = [bm.verts.new(B(x - width / 2, y, z)) for z, y in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=Vector((width, 0, 0)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _link(name, bm, mat, parent)
    return finish(ob, bevel, seg)

def box(name, size, center, mat, bevel=0.0012, seg=2, parent=None, rot=None):
    """size/center in game space (sx, sy, sz). rot = (rx, ry, rz) radians, game axes."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((size[0], size[2], size[1])), verts=bm.verts)
    if rot: bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=_rotm(rot))
    bmesh.ops.translate(bm, vec=B(*center), verts=bm.verts)
    ob = _link(name, bm, mat, parent)
    return finish(ob, bevel, seg)

def _rotm(rot):
    rx, ry, rz = rot  # game-space Euler -> blender: game x = bl x, game y = bl z, game z = -bl y
    return (Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(-rz, 4, 'Y') @ Matrix.Rotation(ry, 4, 'Z')).to_3x3()

def cyl(name, r, length, center, mat, axis='z', segs=24, r2=None, bevel=0.0008, seg=2, parent=None, rot=None):
    """Cylinder/cone along a game axis ('z' = barrel axis). r2 = radius at the -z / +y / +x end."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=length)
    # created along blender Z; radius2 at +Z
    if axis == 'z': M = Matrix.Rotation(-math.pi / 2, 3, 'X')   # bl +Z -> bl +Y (game -z)
    elif axis == 'x': M = Matrix.Rotation(math.pi / 2, 3, 'Y')  # bl +Z -> bl +X
    else: M = Matrix.Identity(3)                                # game y = bl z
    bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=M)
    if rot: bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=_rotm(rot))
    bmesh.ops.translate(bm, vec=B(*center), verts=bm.verts)
    ob = _link(name, bm, mat, parent)
    return finish(ob, bevel, seg)

def rod(name, p0, p1, r, mat, segs=12, parent=None, bevel=0.0):
    """Cylinder between two game-space points (strings, struts, wires)."""
    a, b = B(*p0), B(*p1); d = b - a
    ext = d.normalized() * r * 0.9; a, b = a - ext, b + ext; d = b - a  # overlap neighbours (no gaps)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=d.length)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=q.to_matrix())
    bmesh.ops.translate(bm, vec=(a + b) / 2, verts=bm.verts)
    ob = _link(name, bm, mat, parent)
    return finish(ob, bevel, 1)

def tube(name, r_out, r_in, length, center, mat, axis='z', segs=32, parent=None, bevel=0.0006):
    ob = cyl(name, r_out, length, center, mat, axis, segs, bevel=0, parent=parent)
    c = cyl(name + '_bore', r_in, length + 0.01, center, None, axis, segs, bevel=0, parent=None)
    cut(ob, c)
    return ob

def cut(ob, cutter):
    """Boolean difference (EXACT), placed before the bevel so cut edges get beveled too."""
    for col in cutter.users_collection: col.objects.unlink(cutter)
    CUT.objects.link(cutter); cutter.parent = None
    cutter.display_type = 'WIRE'; cutter.hide_render = True
    for m in list(cutter.modifiers): cutter.modifiers.remove(m)
    m = ob.modifiers.new('Cut_' + cutter.name, 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.solver = 'EXACT'; m.object = cutter
    # move boolean above bevel/weighted normal
    i = list(ob.modifiers).index(m)
    first = next((k for k, mm in enumerate(ob.modifiers) if mm.type in ('BEVEL', 'WEIGHTED_NORMAL')), i)
    while i > first: ob.modifiers.move(i, i - 1); i -= 1
    return ob

def cutter_box(name, size, center, rot=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((size[0], size[2], size[1])), verts=bm.verts)
    if rot: bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=_rotm(rot))
    bmesh.ops.translate(bm, vec=B(*center), verts=bm.verts)
    return _link(name, bm, None, None)

def cutter_cyl(name, r, length, center, axis='x', segs=16):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=length)
    M = Matrix.Rotation(-math.pi / 2, 3, 'X') if axis == 'z' else Matrix.Rotation(math.pi / 2, 3, 'Y') if axis == 'x' else Matrix.Identity(3)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=M)
    bmesh.ops.translate(bm, vec=B(*center), verts=bm.verts)
    return _link(name, bm, None, None)

def slots(ob, n, size, start, step, axis='x', prefix='slot'):
    """n rounded slot cutters (capsule-ish via boxes) from `start`, spaced by game-space `step`."""
    for i in range(n):
        c = [start[k] + step[k] * i for k in range(3)]
        cut(ob, cutter_box(f'{prefix}{i}_{ob.name}', size, c))

def array(ob, count, step):
    m = ob.modifiers.new('Array', 'ARRAY'); m.count = count
    m.use_relative_offset = False; m.use_constant_offset = True; m.constant_offset_displace = B(*step)
    i = list(ob.modifiers).index(m)
    while i > 0: ob.modifiers.move(i, i - 1); i -= 1
    return ob

def rail(name, length, center, mat, width=0.021, parent=None):
    """Picatinny rail along z: base + crosswise ribs every 10 mm."""
    zc = center[2]
    base = box(name, (width * 0.75, 0.006, length), (center[0], center[1], zc), mat, 0.0006, parent=parent)
    n = int(length / 0.01)
    rib = box(name + '_ribs', (width, 0.0045, 0.0052), (center[0], center[1] + 0.005, zc + length / 2 - 0.005), mat, 0.0005, parent=parent)
    array(rib, n, (0, 0, -0.01))
    return base

def group(name, parent=None, at=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
    e.parent = parent or ROOT; e.location = B(*at)
    return e

def reparent(obs, parent):
    bpy.context.view_layer.update()
    for o in obs:
        mw = o.matrix_world.copy(); o.parent = parent; o.matrix_world = mw

def marker(name, at):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
    e.parent = ROOT; e.location = B(*at); e.empty_display_size = 0.01
    return e

# ---------------------------------------------------------------- output
def stats():
    dg = bpy.context.evaluated_depsgraph_get(); tris = 0; n = 0
    for o in bpy.context.scene.objects:
        if o.type != 'MESH' or o.hide_render or CUT in o.users_collection: continue
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); n += 1
        o.evaluated_get(dg).to_mesh_clear()
    return {'objects': n, 'tris': tris}

def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if CUT not in o.users_collection: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_normals=True, export_materials='EXPORT', export_extras=False)
    return os.path.getsize(path)

def render_review(path, res=(1600, 900)):
    """Studio look-dev render: side view + three-quarter, soft key/fill/rim, neutral grey sweep."""
    sc = bpy.context.scene
    for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = e; break
        except TypeError: pass
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError: pass
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.film_transparent = False
    try: sc.eevee.taa_render_samples = 64
    except Exception: pass
    w = bpy.data.worlds.get('W') or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.32, 0.34, 0.37, 1); bg.inputs[1].default_value = 0.6
    bpy.context.view_layer.update()
    # tall items (melee) are laid flat for the review shot, blade pointing forward
    pts0 = [o.matrix_world @ Vector(c) for o in sc.objects if o.type == 'MESH' and CUT not in o.users_collection for c in o.bound_box]
    if ROOT and max(p.z for p in pts0) - min(p.z for p in pts0) > max(p.y for p in pts0) - min(p.y for p in pts0):
        ROOT.rotation_euler = (math.radians(90), 0, 0); bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in sc.objects if o.type == 'MESH' and CUT not in o.users_collection for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (lo + hi) / 2; size = (hi - lo).length
    def light(name, loc, energy, sz):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.size = sz
        o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.location = ctr + Vector(loc) * size
        o.rotation_euler = (ctr - o.location).to_track_quat('-Z', 'Y').to_euler()
    light('Key', (1.2, -1.0, 1.4), 200 * size * size, size * 1.2)
    light('Fill', (-1.4, -0.6, 0.4), 70 * size * size, size * 1.6)
    light('Rim', (-0.2, 1.4, 1.0), 180 * size * size, size * 0.8)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 85
    out = []
    for tag, d in (('side', Vector((1, 0, 0.05))), ('3q', Vector((0.9, 0.75, 0.45)))):
        cam.location = ctr + d.normalized() * size * 2.45
        cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
        p = path.replace('.png', f'_{tag}.png'); sc.render.filepath = p
        bpy.ops.render.render(write_still=True); out.append(p)
    return out
