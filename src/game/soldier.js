import * as THREE from 'three';
import { buildGun } from '../weapons/models.js';
import { buildHat } from '../progression/cosmetics.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Third-person soldier: blocky but grounded (fatigues, plate carrier, helmet, gloves) with a
// team-colored armband + visor so sides read at a glance. Teal = your team, red = enemies.
export const TEAM_COLORS = [0x36d6b0, 0xd8433a, 0xe0a33a, 0x5a8fe0, 0xb15ad8, 0x6fcf4a, 0xe06aa0, 0x9aa3ad];
const M = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, ...o })); };

function box(parent, w, h, d, color, x, y, z, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'object' ? color : mat(color, o));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function mergeChildren(grp, keep) {
  const byMat = new Map();
  for (const o of grp.children) if (o.isMesh && o !== keep) { if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(o); }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((o) => { o.updateMatrix(); const g2 = o.geometry.clone().applyMatrix4(o.matrix); for (const n of Object.keys(g2.attributes)) if (n !== 'position' && n !== 'normal') g2.deleteAttribute(n); return g2; });
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = true; m.receiveShadow = true;
    for (const o of list) grp.remove(o);
    grp.add(m);
  }
}

export function buildSoldier(teamColor) {
  const C = { fatigue: 0x3e4349, vest: 0x2c3036, skin: 0x23262a, boot: 0x1a1b1d, helmet: 0x4a5058 };
  const team = new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 0.35, roughness: 0.5 });
  const g = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.9; g.add(hips);
  const legs = [];
  for (const sx of [-0.13, 0.13]) {
    const leg = new THREE.Group(); leg.position.set(sx, 0, 0); hips.add(leg);
    box(leg, 0.2, 0.46, 0.22, C.fatigue, 0, -0.23, 0);
    box(leg, 0.19, 0.4, 0.2, C.fatigue, 0, -0.66, 0);
    box(leg, 0.21, 0.1, 0.3, C.boot, 0, -0.86, -0.04);
    legs.push(leg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.9; g.add(torso);
  box(torso, 0.5, 0.58, 0.28, C.fatigue, 0, 0.32, 0);
  box(torso, 0.54, 0.42, 0.32, C.vest, 0, 0.36, 0);                 // plate carrier
  box(torso, 0.12, 0.12, 0.04, C.vest, -0.14, 0.3, -0.18);          // pouches
  box(torso, 0.12, 0.12, 0.04, C.vest, 0.14, 0.3, -0.18);
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  box(head, 0.3, 0.32, 0.3, C.skin, 0, 0.15, 0);
  const helmet = box(head, 0.36, 0.17, 0.36, C.helmet, 0, 0.3, 0);  // helmet
  box(head, 0.26, 0.07, 0.03, team, 0, 0.17, -0.155);               // visor (team color)
  // arms: one pivot at the shoulders, pitched with the aim
  const arms = new THREE.Group(); arms.position.y = 0.56; torso.add(arms);
  for (const sx of [-0.33, 0.33]) {
    box(arms, 0.14, 0.14, 0.14, C.fatigue, sx, 0, 0);
    box(arms, 0.15, 0.08, 0.15, team, sx, -0.02, 0);                // armband
  }
  box(arms, 0.12, 0.12, 0.42, C.fatigue, 0.3, -0.12, -0.2);          // right forearm forward
  box(arms, 0.12, 0.12, 0.46, C.fatigue, -0.22, -0.12, -0.28);       // left forearm forward
  box(arms, 0.1, 0.1, 0.1, C.skin, 0.2, -0.13, -0.42);
  box(arms, 0.1, 0.1, 0.1, C.skin, -0.06, -0.12, -0.55);
  const gunMount = new THREE.Group(); gunMount.position.set(0.16, -0.08, -0.42); arms.add(gunMount);
  // merge each animated group's boxes by material (~30 draw calls -> ~10 per soldier)
  for (const grp of [...legs, torso, head, arms]) mergeChildren(grp, helmet);
  return { group: g, legs, torso, arms, head, gunMount, gun: null, team, helmet };
}

// avatar color (visor + armbands) and hat
export function setSoldierLook(s, { color, hat }) {
  if (color !== undefined) { s.team.color.setHex(color); s.team.emissive.setHex(color); }
  if (s.hat) { s.head.remove(s.hat); s.hat = null; }
  s.helmet.visible = !hat || hat === 'none';
  if (hat && hat !== 'none') { s.hat = buildHat(hat, color); s.head.add(s.hat); }
}

export function setSoldierGun(s, def) {
  if (s.gunId === def.id) return;
  s.gunId = def.id;
  if (s.gun) s.gunMount.remove(s.gun);
  const gun = buildGun(def);
  gun.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  if (gun.melee) gun.group.rotation.x = -1.2;
  s.gun = gun.group;
  s.gunMuzzle = gun.muzzle;
  s.gunMount.add(gun.group);
}

// pose the model from simulation state
export function poseSoldier(s, { pos, yaw, pitch, speed, crouched, t, onGround, recoil = 0 }) {
  s.group.position.copy(pos);
  s.group.rotation.y = yaw;
  const k = Math.min(1, speed / 7);
  const sw = Math.sin(t * 9) * 0.7 * k * (onGround ? 1 : 0.2);
  s.legs[0].rotation.x = sw; s.legs[1].rotation.x = -sw;
  s.arms.rotation.x = Math.max(-1.2, Math.min(1.2, pitch)) + recoil * 0.12;
  s.arms.position.z = recoil * 0.05;
  // upper body: run bob, slight lean into movement, idle breathing
  s.torso.rotation.x = -0.12 * k * (onGround ? 1 : 0.3);
  s.torso.rotation.z = Math.sin(t * 4.5) * 0.04 * k;
  s.head.rotation.x = -s.torso.rotation.x * 0.6 + Math.sin(t * 1.7) * 0.02;
  const c = crouched ? 1 : 0;
  s.group.children[0].position.y = 0.9 - 0.35 * c; // hips
  s.torso.position.y = 0.9 - 0.4 * c + Math.abs(Math.cos(t * 9)) * 0.03 * k + Math.sin(t * 2) * 0.006;
  s.legs[0].rotation.x += -0.9 * c; s.legs[1].rotation.x += -0.9 * c;
}
