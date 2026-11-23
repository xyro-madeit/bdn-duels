import * as THREE from 'three';
import { wrapMaterial, skinMaterial } from '../progression/cosmetics.js';
import { cloneModel, ROLE_BY_MATERIAL } from './glb.js';

// Procedural toy-box models for every weapon + blocky arms. Origin = where the right hand
// grips, x right, y up, barrel toward -z. Each builder returns anchors the viewmodel animates:
// muzzle, mag, rightHand/Elbow, leftHand/Elbow (null = one-handed), and optional moving parts.
// Grounded materials: metal parts reflect the environment map, polymer is matte, wood is satin.
export const PALETTE = {
  body: 0x34383f, dark: 0x1c1e22, wrap: 0x5f6b4e, mag: 0x2b2d31, accent: 0x7d5a3c, wood: 0x6e4428,
  steel: 0xbfc5cd, gold: 0xa8843c, pink: 0xa83232, purple: 0x474b63,
  sleeve: 0x3a414b, cuff: 0x1a1c1f, skin: 0x26292e,
};
const SURF = {
  [PALETTE.body]: { metalness: 0.75, roughness: 0.38 }, [PALETTE.steel]: { metalness: 0.9, roughness: 0.22 },
  [PALETTE.gold]: { metalness: 0.85, roughness: 0.3 }, [PALETTE.dark]: { metalness: 0.1, roughness: 0.75 },
  [PALETTE.mag]: { metalness: 0.5, roughness: 0.5 }, [PALETTE.wood]: { metalness: 0, roughness: 0.55 },
  [PALETTE.sleeve]: { metalness: 0, roughness: 0.95 }, [PALETTE.skin]: { metalness: 0, roughness: 0.85 },
};
const M = {};
function mat(hex, extra = {}) {
  const k = hex + JSON.stringify(extra);
  return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.2, ...(SURF[hex] || {}), ...extra }));
}

// Box part. Thin bevel-less boxes read fine at viewmodel scale; no cartoon outlines.
export function part(parent, w, h, d, color, x, y, z, rx = 0, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, typeof color === 'object' ? color : mat(color, opts.mat || {}));
  m.position.set(x, y, z); m.rotation.x = rx;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = true;
  if (typeof color !== 'object') m.userData.hex = color; // lets cosmetics find body/blade parts
  parent.add(m);
  return m;
}
const P = PALETTE;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function holo(g, y, z, color = P.wrap) {
  part(g, 0.05, 0.022, 0.09, P.dark, 0, y - 0.019, z + 0.03);
  part(g, 0.08, 0.009, 0.014, color, 0, y + 0.034, z, 0, { outline: false });
  part(g, 0.009, 0.05, 0.014, color, -0.0355, y + 0.007, z, 0, { outline: false });
  part(g, 0.009, 0.05, 0.014, color, 0.0355, y + 0.007, z, 0, { outline: false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.05), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.14, depthWrite: false }));
  glass.position.set(0, y + 0.007, z); g.add(glass);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 16), new THREE.MeshBasicMaterial({ color: 0xff2d55 }));
  dot.position.set(0, y, z - 0.002); g.add(dot);
}
function irons(g, y, zRear, zFront) {
  part(g, 0.008, 0.014, 0.01, P.dark, -0.012, y, zRear, 0, { outline: false });
  part(g, 0.008, 0.014, 0.01, P.dark, 0.012, y, zRear, 0, { outline: false });
  part(g, 0.007, 0.014, 0.01, P.mag, 0, y, zFront, 0, { outline: false });
}

const BUILDERS = {
  striker(g, o) {
    part(g, 0.075, 0.1, 0.4, P.body, 0, 0.02, -0.14);
    part(g, 0.072, 0.075, 0.22, P.wrap, 0, 0.012, -0.45);
    part(g, 0.03, 0.03, 0.16, P.dark, 0, 0.026, -0.63);
    part(g, 0.046, 0.046, 0.05, P.dark, 0, 0.026, -0.72);
    part(g, 0.055, 0.12, 0.065, P.dark, 0, -0.07, 0.02, 0.25);
    o.mag = part(g, 0.05, 0.16, 0.08, P.mag, 0, -0.11, -0.17, -0.12);
    part(g, 0.06, 0.08, 0.2, P.body, 0, 0.0, 0.16);
    part(g, 0.066, 0.115, 0.035, P.dark, 0, -0.012, 0.27);
    holo(g, 0.1, -0.15, P.dark);
    o.muzzle.set(0, 0.026, -0.75);
    o.left = [V(-0.005, -0.03, -0.45), V(-0.2, -0.22, -0.18)];
  },
  triburst(g, o) {
    part(g, 0.08, 0.1, 0.44, P.body, 0, 0.02, -0.15);
    part(g, 0.074, 0.08, 0.2, P.accent, 0, 0.012, -0.47);
    part(g, 0.03, 0.03, 0.12, P.dark, 0, 0.026, -0.63);
    part(g, 0.055, 0.12, 0.065, P.dark, 0, -0.07, 0.02, 0.25);
    o.mag = part(g, 0.05, 0.15, 0.075, P.mag, 0, -0.105, -0.19, -0.2);
    part(g, 0.065, 0.09, 0.22, P.body, 0, -0.005, 0.17);
    part(g, 0.05, 0.05, 0.15, P.dark, 0, 0.1, -0.14); // 2x scope
    part(g, 0.056, 0.056, 0.02, P.accent, 0, 0.1, -0.22);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ color: 0x5ff0ff }));
    lens.position.set(0, 0.1, -0.0645); lens.rotation.y = Math.PI; g.add(lens);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.003, 12), new THREE.MeshBasicMaterial({ color: 0xff2d55 }));
    dot.position.set(0, 0.1, -0.23); g.add(dot);
    o.muzzle.set(0, 0.026, -0.7);
    o.left = [V(-0.005, -0.035, -0.47), V(-0.2, -0.22, -0.2)];
  },
  wasp(g, o) {
    part(g, 0.07, 0.1, 0.3, P.purple, 0, 0.02, -0.1);
    part(g, 0.028, 0.028, 0.12, P.dark, 0, 0.03, -0.31);
    part(g, 0.05, 0.11, 0.06, P.dark, 0, -0.07, 0.02, 0.25);
    o.mag = part(g, 0.045, 0.2, 0.06, P.mag, 0, -0.14, -0.13);
    part(g, 0.04, 0.1, 0.05, P.dark, 0, -0.07, -0.24); // front grip
    part(g, 0.02, 0.06, 0.18, P.dark, 0.02, 0.0, 0.13); // folded stock
    irons(g, 0.077, 0.02, -0.24);
    o.muzzle.set(0, 0.03, -0.38);
    o.left = [V(0, -0.11, -0.24), V(-0.2, -0.26, -0.02)];
  },
  breacher(g, o) {
    part(g, 0.08, 0.1, 0.32, P.body, 0, 0.02, -0.08);
    part(g, 0.045, 0.045, 0.52, P.dark, 0, 0.04, -0.46);
    part(g, 0.04, 0.04, 0.42, P.dark, 0, -0.012, -0.42);
    o.pump = part(g, 0.075, 0.065, 0.18, P.wrap, 0, -0.012, -0.42);
    part(g, 0.055, 0.12, 0.065, P.dark, 0, -0.07, 0.03, 0.3);
    part(g, 0.065, 0.1, 0.24, P.wood, 0, -0.005, 0.2);
    part(g, 0.012, 0.012, 0.012, P.mag, 0, 0.068, -0.7, 0, { outline: false });
    part(g, 0.03, 0.01, 0.06, P.dark, 0, 0.068, -0.02, 0, { outline: false });
    o.muzzle.set(0, 0.04, -0.73);
    o.left = [V(-0.005, -0.04, -0.42), V(-0.2, -0.22, -0.16)];
  },
  twinfang(g, o) {
    part(g, 0.075, 0.09, 0.2, P.body, 0, 0.02, -0.06);
    part(g, 0.034, 0.034, 0.5, P.dark, -0.019, 0.035, -0.4);
    part(g, 0.034, 0.034, 0.5, P.dark, 0.019, 0.035, -0.4);
    part(g, 0.07, 0.05, 0.26, P.wood, 0, -0.01, -0.3);
    part(g, 0.055, 0.12, 0.065, P.wood, 0, -0.07, 0.03, 0.35);
    part(g, 0.065, 0.1, 0.26, P.wood, 0, -0.01, 0.2);
    part(g, 0.012, 0.008, 0.48, P.gold, 0, 0.056, -0.4, 0, { outline: false });
    o.muzzle.set(0, 0.035, -0.66);
    o.left = [V(0, -0.045, -0.3), V(-0.2, -0.22, -0.06)];
  },
  longshot(g, o) {
    part(g, 0.075, 0.095, 0.42, P.body, 0, 0.02, -0.1);
    part(g, 0.032, 0.032, 0.6, P.dark, 0, 0.03, -0.6);
    part(g, 0.05, 0.05, 0.06, P.dark, 0, 0.03, -0.92);
    part(g, 0.056, 0.056, 0.28, P.dark, 0, 0.1, -0.12); // scope
    part(g, 0.066, 0.066, 0.04, P.wrap, 0, 0.1, -0.27);
    part(g, 0.064, 0.064, 0.03, P.wrap, 0, 0.1, 0.03);
    o.bolt = part(g, 0.05, 0.02, 0.02, P.steel, 0.05, 0.04, 0.0);
    o.mag = part(g, 0.05, 0.08, 0.09, P.mag, 0, -0.07, -0.13);
    part(g, 0.055, 0.12, 0.065, P.dark, 0, -0.07, 0.04, 0.3);
    part(g, 0.068, 0.115, 0.3, P.body, 0, -0.005, 0.24);
    o.muzzle.set(0, 0.03, -0.96);
    o.left = [V(-0.005, -0.03, -0.42), V(-0.2, -0.22, -0.16)];
  },
  quill(g, o) {
    part(g, 0.06, 0.08, 0.5, P.wood, 0, 0.01, -0.15);
    part(g, 0.055, 0.12, 0.065, P.dark, 0, -0.07, 0.03, 0.3);
    part(g, 0.64, 0.03, 0.04, P.wrap, 0, 0.05, -0.42);
    part(g, 0.05, 0.08, 0.05, P.dark, -0.31, 0.05, -0.38);
    part(g, 0.05, 0.08, 0.05, P.dark, 0.31, 0.05, -0.38);
    o.string = part(g, 0.6, 0.006, 0.006, P.steel, 0, 0.055, -0.3, 0, { outline: false });
    o.bolt = part(g, 0.012, 0.012, 0.42, P.steel, 0, 0.065, -0.36);
    part(g, 0.03, 0.03, 0.04, P.pink, 0, 0.065, -0.13, 0, { outline: false });
    irons(g, 0.08, -0.02, -0.38);
    o.muzzle.set(0, 0.065, -0.58);
    o.left = [V(0, -0.04, -0.3), V(-0.2, -0.24, -0.06)];
  },
  buzzsaw(g, o) {
    part(g, 0.14, 0.14, 0.32, P.body, 0, 0.0, -0.05);
    const spin = new THREE.Group(); spin.position.set(0, 0, -0.2); g.add(spin);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(spin, 0.026, 0.026, 0.5, P.dark, Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.25); }
    part(spin, 0.11, 0.11, 0.03, P.accent, 0, 0, -0.45);
    o.spin = spin;
    part(g, 0.03, 0.03, 0.16, P.dark, 0, 0.11, -0.1);
    part(g, 0.03, 0.05, 0.03, P.dark, 0, 0.085, -0.02);
    part(g, 0.03, 0.05, 0.03, P.dark, 0, 0.085, -0.18);
    o.mag = part(g, 0.12, 0.12, 0.13, P.mag, -0.13, -0.03, -0.02);
    part(g, 0.055, 0.12, 0.065, P.dark, 0, -0.1, 0.06, 0.3);
    o.muzzle.set(0, 0, -0.72);
    o.left = [V(0, 0.11, -0.1), V(-0.22, -0.1, 0.1)];
  },
  sidekick(g, o) {
    part(g, 0.046, 0.055, 0.22, P.body, 0, 0.045, -0.08);
    part(g, 0.043, 0.03, 0.18, P.accent, 0, 0.004, -0.065);
    part(g, 0.042, 0.115, 0.056, P.dark, 0, -0.06, 0.012, 0.2);
    o.mag = part(g, 0.032, 0.03, 0.045, P.mag, 0, -0.12, 0.024, 0.2);
    part(g, 0.02, 0.02, 0.02, P.dark, 0, 0.045, -0.198);
    irons(g, 0.078, 0.0, -0.18);
    o.muzzle.set(0, 0.045, -0.21);
    o.left = [V(-0.028, -0.07, 0.0), V(-0.2, -0.24, 0.24)];
  },
  judge(g, o) {
    part(g, 0.04, 0.045, 0.22, P.steel, 0, 0.045, -0.17);
    o.cyl = part(g, 0.066, 0.066, 0.085, P.gold, 0, 0.032, -0.04);
    part(g, 0.046, 0.075, 0.12, P.body, 0, 0.02, 0.0);
    part(g, 0.044, 0.125, 0.058, P.wood, 0, -0.065, 0.035, 0.35);
    part(g, 0.014, 0.03, 0.02, P.dark, 0, 0.075, 0.05);
    irons(g, 0.075, 0.02, -0.27);
    o.muzzle.set(0, 0.045, -0.29);
    o.left = [V(-0.028, -0.075, 0.02), V(-0.2, -0.24, 0.26)];
  },
  hornet(g, o) {
    part(g, 0.046, 0.06, 0.2, P.purple, 0, 0.04, -0.07);
    part(g, 0.022, 0.022, 0.05, P.dark, 0, 0.045, -0.19);
    part(g, 0.042, 0.11, 0.05, P.dark, 0, -0.06, 0.012, 0.15);
    o.mag = part(g, 0.032, 0.17, 0.04, P.mag, 0, -0.1, 0.02, 0.15);
    irons(g, 0.077, 0.0, -0.16);
    o.muzzle.set(0, 0.045, -0.22);
    o.left = [V(-0.03, -0.08, -0.02), V(-0.2, -0.25, 0.24)];
  },
  boomer(g, o) {
    part(g, 0.09, 0.09, 0.26, P.dark, 0, 0.045, -0.14);
    part(g, 0.1, 0.1, 0.04, P.wrap, 0, 0.045, -0.27);
    part(g, 0.06, 0.08, 0.12, P.body, 0, 0.01, 0.01);
    part(g, 0.046, 0.12, 0.06, P.dark, 0, -0.065, 0.03, 0.3);
    o.ball = part(g, 0.06, 0.06, 0.06, P.accent, 0, 0.045, -0.26, 0, { outline: false });
    irons(g, 0.096, 0.0, -0.24);
    o.muzzle.set(0, 0.045, -0.3);
    o.left = [V(-0.03, -0.075, 0.02), V(-0.2, -0.24, 0.26)];
  },
  signal(g, o) {
    part(g, 0.06, 0.06, 0.22, P.accent, 0, 0.045, -0.12);
    part(g, 0.07, 0.07, 0.03, P.mag, 0, 0.045, -0.23);
    part(g, 0.046, 0.06, 0.1, P.accent, 0, 0.01, 0.0);
    part(g, 0.044, 0.12, 0.058, P.dark, 0, -0.065, 0.03, 0.3);
    irons(g, 0.085, 0.0, -0.2);
    o.muzzle.set(0, 0.045, -0.25);
    o.left = [V(-0.03, -0.075, 0.02), V(-0.2, -0.24, 0.26)];
  },

  // ---- melee: held in the right hand, blade up (+y); the viewmodel tilts it forward
  fists(g, o) { o.left = [V(-0.3, 0.0, -0.05), V(-0.36, -0.25, 0.25)]; o.melee = true; },
  knife(g, o) {
    part(g, 0.032, 0.1, 0.036, P.dark, 0, 0.0, 0);
    part(g, 0.065, 0.014, 0.045, P.gold, 0, 0.056, 0);
    part(g, 0.012, 0.19, 0.04, P.steel, 0, 0.16, 0, 0, { mat: { metalness: 0.6, roughness: 0.25 } });
    part(g, 0.006, 0.19, 0.008, P.wrap, 0, 0.16, -0.02, 0, { outline: false });
    o.left = null; o.melee = true; o.tip = V(0, 0.26, 0);
  },
  katana(g, o) {
    part(g, 0.036, 0.26, 0.036, P.dark, 0, 0.03, 0);
    for (let i = 0; i < 5; i++) part(g, 0.04, 0.012, 0.04, P.wrap, 0, -0.07 + i * 0.05, 0, 0, { outline: false });
    part(g, 0.1, 0.014, 0.1, P.gold, 0, 0.165, 0);
    part(g, 0.012, 0.86, 0.048, P.steel, 0, 0.6, 0, 0, { mat: { metalness: 0.6, roughness: 0.2 } });
    part(g, 0.006, 0.86, 0.01, 0xffffff, 0, 0.6, -0.026, 0, { outline: false });
    o.left = [V(0, -0.1, 0), V(-0.22, -0.3, 0.2)]; o.melee = true; o.tip = V(0, 1.03, 0);
  },
  doubleedge(g, o) {
    part(g, 0.04, 0.34, 0.04, P.dark, 0, 0, 0);
    part(g, 0.09, 0.016, 0.07, P.gold, 0, 0.18, 0); part(g, 0.09, 0.016, 0.07, P.gold, 0, -0.18, 0);
    part(g, 0.016, 0.5, 0.07, P.purple, 0, 0.44, 0, 0, { mat: { metalness: 0.4, roughness: 0.25 } });
    part(g, 0.016, 0.5, 0.07, P.purple, 0, -0.44, 0, 0, { mat: { metalness: 0.4, roughness: 0.25 } });
    o.left = [V(0, -0.12, 0), V(-0.22, -0.3, 0.2)]; o.melee = true; o.tip = V(0, 0.7, 0);
  },
  scythe(g, o) {
    part(g, 0.036, 1.4, 0.036, P.wood, 0, 0.3, 0);
    part(g, 0.05, 0.05, 0.05, P.gold, 0, 1.0, 0);
    // one continuous crescent blade: overlapping segments along an arc, tapering to a point
    const blade = new THREE.Group(); blade.position.set(0, 0.98, 0); g.add(blade);
    const cx = -0.3, cy = -0.12, R = 0.33, N = 9;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const a = 0.42 + (i / N) * 2.0; // from just right of the pole top, sweeping over and down to the left
      const p = new THREE.Vector2(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      if (prev) {
        const mid = prev.clone().add(p).multiplyScalar(0.5), len = prev.distanceTo(p) + 0.012;
        const w = 0.07 * (1 - i / (N + 2)) + 0.012;
        part(blade, len, w, 0.012, P.steel, mid.x, mid.y - w * 0.3, 0, 0, { rz: Math.atan2(p.y - prev.y, p.x - prev.x), mat: { metalness: 0.85, roughness: 0.28 } });
      }
      prev = p;
    }
    part(blade, 0.07, 0.07, 0.03, P.dark, -0.02, 0.0, 0);
    o.left = [V(0, 0.35, 0), V(-0.24, 0.0, 0.25)]; o.melee = true; o.tip = V(-0.5, 0.9, 0);
  },
  hammer(g, o) {
    part(g, 0.04, 0.62, 0.04, P.wood, 0, 0.18, 0);
    part(g, 0.3, 0.16, 0.16, P.dark, 0, 0.5, 0);
    part(g, 0.02, 0.17, 0.17, P.gold, 0.16, 0.5, 0); part(g, 0.02, 0.17, 0.17, P.gold, -0.16, 0.5, 0);
    o.left = [V(0, 0.2, 0), V(-0.24, -0.1, 0.25)]; o.melee = true; o.tip = V(0, 0.58, 0);
  },
  axe(g, o) {
    part(g, 0.04, 0.6, 0.04, P.wood, 0, 0.17, 0);
    part(g, 0.05, 0.09, 0.07, P.dark, 0, 0.42, 0.03);
    part(g, 0.02, 0.22, 0.2, P.steel, 0, 0.42, -0.12, 0, { mat: { metalness: 0.6, roughness: 0.25 } });
    part(g, 0.022, 0.24, 0.02, P.wrap, 0, 0.42, -0.22, 0, { outline: false });
    o.left = null; o.melee = true; o.tip = V(0, 0.5, -0.2);
  },

  karambit(g, o) {
    part(g, 0.03, 0.11, 0.032, P.dark, 0, 0.0, 0);
    part(g, 0.01, 0.12, 0.034, P.steel, 0, 0.11, -0.03, 0.5, { mat: { metalness: 0.7, roughness: 0.25 } });
    o.left = null; o.melee = true; o.tip = V(0, 0.16, -0.08);
  },
  rapier(g, o) {
    part(g, 0.03, 0.14, 0.03, P.dark, 0, 0.0, 0);
    part(g, 0.12, 0.012, 0.04, P.gold, 0, 0.08, 0);
    part(g, 0.008, 0.9, 0.014, P.steel, 0, 0.53, 0, 0, { mat: { metalness: 0.8, roughness: 0.2 } });
    o.left = null; o.melee = true; o.tip = V(0, 0.98, 0);
  },
  bat(g, o) {
    part(g, 0.04, 0.3, 0.04, P.wood, 0, 0.08, 0);
    part(g, 0.065, 0.42, 0.065, P.wood, 0, 0.42, 0);
    part(g, 0.043, 0.1, 0.043, 0x1a1a1a, 0, -0.02, 0);
    o.left = [V(0, -0.1, 0), V(-0.22, -0.3, 0.2)]; o.melee = true; o.tip = V(0, 0.64, 0);
  },
  shard(g, o) {
    part(g, 0.03, 0.1, 0.032, 0xbfe8ff, 0, 0.0, 0, 0, { mat: { transparent: true, opacity: 0.5, metalness: 0.2, roughness: 0.05 } });
    part(g, 0.01, 0.17, 0.04, 0xd8f4ff, 0, 0.14, 0, 0, { mat: { transparent: true, opacity: 0.35, metalness: 0.2, roughness: 0.02 } });
    o.left = null; o.melee = true; o.tip = V(0, 0.23, 0);
  },
  glasscannon(g, o) {
    const gl = { mat: { transparent: true, opacity: 0.4, metalness: 0.2, roughness: 0.03 } };
    part(g, 0.04, 0.045, 0.24, 0xcfeeff, 0, 0.045, -0.17, 0, gl);
    part(g, 0.066, 0.066, 0.085, 0xcfeeff, 0, 0.032, -0.04, 0, gl);
    part(g, 0.046, 0.075, 0.12, 0xcfeeff, 0, 0.02, 0.0, 0, gl);
    part(g, 0.044, 0.125, 0.058, 0xcfeeff, 0, -0.065, 0.035, 0.35, gl);
    o.muzzle.set(0, 0.045, -0.3);
    o.left = [V(-0.028, -0.075, 0.02), V(-0.2, -0.24, 0.26)];
  },

  // ---- utilities (held in the right hand)
  frag(g, o) { part(g, 0.075, 0.08, 0.075, 0x4d5a3a, 0, 0.04, 0); part(g, 0.035, 0.03, 0.035, P.dark, 0, 0.095, 0); o.pin = part(g, 0.03, 0.03, 0.006, P.gold, 0.03, 0.11, 0); o.left = null; o.util = true; },
  flash(g, o) { part(g, 0.06, 0.11, 0.06, 0xd9dde3, 0, 0.05, 0); part(g, 0.065, 0.02, 0.065, P.wrap, 0, 0.06, 0); part(g, 0.03, 0.025, 0.03, P.dark, 0, 0.115, 0); o.left = null; o.util = true; },
  molotov(g, o) {
    const glass = { mat: { transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0.1 } };
    part(g, 0.07, 0.1, 0.07, 0x5a7a3a, 0, 0.05, 0, 0, glass);
    part(g, 0.062, 0.06, 0.062, 0xb36a1a, 0, 0.03, 0, 0, { mat: { roughness: 0.3 } });
    part(g, 0.03, 0.06, 0.03, 0x5a7a3a, 0, 0.13, 0, 0, glass);
    part(g, 0.034, 0.05, 0.034, 0xd9c7a0, 0, 0.175, 0, 0.2, { mat: { roughness: 0.95 } });
    part(g, 0.03, 0.03, 0.03, 0xffb13a, 0, 0.21, 0, 0, { mat: { emissive: 0xff6a1a, emissiveIntensity: 3 } });
    o.left = null; o.util = true;
  },
  smoke(g, o) { part(g, 0.065, 0.12, 0.065, 0x8a8fa3, 0, 0.055, 0); part(g, 0.07, 0.025, 0.07, P.accent, 0, 0.12, 0); o.left = null; o.util = true; },
  jumppad(g, o) { part(g, 0.16, 0.035, 0.16, P.wrap, 0, 0.03, 0); part(g, 0.06, 0.04, 0.06, P.mag, 0, 0.06, 0); o.left = null; o.util = true; },
  dash(g, o) { part(g, 0.09, 0.05, 0.11, P.dark, 0, -0.02, 0.08); part(g, 0.05, 0.03, 0.05, 0x7ff9ff, 0, 0.01, 0.08, 0, { mat: { emissive: 0x2ee6c5, emissiveIntensity: 2 } }); o.left = null; o.util = true; },
};

// cos: { wrap, skin } cosmetic ids (optional)
export function buildGun(def, cos = null) {
  const g = new THREE.Group();
  const out = { group: g, mag: null, muzzle: new THREE.Vector3(), right: [V(0.005, -0.055, 0.03), V(0.12, -0.2, 0.3)], left: null };
  (BUILDERS[def.id] || BUILDERS.striker)(g, out);
  // Blender model available? Swap the visuals, keep the procedural anchors as fallbacks.
  const glb = cloneModel(def.id);
  if (glb) {
    for (const c of [...g.children]) g.remove(c);
    g.add(glb.group);
    glb.group.traverse((o) => { if (o.isMesh && o.material && ROLE_BY_MATERIAL[o.material.name]) o.userData.hex = P[ROLE_BY_MATERIAL[o.material.name]]; });
    out.ball = glb.ball || null; out.mag = glb.mag; out.pump = glb.pump || null; out.bolt = glb.bolt || null; out.spin = glb.spin || null; out.string = glb.string || null;
    if (glb.muzzle) out.muzzle.copy(glb.muzzle);
    if (glb.leftHand && out.left) out.left = [glb.leftHand, out.left[1]];
    if (glb.tip) out.tip = glb.tip;
    out.cyl = glb.cyl || null; out.ball = glb.ball || out.ball || null; out.handleA = glb.handleA; out.handleB = glb.handleB;
    out.detailed = true;
  }
  if (out.util) out.right = [V(0, -0.02, 0), V(0.14, -0.22, 0.28)];
  if (out.melee && def.id !== 'fists') {
    out.right = [V(0, -0.02, 0), null]; // elbows are computed by the viewmodel after the hold pose
    // hold pose: blade up, tip leaning a little forward and in toward the screen center
    out.pose = { x: -0.28, y: 0.1, z: def.id === 'scythe' ? 0.18 : def.id === 'hammer' ? 0.25 : 0.38 };
  }
  if (def.id === 'fists') out.right = [V(0.04, 0.0, -0.05), V(0.2, -0.24, 0.26)];
  if (cos) applyCosmetics(out, cos);
  return out;
}

// Gun wraps paint the body/handguard/accents; melee skins replace the blade.
export function applyCosmetics(out, cos) {
  const gunParts = new Set([P.body, P.wrap, P.accent, P.purple]);
  const bladeParts = new Set([P.steel, P.purple]);
  const wm = !out.melee && !out.util ? wrapMaterial(cos.wrap) : null;
  const sm = out.melee ? skinMaterial(cos.skin) : null;
  out.group.traverse((o) => {
    if (!o.isMesh || o.userData.hex === undefined) return;
    if (wm && gunParts.has(o.userData.hex)) o.material = wm;
    if (sm && bladeParts.has(o.userData.hex)) o.material = sm;
  });
}

// Hand box at `hand` + forearm sleeve reaching toward `elbow` (parent-local coordinates).
// cuff = avatar color band at the wrist.
export function buildArm(hand, elbow, cuff = P.cuff) {
  const arm = new THREE.Group();
  const h = part(arm, 0.07, 0.085, 0.1, P.skin, 0, 0, 0);
  const dir = new THREE.Vector3().subVectors(elbow, hand);
  const len = dir.length() + 0.12;
  dir.normalize();
  const fore = new THREE.Group();
  fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  arm.add(fore);
  part(fore, 0.088, 0.088, len, P.sleeve, 0, 0, len / 2 + 0.03);
  part(fore, 0.092, 0.092, 0.014, cuff, 0, 0, 0.075); // thin avatar-color band at the wrist
  arm.position.copy(hand);
  arm.userData.hand = h;
  return arm;
}

// Small world-space models for projectiles / thrown utilities.
export function buildProjectile(kind) {
  const g = new THREE.Group();
  if (kind === 'bolt') { part(g, 0.02, 0.02, 0.5, P.steel, 0, 0, 0); part(g, 0.05, 0.05, 0.06, P.pink, 0, 0, 0.22, 0, { outline: false }); }
  else if (kind === 'ball') part(g, 0.14, 0.14, 0.14, P.accent, 0, 0, 0);
  else if (kind === 'flare') { part(g, 0.08, 0.08, 0.08, 0xffe066, 0, 0, 0, 0, { mat: { emissive: 0xff7a1a, emissiveIntensity: 3 } }); }
  else { const b = BUILDERS[kind]; if (b) b(g, { muzzle: new THREE.Vector3() }); g.scale.setScalar(1.6); }
  return g;
}
