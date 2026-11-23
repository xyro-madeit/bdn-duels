import * as THREE from 'three';
import { buildGun, buildArm } from '../weapons/models.js';

// First-person weapon rendered in its own scene + camera (fixed FOV, never clips walls).
// Rig hierarchy: rig (pose/anim) > holder (scale + per-class base angle) > { item, rightArm, leftArm }.
// The item is a sibling of the arms so it can leave the hands: inspect = toss it up, spin, catch.
const VM_SCALE = 0.6;
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const TAU = Math.PI * 2;

class Spring {
  constructor(k = 220, c = 24) { this.k = k; this.c = c; this.x = 0; this.v = 0; }
  // sub-stepped so long frames (tab hitches) can't make the spring explode
  step(dt, target = 0) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-this.k * (this.x - target) - this.c * this.v) * h; this.x += this.v * h; }
    if (!Number.isFinite(this.x)) { this.x = 0; this.v = 0; }
    return this.x;
  }
}

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xdff1ff, 0x9a8f7a, 1.7));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2); key.position.set(0.6, 1, 0.4); this.scene.add(key);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.rigs = {};
    this.rig = null;
    this.def = null;
    this.kickZ = new Spring(260, 26); this.kickR = new Spring(240, 22);
    this.swayX = new Spring(120, 18); this.swayY = new Spring(120, 18); this.swayR = new Spring(120, 18);
    this.bob = 0;
    this.flashT = 0;
    this.pumpT = 1; this.spinA = 0;
    this.flash = makeFlash();
    this.hidden = false;
    addEventListener('resize', () => { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); });
  }

  // cosmetics change -> drop cached rigs so they rebuild with the new wrap/skin/cuff color
  setCosmetics(cos) {
    const k = JSON.stringify(cos);
    if (k === this.cosKey) return;
    this.cosKey = k; this.cos = cos;
    for (const id in this.rigs) this.root.remove(this.rigs[id].rig);
    this.rigs = {}; this.def = null; this.rig = null;
  }

  setWeapon(def) {
    if (this.def === def) return;
    this.def = def;
    if (!this.rigs[def.id]) {
      const gun = buildGun(def, this.cos);
      const rig = new THREE.Group();
      const holder = new THREE.Group();
      holder.scale.setScalar(VM_SCALE);
      rig.add(holder);
      // pose: the resting hold angle (melee: blade up, leaning slightly forward and inward).
      // The item sits inside it so toss/inspect can still animate the item freely.
      const pose = new THREE.Group();
      if (gun.pose) pose.rotation.set(gun.pose.x, gun.pose.y, gun.pose.z);
      pose.updateMatrix();
      holder.add(pose);
      pose.add(gun.group);
      gun.poseGroup = pose;
      // hands follow the pose; elbows always hang down and back (camera space) so sleeves come from below
      const toHolder = (v) => v.clone().applyMatrix4(pose.matrix);
      const rh = toHolder(gun.right[0]);
      const re = gun.pose || !gun.right[1] ? rh.clone().add(new THREE.Vector3(0.17, -0.38, 0.22)) : toHolder(gun.right[1]);
      const cuff = this.cos && this.cos.cuff;
      gun.rightArm = buildArm(rh, re, cuff);
      holder.add(gun.rightArm);
      if (gun.left) {
        const lh = toHolder(gun.left[0]);
        const le = gun.pose ? lh.clone().add(new THREE.Vector3(-0.24, -0.34, 0.24)) : toHolder(gun.left[1]);
        gun.leftArm = buildArm(lh, le, cuff); holder.add(gun.leftArm); gun.leftHome = gun.leftArm.position.clone();
      }
      gun.rightHome = gun.rightArm.position.clone();
      gun.magHome = gun.mag ? gun.mag.position.clone() : null;
      gun.pumpHome = gun.pump ? gun.pump.position.clone() : null;
      gun.boltHome = gun.bolt ? gun.bolt.position.clone() : null;
      this.rigs[def.id] = { rig, gun, holder };
      this.root.add(rig);
    }
    for (const k in this.rigs) this.rigs[k].rig.visible = k === def.id;
    this.rig = this.rigs[def.id];
    this.rig.gun.group.add(this.flash);
    this.flash.position.copy(this.rig.gun.muzzle);
  }

  shot() {
    const d = this.def;
    if (!d || !d.kick) return;
    this.kickZ.v += d.kick * 30;
    this.kickR.v += d.kickRot * 30;
    this.flashT = 0.045;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.12 * (0.8 + Math.random() * 0.5) * (d.pellets > 1 ? 1.6 : 1));
    this.pumpT = 0;
  }

  // muzzle position in the viewmodel camera's space (used to start tracers)
  muzzleView(out) {
    if (!this.rig) return out.set(0.15, -0.1, -0.6);
    this.root.updateMatrixWorld(true);
    return out.copy(this.rig.gun.muzzle).applyMatrix4(this.rig.gun.group.matrixWorld);
  }

  update(dt, ws, mover, fcam, look) {
    if (!this.rig) return;
    const d = this.def, g = this.rig.gun, rig = this.rig.rig;
    this.root.visible = !this.hidden;
    const a = ease(ws.adsT);
    // hold the weapon a little further out than the raw hip pose (less crowded view)
    const far = d.kind === 'melee' ? 0 : 1;
    const hip = [d.vm.hip[0] + 0.012 * far, d.vm.hip[1] - 0.008 * far, d.vm.hip[2] - 0.075 * far];
    let x = hip[0] * (1 - a), y = hip[1] + (-d.vm.sightY * VM_SCALE - hip[1]) * a, z = hip[2] + (d.vm.adsZ - hip[2]) * a;
    let rx = 0, ry = 0, rz = 0;

    // sway from mouse movement (less when aiming)
    const [dx, dy] = look;
    const sw = 1 - 0.8 * a;
    this.swayX.v += -dx * 0.0011 * sw; this.swayY.v += dy * 0.0011 * sw; this.swayR.v += -dx * 0.004 * sw;
    x += this.swayX.step(dt); y += this.swayY.step(dt); ry += this.swayR.step(dt) * 0.6; rz += this.swayR.x * 0.4;

    // movement bob
    const hs = mover.hSpeed;
    if (mover.onGround && !mover.sliding && hs > 0.5) this.bob += hs * dt * 1.3;
    const bAmt = Math.min(1, hs / 7.4) * (mover.onGround && !mover.sliding ? 1 : 0) * (1 - 0.85 * a);
    x += Math.sin(this.bob) * 0.011 * bAmt;
    y += -Math.abs(Math.cos(this.bob)) * 0.009 * bAmt;
    if (!mover.onGround) y += 0.01 * (1 - a);
    y += fcam.dip * 0.25 * (1 - a);
    if (mover.sliding) { rz += 0.22 * (1 - a); y -= 0.02 * (1 - a); }

    // recoil spring
    z += this.kickZ.step(dt) * (1 - 0.5 * a);
    rx += this.kickR.step(dt) * (1 - 0.6 * a);

    // reset animated sub-parts
    const item = g.group;
    item.position.set(0, 0, 0); item.rotation.set(0, 0, 0);
    if (g.handleA) g.handleA.rotation.x = 0; if (g.handleB) g.handleB.rotation.x = 0; if (g.cyl) g.cyl.rotation.z = 0;
    g.rightArm.position.copy(g.rightHome); g.rightArm.rotation.set(0, 0, 0);
    if (g.leftArm) { g.leftArm.position.copy(g.leftHome); g.leftArm.visible = true; }
    if (g.mag) { g.mag.position.copy(g.magHome); g.mag.visible = true; }

    const p = ws.progress;
    if (ws.state === 'equip') {
      const e = ease(p);
      y -= (1 - e) * 0.28; rx -= (1 - e) * 0.9;
    } else if (ws.state === 'reload') {
      this.animReload(p, ws, g, d, (dx2, dy2, drx, drz) => { x += dx2; y += dy2; rx += drx; rz += drz; });
    } else if (ws.state === 'inspect') {
      this.animToss(p, d, g, item);
    } else if (ws.state === 'swing' || ws.state === 'ability') {
      const r = this.animMelee(p, ws, d, g);
      x += r[0]; y += r[1]; z += r[2]; rx += r[3]; ry += r[4]; rz += r[5];
    } else if (ws.state === 'cook' || ws.state === 'throw') {
      const r = this.animThrow(ws, d);
      x += r[0]; y += r[1]; z += r[2]; rx += r[3];
      if (ws.state === 'throw' && p > 0.35 && !d.instant) item.visible = false;
    }
    if (!(ws.state === 'throw' && p > 0.35 && !d.instant)) item.visible = !(ws.axeAway > 0 && d.id === 'axe');

    // weapon-specific moving parts
    this.pumpT = Math.min(1, this.pumpT + dt / Math.max(0.2, (d.rate || 0.5) * 0.7));
    if (g.pump) { const k = Math.sin(clamp01((this.pumpT - 0.25) / 0.6) * Math.PI); g.pump.position.z = g.pumpHome.z + k * 0.09; if (g.leftArm) g.leftArm.position.z += k * 0.09; }
    if (g.bolt && d.id === 'longshot') { const k = Math.sin(clamp01((this.pumpT - 0.2) / 0.6) * Math.PI); g.bolt.position.z = g.boltHome.z + k * 0.08; rz += k * 0.12; }
    if (g.bolt && d.id === 'quill') g.bolt.visible = ws.slot.mag > 0;
    if (g.spin) { this.spinA += (ws.spinT / (d.spinUp || 1)) * dt * 40; g.spin.rotation.z = this.spinA; }
    if (g.ball) g.ball.visible = ws.slot.mag > 0;

    rig.position.set(x, y, z);
    rig.rotation.set(rx, ry, rz);

    if (this.flashT > 0) { this.flashT -= dt; this.flash.visible = true; } else this.flash.visible = false;
  }

  animReload(p, ws, g, d, add) {
    if (d.kind === 'pump') { // push a shell in each cycle
      const k = Math.sin(p * Math.PI);
      add(0, -k * 0.02, k * 0.08, k * 0.25);
      if (g.leftArm) { g.leftArm.position.y -= k * 0.1; g.leftArm.position.z += k * 0.25; }
      return;
    }
    const tin = ease(clamp01(p / 0.18)), tout = ease(clamp01((1 - p) / 0.18));
    const tilt = Math.min(tin, tout);
    add(-tilt * 0.02, -tilt * 0.035, tilt * 0.22, tilt * 0.55);
    const mo = d.magOutAt, mi = d.magInAt;
    let magY = 0;
    if (p >= mo - 0.05 && p < mo + 0.15) magY = -ease(clamp01((p - mo + 0.05) / 0.2)) * 0.3;
    else if (p >= mo + 0.15 && p < mi) magY = -0.3 + ease(clamp01((p - mo - 0.15) / (mi - mo - 0.15))) * 0.3;
    if (g.mag) { g.mag.position.y += magY; g.mag.visible = magY > -0.28; }
    const leftOff = Math.sin(clamp01((p - mo + 0.1) / (mi - mo + 0.2)) * Math.PI);
    if (g.leftArm) { g.leftArm.position.y -= leftOff * 0.12; g.leftArm.position.z += leftOff * (g.magHome ? Math.max(0, g.magHome.z - g.leftHome.z) * 0.8 : 0.05); }
  }

  // Inspect: flick the weapon up out of the hand, it spins on its axis, drop back and catch.
  animToss(p, d, g, item) {
    const ins = d.inspect || { axis: 'x', turns: 1, height: 0.4 };
    if (ins.axis === 'none') { // fists: crack knuckles, bump fists
      const k = Math.sin(clamp01(p) * Math.PI);
      g.rightArm.position.x -= k * 0.12; g.rightArm.position.y += k * 0.06 + Math.sin(p * 40) * 0.006 * k;
      if (g.leftArm) { g.leftArm.position.x += k * 0.12; g.leftArm.position.y += k * 0.06; }
      return;
    }
    if (ins.style && this.customInspect(ins.style, p, g, item)) return;
    if (g.cyl) g.cyl.rotation.z = ease(clamp01((p - 0.05) / 0.5)) * TAU * 2; // revolvers: spin the cylinder too
    const wind = 0.12, air0 = 0.18, air1 = 0.72, catchEnd = 0.86;
    let ty = 0, spin = 0, handY = 0, tz = 0;
    if (p < wind) { const k = ease(p / wind); ty = -0.05 * k; handY = -0.05 * k; }
    else if (p < air0) { const k = (p - wind) / (air0 - wind); ty = -0.05 + 0.08 * k; handY = -0.05 + 0.1 * k; }
    else if (p < air1) {
      const u = (p - air0) / (air1 - air0);
      ty = 0.03 + 4 * u * (1 - u) * ins.height * 0.55;   // parabola up and back down (kept on screen)
      spin = ins.turns * TAU * ease(u);
      tz = -Math.sin(u * Math.PI) * 0.06;
      handY = 0.05 - 0.05 * u;                            // hand waits, open
    } else if (p < catchEnd) { const k = (p - air1) / (catchEnd - air1); ty = -0.04 * Math.sin(k * Math.PI); handY = ty; spin = ins.turns * TAU; }
    else spin = ins.turns * TAU;
    item.position.y = ty; item.position.z = tz;
    const ax = ins.axis === 'y' ? 'y' : ins.axis === 'z' ? 'z' : 'x';
    item.rotation[ax] = spin;
    // the gun spins around its own middle, not the grip
    // (offset = P - R(P) for the pivot P = (0,0,c) halfway down the weapon)
    const c = (g.muzzle && g.muzzle.z < -0.05 ? g.muzzle.z : g.tip ? -0.0 : 0) * 0.45;
    if (ax === 'x') { item.position.z += c - c * Math.cos(spin); item.position.y += c * Math.sin(spin); }
    if (ax === 'y') { item.position.z += c - c * Math.cos(spin); item.position.x += -c * Math.sin(spin); }
    if (g.tip) { // melee: pivot halfway up the blade (P = (0,h,0))
      const h = g.tip.y * 0.4;
      if (ax === 'x') { item.position.y += h - h * Math.cos(spin); item.position.z += -h * Math.sin(spin); }
      if (ax === 'z') { item.position.y += h - h * Math.cos(spin); item.position.x += h * Math.sin(spin); }
    }
    g.rightArm.position.y += handY;
    if (g.leftArm) { const away = p > wind && p < catchEnd ? 1 : 0; g.leftArm.position.y -= 0.15 * away; g.leftArm.position.x -= 0.05 * away; }
  }

  // Signature inspects. Return true when handled.
  customInspect(style, p, g, item) {
    const k = Math.sin(clamp01(p) * Math.PI); // 0 -> 1 -> 0 envelope
    if (style === 'balisong') {
      // butterfly knife: raise it, then aerial flips (bite handle swings a full circle around the pin)
      // while the knife twirls, then a fast close-open and back to grip
      item.position.set(-0.04 * k, 0.07 * k, -0.03 * k);
      item.rotation.y = ease(clamp01((p - 0.15) / 0.6)) * TAU;
      item.rotation.z = Math.sin(p * TAU * 2) * 0.35 * k;
      const flips = clamp01((p - 0.08) / 0.8);
      if (g.handleB) g.handleB.rotation.x = -ease(flips) * TAU * 3;
      if (g.handleA) g.handleA.rotation.x = ease(clamp01((p - 0.45) / 0.35)) * TAU;
      g.rightArm.position.y += 0.07 * k; g.rightArm.position.x -= 0.04 * k;
      return true;
    }
    if (style === 'karambit') {
      // spin around the index finger through the ring, twice, then catch
      const spin = ease(clamp01((p - 0.1) / 0.75)) * TAU * 2, ry = -0.07;
      item.rotation.z = -spin;
      item.position.set(-ry * Math.sin(spin), ry - ry * Math.cos(spin) + 0.05 * k, 0); // pivot at the finger ring
      g.rightArm.position.y += 0.05 * k;
      return true;
    }
    if (style === 'salute') {
      // rapier salute: blade up in front of the face, hold, then a quick flick down and back to guard
      const up = ease(clamp01(p / 0.3)), down = ease(clamp01((p - 0.62) / 0.2)), back = ease(clamp01((p - 0.82) / 0.18));
      const a = up * (1 - down);
      item.rotation.x = -0.9 * a + 1.1 * down * (1 - back);
      item.rotation.z = 0.35 * a - 0.6 * down * (1 - back);
      item.position.set(-0.14 * a, 0.06 * a, -0.04 * a);
      g.rightArm.position.x -= 0.14 * a; g.rightArm.position.y += 0.06 * a;
      return true;
    }
    if (style === 'shoulder') {
      // rest it on the shoulder, two easy taps, back down
      const a = ease(clamp01(p / 0.25)) * (1 - ease(clamp01((p - 0.8) / 0.2)));
      const tap = Math.max(0, Math.sin(clamp01((p - 0.3) / 0.45) * Math.PI * 2)) * a;
      item.rotation.x = 1.15 * a - 0.18 * tap;
      item.rotation.z = -0.35 * a;
      item.position.set(0.06 * a, 0.09 * a + 0.02 * tap, 0.12 * a);
      g.rightArm.position.y += 0.08 * a; g.rightArm.position.z += 0.08 * a;
      return true;
    }
    if (style === 'admire') {
      // hold the crystal up to the light and turn it slowly, the air warping behind it
      const a = ease(clamp01(p / 0.2)) * (1 - ease(clamp01((p - 0.85) / 0.15)));
      item.rotation.y = ease(clamp01((p - 0.15) / 0.7)) * TAU;
      item.rotation.x = -0.35 * a;
      item.position.set(-0.12 * a, 0.12 * a, -0.06 * a);
      g.rightArm.position.x -= 0.12 * a; g.rightArm.position.y += 0.12 * a;
      return true;
    }
    return false;
  }

  // Melee swings alternate direction; fists alternate hands. Returns rig offsets.
  animMelee(p, ws, d, g) {
    const side = ws.swingN % 2 ? 1 : -1;
    if (ws.state === 'ability') {
      const k = Math.sin(clamp01(p) * Math.PI), key = d.ability.key;
      if (key === 'whirl') return [0, -0.04 * k, 0, 0, ease(p) * TAU, 0.3 * k];
      if (key === 'slam') { const up = p < 0.45 ? ease(p / 0.45) : 1 - ease((p - 0.45) / 0.55); return [-0.08 * up, 0.12 * up, 0.05 * up, 0.9 * up - (p > 0.45 ? 0.8 * k : 0), 0, 0]; }
      if (key === 'uppercut') { g.rightArm.position.y += 0.25 * k; g.rightArm.position.z -= 0.18 * k; return [0, 0, 0, 0, 0, 0]; }
      if (key === 'deflect') return [-0.12 * k, 0.06 * k, -0.04 * k, 0.1 * k, 0, 1.25 * k];
      if (key === 'axethrow') return [0.02 * k, 0.1 * k, 0.12 * k, 0.9 * (p < 0.5 ? k : -k), 0, 0];
      return [-0.05 * k, -0.02 * k, -0.1 * k, -0.6 * k, 0, 0]; // lunge / reaper: thrust forward, low
    }
    if (d.id === 'fists') {
      const k = p < 0.4 ? ease(p / 0.4) : 1 - ease((p - 0.4) / 0.6);
      const arm = side > 0 ? g.rightArm : g.leftArm;
      if (arm) { arm.position.z -= k * 0.35; arm.position.x += (side > 0 ? -0.06 : 0.08) * k; arm.position.y += 0.03 * k; }
      return [0, 0, 0, 0, 0, 0];
    }
    const h = d.hitAt;
    if (d.id === 'scythe') {
      // overhead chop: haul it back over the right shoulder, then drive it down and across to the left
      const w1 = h * 0.8, s1 = Math.min(0.97, h + 0.12);
      let a; // pose blend: 0 = rest, -1 = wound back, +1 = follow-through
      if (p < w1) a = -ease(p / w1);
      else if (p < s1) { const k = (p - w1) / (s1 - w1); a = -1 + 2 * (1 - Math.pow(1 - k, 3)); } // snaps down fast
      else a = 1 - ease((p - s1) / (1 - s1));
      const back = Math.max(0, -a), fwd = Math.max(0, a);
      // the strike ends with the blade biting into the middle of the screen (impact), then recovers
      return [
        0.05 * back - 0.2 * fwd,             // x: right shoulder -> toward center
        0.1 * back + 0.09 * fwd,             // y: up high -> chest height
        0.06 * back - 0.2 * fwd,             // z: pulled back -> reaching forward
        1.0 * back - 0.75 * fwd,             // rx: blade tipped back -> tipped down onto the target
        -0.15 * back + 0.3 * fwd,            // ry
        -0.35 * back + 0.55 * fwd,           // rz: diagonal across the screen
      ];
    }
    let rx = 0, ry = 0, x = 0, y = 0, z = 0;
    if (p < h * 0.75) { const k = ease(p / (h * 0.75)); rx = 0.55 * k; ry = -0.5 * side * k; x = 0.06 * side * k; y = 0.04 * k; }
    else if (p < h + 0.15) { const k = ease((p - h * 0.75) / (h * 0.25 + 0.15)); rx = 0.55 - 1.6 * k; ry = (-0.5 + 1.5 * k) * side; x = (0.06 - 0.2 * k) * side; y = 0.04 - 0.1 * k; z = -0.08 * Math.sin(k * Math.PI); }
    else { const k = ease((p - h - 0.15) / (1 - h - 0.15)); rx = -1.05 * (1 - k); ry = 1.0 * side * (1 - k); x = -0.14 * side * (1 - k); y = -0.06 * (1 - k); }
    return [x, y, z, rx, ry, rx * 0.2 * side];
  }

  animThrow(ws, d) {
    if (ws.state === 'cook') return [0.02, 0.06, 0.1, 0.5]; // wound back, pin pulled
    const p = ws.progress;
    if (p < 0.35) { const k = ease(p / 0.35); return [0.02, 0.06 * (1 - k), 0.1 - 0.35 * k, 0.5 - 1.1 * k]; }
    const k = ease((p - 0.35) / 0.65);
    return [0.02, -0.15 * (1 - k), -0.25 * (1 - k), -0.6 * (1 - k)];
  }

  render(renderer) { renderer.render(this.scene, this.cam); }
}

function makeFlash() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.3, 'rgba(255,214,120,.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 12 : 32; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(0.12);
  s.visible = false;
  return s;
}
