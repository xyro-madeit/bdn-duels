import * as THREE from 'three';

// Cosmetics: gun wraps (painted over the gun body/handguard), melee blade skins,
// avatar colors (glove cuffs in first person, visor/armband in third person) and hats.
function tex(draw, size = 128, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  return t;
}
const rnd = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
function camo(cols, seed) {
  return tex((g, s) => {
    const r = rnd(seed);
    g.fillStyle = cols[0]; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = cols[1 + (i % (cols.length - 1))];
      g.beginPath();
      const x = r() * s, y = r() * s, rr = 8 + r() * 18;
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; const d = rr * (0.6 + r() * 0.6); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
      g.fill();
    }
  });
}

// Animated cosmetics: every wrap moves a little (scrolling patterns, pulsing glow, light sweeps,
// sparkles). tickCosmetics(t) is called once per frame by the game and the locker preview.
const ANIM = [];
const anim = (m, fn) => { ANIM.push({ m, fn }); return m; };
export function tickCosmetics(t) { for (const a of ANIM) a.fn(a.m, t); }
function sparkles(n, seed, size = 256, col = '255,255,255') {
  return tex((g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s); const r = rnd(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * s, y = r() * s, z = 0.6 + r() * 1.8, a = 0.35 + r() * 0.65;
      g.fillStyle = `rgba(${col},${a})`; g.fillRect(x - z / 2, y - z / 2, z, z);
      if (r() > 0.85) { g.fillRect(x - z * 2.5, y - 0.4, z * 5, 0.8); g.fillRect(x - 0.4, y - z * 2.5, 0.8, z * 5); } // star glints
    }
  }, size);
}
// soft diagonal band of light that sweeps across (emissive overlay)
function sweep(color = '255,255,255') {
  return tex((g, s) => { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, `rgba(${color},1)`); gr.addColorStop(0.55, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 128);
}

export const WRAPS = {
  none: { name: 'Factory', desc: 'Plain finish.', mat: null },
  neon: { name: 'Neon Runner', desc: 'Teal and pink stripes that race along the gun.', mat: () => {
    const t = tex((g, s) => { g.fillStyle = '#0d0e13'; g.fillRect(0, 0, s, s); for (let i = -s; i < s * 2; i += 40) { for (const [c, w, o] of [['#2ee6c5', 7, 0], ['#ff3d7f', 4, 20]]) { g.strokeStyle = c; g.lineWidth = w; g.shadowColor = c; g.shadowBlur = 10; g.beginPath(); g.moveTo(i + o, 0); g.lineTo(i + o + s, s); g.stroke(); } } }, 256);
    return anim(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.35, metalness: 0.3 }), (m, k) => { t.offset.x = k * 0.25; m.emissiveIntensity = 0.85 + Math.sin(k * 5) * 0.25; }); } },
  arctic: { name: 'Arctic Camo', desc: 'Snow-field camo with drifting frost glints.', mat: () => {
    const sp = sparkles(60, 3, 256, '210,235,255');
    return anim(new THREE.MeshStandardMaterial({ map: camo(['#eef3f6', '#bccad3', '#8b9aa6', '#dde6ec'], 11), emissiveMap: sp, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.6 }), (m, k) => { sp.offset.set(k * 0.03, k * 0.05); m.emissiveIntensity = 0.4 + Math.sin(k * 3) * 0.25; }); } },
  jungle: { name: 'Jungle Camo', desc: 'Woodland camo, slowly shifting like leaf shadow.', mat: () => {
    const t = camo(['#4d5a3a', '#2f3a26', '#6b5a3c', '#7a8a52'], 5);
    return anim(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), (m, k) => { t.offset.set(Math.sin(k * 0.4) * 0.04, k * 0.01); }); } },
  carbon: { name: 'Carbon Weave', desc: 'Woven carbon fiber with a light sweep.', mat: () => {
    const t = tex((g, s) => { for (let y = 0; y < s; y += 8) for (let x = 0; x < s; x += 8) { const a = ((x + y) / 8) % 2; const gr = g.createLinearGradient(x, y, x + (a ? 8 : 0), y + (a ? 0 : 8)); gr.addColorStop(0, '#15161a'); gr.addColorStop(0.5, '#2c2f36'); gr.addColorStop(1, '#15161a'); g.fillStyle = gr; g.fillRect(x, y, 8, 8); } }, 128, 3);
    const sw = sweep('120,130,150');
    return anim(new THREE.MeshStandardMaterial({ map: t, emissiveMap: sw, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.5 }), (m, k) => { sw.offset.x = (k * 0.35) % 1; }); } },
  candy: { name: 'Candy Cane', desc: 'Pink and white swirl, always turning.', mat: () => {
    const t = tex((g, s) => { g.fillStyle = '#fff6f8'; g.fillRect(0, 0, s, s); for (let i = -s; i < s * 2; i += 48) { g.fillStyle = '#ff5c8a'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 18, 0); g.lineTo(i + 18 + s, s); g.lineTo(i + s, s); g.fill(); g.fillStyle = '#ffd1df'; g.beginPath(); g.moveTo(i + 22, 0); g.lineTo(i + 26, 0); g.lineTo(i + 26 + s, s); g.lineTo(i + 22 + s, s); g.fill(); } }, 256);
    return anim(new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.05 }), (m, k) => { t.offset.x = k * 0.12; }); } },
  chrome: { name: 'Chrome', desc: 'Mirror chrome with an oil-slick shimmer.', mat: () => {
    const sw = tex((g, s) => { const gr = g.createLinearGradient(0, 0, s, s); ['#000', '#000', '#3a1f6e', '#1f6e6a', '#6e5a1f', '#000', '#000'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 128);
    return anim(new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 1, roughness: 0.04, emissiveMap: sw, emissive: 0xffffff, emissiveIntensity: 0.55 }), (m, k) => { sw.offset.x = (k * 0.15) % 1; }); } },
  galaxy: { name: 'Galaxy', desc: 'Drifting nebula with twinkling stars.', mat: () => {
    const t = tex((g, s) => { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#120a2e'); gr.addColorStop(0.35, '#3a1f6e'); gr.addColorStop(0.6, '#7a2a7a'); gr.addColorStop(1, '#0d1b3a'); g.fillStyle = gr; g.fillRect(0, 0, s, s); const r = rnd(4); for (let i = 0; i < 14; i++) { const x = r() * s, y = r() * s, rr = 20 + r() * 50; const rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, `rgba(${r() > 0.5 ? '255,120,220' : '120,180,255'},0.35)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, s, s); } }, 256);
    const st = sparkles(140, 9);
    return anim(new THREE.MeshStandardMaterial({ map: t, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.3 }), (m, k) => { t.offset.x = k * 0.02; st.offset.x = -k * 0.01; m.emissiveIntensity = 0.9 + Math.sin(k * 7) * 0.35; }); } },
  lava: { name: 'Molten', desc: 'Cooling rock; the cracks pulse and flow.', mat: () => {
    const t = tex((g, s) => { g.fillStyle = '#16110f'; g.fillRect(0, 0, s, s); const r = rnd(21); for (let i = 0; i < 26; i++) { const c = r() > 0.5 ? '#ff6a1a' : '#ffb21a'; g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 8; g.lineWidth = 1 + r() * 3; g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } }, 256);
    return anim(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.8 }), (m, k) => { t.offset.y = k * 0.03; m.emissiveIntensity = 1.1 + Math.sin(k * 2.2) * 0.45; }); } },
  lilac: { name: 'Neon Lilac', desc: 'Light-purple glow with a pulsing circuit grid.', mat: () => {
    const t = tex((g, s) => { g.fillStyle = '#2a1840'; g.fillRect(0, 0, s, s); g.strokeStyle = '#d6a8ff'; g.shadowColor = '#c78bff'; g.shadowBlur = 12; g.lineWidth = 3; const r = rnd(13); for (let i = 0; i < 12; i++) { let x = Math.round(r() * 8) * 32, y = Math.round(r() * 8) * 32; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (r() > 0.5) x += (r() > 0.5 ? 1 : -1) * 32; else y += (r() > 0.5 ? 1 : -1) * 32; g.lineTo(x, y); } g.stroke(); g.fillStyle = '#f0dcff'; g.fillRect(x - 3, y - 3, 6, 6); } }, 256);
    return anim(new THREE.MeshStandardMaterial({ map: t, color: 0xe9d6ff, emissiveMap: t, emissive: 0xd9b8ff, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.2 }), (m, k) => { m.emissiveIntensity = 1.0 + Math.sin(k * 3.2) * 0.6; t.offset.y = k * 0.04; }); } },
  cheetah: { name: 'Cheetah', desc: 'Golden cheetah print with a satin sheen.', mat: () => {
    const t = tex((g, s) => { g.fillStyle = '#d9a24a'; g.fillRect(0, 0, s, s); const r = rnd(31); for (let i = 0; i < 70; i++) { const x = r() * s, y = r() * s, rr = 4 + r() * 7; g.fillStyle = '#2a1a0c'; g.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; const d = rr * (0.65 + r() * 0.5); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85); } g.fill(); if (rr > 8) { g.fillStyle = '#b97a2c'; g.beginPath(); g.arc(x, y, rr * 0.35, 0, Math.PI * 2); g.fill(); } } }, 256);
    const sw = sweep('255,220,160');
    return anim(new THREE.MeshStandardMaterial({ map: t, emissiveMap: sw, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.1 }), (m, k) => { sw.offset.x = (k * 0.2) % 1; }); } },
  gold: { name: 'Solid Gold', desc: 'Max level. Mirror gold that sparkles.', mat: () => {
    const sp = sparkles(220, 7, 256, '255,240,190');
    return anim(new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.07, emissiveMap: sp, emissive: 0xfff0b0, emissiveIntensity: 1.4, envMapIntensity: 1.6 }), (m, k) => { sp.offset.set(k * 0.05, -k * 0.035); m.emissiveIntensity = 1.1 + Math.sin(k * 6) * 0.5; }); } },
};

export const SKINS = {
  none: { name: 'Steel', desc: 'Standard blade.', mat: null },
  obsidian: { name: 'Obsidian', desc: 'Volcanic black glass.', mat: () => new THREE.MeshStandardMaterial({ color: 0x121216, metalness: 0.4, roughness: 0.08 }) },
  ruby: { name: 'Ruby', desc: 'Deep red gemstone.', mat: () => new THREE.MeshStandardMaterial({ color: 0x9b111e, emissive: 0x3a0008, metalness: 0.4, roughness: 0.15 }) },
  plasma: { name: 'Plasma', desc: 'A blade of pure energy.', mat: () => new THREE.MeshStandardMaterial({ color: 0x7ff9ff, emissive: 0x2ee6ff, emissiveIntensity: 1.6, roughness: 0.2 }) },
  gold: { name: 'Gilded', desc: 'Polished gold edge.', mat: () => new THREE.MeshStandardMaterial({ color: 0xd4a93a, metalness: 0.95, roughness: 0.2 }) },
};

export const COLORS = {
  graphite: { name: 'Graphite', hex: 0x2b2e33 },
  teal: { name: 'Teal', hex: 0x36d6b0 },
  crimson: { name: 'Crimson', hex: 0xd8433a },
  violet: { name: 'Violet', hex: 0x8e6cff },
  sunset: { name: 'Sunset', hex: 0xff9a3c },
  ghost: { name: 'Ghost White', hex: 0xeef2f5 },
};

export const HATS = {
  none: { name: 'Helmet', desc: 'Standard issue.' },
  beanie: { name: 'Beanie', desc: 'Warm and cozy.' },
  cap: { name: 'Ball Cap', desc: 'Brim forward, always.' },
  headset: { name: 'Headset', desc: 'Comms online.' },
  bucket: { name: 'Bucket Hat', desc: 'Effortless.' },
  crown: { name: 'Crown', desc: 'For the champion.' },
  halo: { name: 'Halo', desc: 'Glowing above it all.' },
};

const cache = {};
export const wrapMaterial = (id) => (WRAPS[id] && WRAPS[id].mat ? (cache['w' + id] || (cache['w' + id] = WRAPS[id].mat())) : null);
export const skinMaterial = (id) => (SKINS[id] && SKINS[id].mat ? (cache['s' + id] || (cache['s' + id] = SKINS[id].mat())) : null);

// Hat meshes sit on the soldier's head group (head origin = neck, top of head ~ y 0.32).
export function buildHat(id, color = 0x36d6b0) {
  const g = new THREE.Group();
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const b = (w, h, d, mat, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
  if (id === 'beanie') { b(0.34, 0.16, 0.34, m(color), 0, 0.36, 0); b(0.36, 0.05, 0.36, m(0x222428), 0, 0.29, 0); b(0.08, 0.06, 0.08, m(0xeeeeee), 0, 0.47, 0); }
  if (id === 'cap') { b(0.34, 0.12, 0.34, m(color), 0, 0.36, 0); b(0.3, 0.025, 0.16, m(color), 0, 0.31, -0.24); }
  if (id === 'headset') { b(0.36, 0.04, 0.08, m(0x222428), 0, 0.34, 0); b(0.05, 0.14, 0.12, m(0x222428), -0.18, 0.2, 0); b(0.05, 0.14, 0.12, m(0x222428), 0.18, 0.2, 0); b(0.03, 0.03, 0.16, m(color, { emissive: color, emissiveIntensity: 0.6 }), -0.17, 0.12, -0.1); }
  if (id === 'bucket') { b(0.32, 0.14, 0.32, m(0xc8b98f), 0, 0.37, 0); b(0.46, 0.025, 0.46, m(0xc8b98f), 0, 0.3, 0); }
  if (id === 'crown') { const gold = m(0xd4a93a, { metalness: 0.9, roughness: 0.25 }); b(0.32, 0.08, 0.32, gold, 0, 0.36, 0); for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13], [0, -0.15]]) b(0.05, 0.1, 0.05, gold, x, 0.44, z); }
  if (id === 'halo') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe066, emissiveIntensity: 1.5 })); t.rotation.x = Math.PI / 2; t.position.y = 0.52; g.add(t); }
  return g;
}

export function rewardInfo(id) {
  const [kind, key] = id.split(':');
  const map = { wrap: WRAPS, skin: SKINS, color: COLORS, hat: HATS }[kind];
  return { kind, key, name: map && map[key] ? map[key].name : key };
}
