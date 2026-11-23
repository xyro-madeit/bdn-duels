import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Turns a map's block list into colliders + merged meshes, one per surface type.
// Each block gets world-scale UVs (box-projected, 1 texture tile = 2 m) so textures never stretch,
// and its palette color as a vertex tint over a neutral procedural detail texture.
const SURFACE = { ground: 'concrete', wall: 'concrete', trim: 'concrete', a: 'container', c: 'container', b: 'wood', d: 'steel' };

export function buildMap(scene, world, map) {
  world.clear();
  const group = new THREE.Group();
  const buckets = {};
  const col = new THREE.Color();
  // decor blocks render but don't collide (skylines, distant mountains)
  const all = map.blocks.map((b) => [...b, true]).concat((map.decor || []).map((b) => [...b, false]));
  for (const [x0, y0, z0, x1, y1, z1, key, solid] of all) {
    if (solid) world.add([x0, y0, z0], [x1, y1, z1]);
    if (key === 'ground') continue;
    const surf = (map.surfaces && map.surfaces[key]) || SURFACE[key] || 'concrete';
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const colors = new Float32Array(pos.count * 3);
    col.set(map.palette[key] || '#888888');
    const jitter = 0.94 + (Math.abs(Math.sin(x0 * 12.9 + z0 * 78.2 + y0 * 3.7)) * 0.12);
    const tile = surf === 'container' ? 2.6 : 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      // box projection: pick the plane facing the normal
      if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
      else if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
      else uv.setXY(i, x / tile, y / tile);
      let k = jitter;
      if (ny < 0.5 && y - y0 < 0.01) k *= 0.7; // contact shadow at the base
      colors[i * 3] = col.r * k; colors[i * 3 + 1] = col.g * k; colors[i * 3 + 2] = col.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (buckets[surf] || (buckets[surf] = [])).push(g);
  }
  for (const surf in buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(buckets[surf]), surfaceMaterial(surf));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // the void eliminates you only well below the arena (falling a few seconds first)
  world.killY = (map.killY ?? -25) - 30;
  if (map.noGround) {
    // chasm maps: a dim floor far below for depth (not solid; falling past killY eliminates)
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 1 }));
    deep.rotation.x = -Math.PI / 2; deep.position.y = world.killY - 12;
    group.add(deep);
    scene.add(group);
    return group;
  }
  // ground: big concrete slab with expansion joints every 4 m
  const gmat = surfaceMaterial('floor');
  gmat.color.set(map.palette.ground);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), gmat);
  ground.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 11; });
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  scene.add(group);
  return group;
}

// ---------- procedural textures (generated once, cached)
const CACHE = {};
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function noise(g, s, n, a, light = false) { for (let i = 0; i < n; i++) { const v = light ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; const r = Math.random() * 2.5 + 0.5; g.fillRect(Math.random() * s, Math.random() * s, r, r); } }
function stains(g, s, n) { for (let i = 0; i < n; i++) { const x = Math.random() * s, y = Math.random() * s, r = 20 + Math.random() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${0.04 + Math.random() * 0.06})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }

function surfaceMaterial(kind) {
  if (CACHE[kind]) return CACHE[kind].clone();
  let map, rough = 0.85, metal = 0;
  if (kind === 'concrete' || kind === 'floor') {
    map = canvasTex(256, (g, s) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, s, s);
      stains(g, s, 10); noise(g, s, 4000, 0.08); noise(g, s, 1500, 0.08, true);
      if (kind === 'floor') { g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); }
      else { g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 4; i++) g.fillRect(Math.random() * s, 0, 1, s); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, s - 3, s, 3); }
    });
  } else if (kind === 'container') {
    rough = 0.6; metal = 0.45;
    map = canvasTex(256, (g, s) => {
      g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, s, s);
      // corrugation: vertical ribs
      for (let x = 0; x < s; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(255,255,255,.18)'); g.fillStyle = gr; g.fillRect(x, 0, 16, s); }
      stains(g, s, 8); noise(g, s, 2500, 0.08);
      g.fillStyle = 'rgba(120,60,20,.12)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 6, 8 + Math.random() * 30); // rust streaks
    });
  } else if (kind === 'wood') {
    rough = 0.75;
    map = canvasTex(256, (g, s) => {
      g.fillStyle = '#d6c4a4'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 32) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`; g.fillRect(0, y, s, 32); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, s, 2); }
      for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(80,50,20,${Math.random() * 0.12})`; g.beginPath(); const y = Math.random() * s; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + Math.random() * 6 - 3, (2 * s) / 3, y + Math.random() * 6 - 3, s, y); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, 4, s); g.fillRect(s - 4, 0, 4, s); // frame edges
    });
  } else { // steel
    rough = 0.45; metal = 0.8;
    map = canvasTex(256, (g, s) => { g.fillStyle = '#c4c6ca'; g.fillRect(0, 0, s, s); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(0, Math.random() * s, s, 1); } noise(g, s, 1500, 0.07); stains(g, s, 6); });
  }
  CACHE[kind] = new THREE.MeshStandardMaterial({ map, vertexColors: kind !== 'floor', roughness: rough, metalness: metal });
  return CACHE[kind].clone();
}
