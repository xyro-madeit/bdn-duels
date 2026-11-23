import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glassMaterial } from '../fx/glass.js';
import { addDetail } from '../fx/detail.js';

// Detailed weapon models built in Blender (tools/blender/guns.py) and exported as GLB to
// public/models/<id>.glb. They're optional: until a model has loaded (or if it's missing), the
// game uses the procedural box model from models.js.
// Node names the game reads: mag / pump / bolt / spin / string (animated parts), muzzle and
// left_hand (anchor markers). Material names map to cosmetic roles so wraps still apply.
export const MODEL_IDS = ['striker', 'triburst', 'wasp', 'breacher', 'twinfang', 'longshot', 'quill', 'buzzsaw', 'glasscannon',
  'sidekick', 'judge', 'hornet', 'boomer', 'signal',
  'knife', 'karambit', 'rapier', 'bat', 'shard', 'katana', 'doubleedge', 'scythe', 'hammer', 'axe'];
const cache = {};
export const ROLE_BY_MATERIAL = { M_Body: 'body', M_Furniture: 'wrap', M_Accent: 'accent', M_Blade: 'steel' };

export function preloadModels(onEach) {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL + 'models/';
  return Promise.all(MODEL_IDS.map((id) => {
    const src = (window.__BDN_MODELS && window.__BDN_MODELS[id]) || base + id + '.glb';
    return loader.loadAsync(src).then((g) => {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (o.material && o.material.name === 'M_GlassWeapon') { o.material = glassMaterial(); o.castShadow = false; o.renderOrder = 2; }
        else addDetail(o.material);
      });
      cache[id] = mergeStatic(g.scene);
      onEach && onEach(id);
    }).catch((e) => console.warn('model', id, e.message));
  }));
}

export const hasModel = (id) => !!cache[id];

// A fresh copy of the model plus its anchors, or null if it isn't loaded.
export function cloneModel(id) {
  const src = cache[id];
  if (!src) return null;
  const g = src.clone(true);
  const find = (n) => g.getObjectByName(n) || null;
  const pos = (n) => { const o = find(n); if (!o) return null; o.updateWorldMatrix(true, false); const p = new THREE.Vector3(); o.getWorldPosition(p); return p; };
  g.updateMatrixWorld(true);
  return { group: g, mag: find('mag'), pump: find('pump'), bolt: find('bolt'), spin: find('spin'), string: find('string'), muzzle: pos('muzzle'), leftHand: pos('left_hand'), tip: pos('tip'), cyl: find('cyl'), ball: find('ball'), handleA: find('handle_a'), handleB: find('handle_b') };
}

// Draw-call diet: every mesh that isn't part of an animated group is merged with the others that
// share its material (a 45-part rifle becomes ~8 meshes; shadows halve too). Animated groups
// (mag, pump, bolt, spin, string, cylinder, ball, butterfly handles) are merged inside themselves.
const ANIMATED = new Set(['mag', 'pump', 'bolt', 'spin', 'string', 'cyl', 'ball', 'handle_a', 'handle_b']);
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const containers = [root];
  root.traverse((o) => { if (ANIMATED.has(o.name)) containers.push(o); });
  for (const c of containers) {
    const inv = new THREE.Matrix4().copy(c.matrixWorld).invert();
    const byMat = new Map();
    c.traverse((o) => {
      if (!o.isMesh) return;
      // belongs to this container only if no animated group sits between them
      let p = o.parent; while (p && p !== c && !ANIMATED.has(p.name)) p = p.parent;
      if (p !== c) return;
      const k = o.material; if (!byMat.has(k)) byMat.set(k, []); byMat.get(k).push(o);
    });
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map((o) => {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
        return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      });
      const merged = mergeGeometries(geos, false); if (!merged) continue;
      const m = new THREE.Mesh(merged, mat); m.castShadow = list[0].castShadow; m.receiveShadow = true; m.renderOrder = list[0].renderOrder;
      for (const o of list) o.parent.remove(o);
      c.add(m);
    }
  }
  return root;
}
