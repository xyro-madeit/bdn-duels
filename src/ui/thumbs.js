import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildGun } from '../weapons/models.js';

// Renders every weapon's 3D model to a transparent side-view image (data URL) for the menus.
// One small offscreen renderer, orthographic camera framed to each model's bounding box.
// items: weapon defs, or { key, def, cos } variants (e.g. a gun with a wrap) keyed by `key`
export function renderThumbs(defs, w = 360, h = 180) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(r);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 1.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 1.4); rim.position.set(-2, 1, -2); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  const out = {};
  for (const item of defs) {
    const def = item.def || item, key = item.key || def.id;
    const gun = buildGun(def, item.cos || null);
    const holder = new THREE.Group();
    holder.add(gun.group);
    // guns lie flat pointing right; melee/utility tilted for a nice diagonal
    if (gun.melee) gun.group.rotation.set(-0.85, 0, 0);
    if (def.id === 'fists') { const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.85 })); gun.group.add(f); }
    holder.rotation.y = Math.PI / 2 - 0.25; // barrel points screen-right, with a hint of 3/4 view
    scene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const half = Math.max(s.x / 2 / (w / h), s.y / 2) * 1.12;
    cam.left = -half * (w / h); cam.right = half * (w / h); cam.top = half; cam.bottom = -half;
    cam.position.set(c.x, c.y + 0.02, c.z + 5); cam.lookAt(c.x, c.y, c.z);
    cam.updateProjectionMatrix();
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, cam);
    out[key] = canvas.toDataURL('image/png');
    scene.remove(holder);
  }
  r.dispose();
  pmrem.dispose();
  return out;
}
