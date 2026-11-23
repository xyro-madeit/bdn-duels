import * as THREE from 'three';
import { buildProjectile } from '../weapons/models.js';

// Everything that flies: crossbow bolts, hand-cannon balls, flares (swept ray each tick),
// and thrown utilities that bounce off the map (frag, flash, smoke, jump pad).
// The game supplies callbacks: hitscan(o,d,range), onHit(proj, hit, point), onExplode(kind, point, def).
const G = 18; // grenade gravity

export class Projectiles {
  constructor(scene, world, cb) {
    this.scene = scene; this.world = world; this.cb = cb;
    this.list = [];
    this.pads = [];
    this.smokes = [];
    this.fx = [];
  }

  // extra: { proj: {speed, gravity, model} override, grapple, axe(dmg), spin }
  shoot(def, origin, dir, extra = {}) {
    const p = extra.proj || def.proj;
    const obj = buildProjectile(p.model);
    obj.position.copy(origin);
    this.scene.add(obj);
    const glow = p.model === 'flare' ? new THREE.PointLight(0xff8a2a, 3, 8) : null;
    if (glow) obj.add(glow);
    this.list.push({ type: 'proj', def, obj, pos: origin.clone(), vel: dir.clone().multiplyScalar(p.speed), g: p.gravity, life: 4, ...extra, cfg: p });
  }

  throw(def, origin, vel, fuse, extra = {}) {
    const obj = buildProjectile(def.id);
    obj.position.copy(origin);
    this.scene.add(obj);
    this.list.push({ type: 'nade', def, obj, pos: origin.clone(), vel, fuse: def.id === 'jumppad' ? 99 : fuse, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), rest: false, ...extra });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.type === 'proj' ? this.stepProj(p, dt) : this.stepNade(p, dt)) { this.scene.remove(p.obj); this.list.splice(i, 1); }
    }
    for (let i = this.pads.length - 1; i >= 0; i--) {
      const pad = this.pads[i]; pad.life -= dt; pad.cool = Math.max(0, pad.cool - dt);
      pad.obj.children[0] && (pad.obj.rotation.y += dt * 1.5);
      if (pad.life <= 0) { this.scene.remove(pad.obj); this.pads.splice(i, 1); }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt;
      const k = s.t < 0.6 ? s.t / 0.6 : s.t > s.life - 1.5 ? Math.max(0, (s.life - s.t) / 1.5) : 1;
      for (const b of s.blobs) { b.m.scale.setScalar(b.s * (0.4 + 0.6 * Math.min(1, s.t / 0.8))); b.m.material.opacity = 0.92 * k; b.m.position.y += dt * 0.05; }
      if (s.t >= s.life) { for (const b of s.blobs) { this.scene.remove(b.m); b.m.material.dispose(); } this.smokes.splice(i, 1); }
    }
    for (let i = (this.fires || []).length - 1; i >= 0; i--) {
      const f = this.fires[i]; f.t += dt;
      const k = Math.min(1, f.t / 0.3) * Math.min(1, (f.life - f.t) / 1.0);
      for (const sp of f.flames) { const u = sp.userData; const fl = 0.75 + Math.sin(f.t * 13 + u.ph) * 0.25; sp.scale.set(u.s * fl * k, u.s * 1.6 * fl * k, 1); sp.position.y = 0.3 + 0.35 * u.s * fl; }
      f.light.intensity = (5 + Math.sin(f.t * 17) * 1.5) * k;
      if (f.t >= f.life) { this.scene.remove(f.obj); f.flames.forEach((sp) => sp.material.dispose()); this.fires.splice(i, 1); }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (f.step(f.t)) { this.scene.remove(f.obj); this.fx.splice(i, 1); } }
  }

  stepProj(p, dt) {
    p.life -= dt;
    p.vel.y -= p.g * dt;
    const step = p.vel.length() * dt;
    const dir = p.vel.clone().normalize();
    const hit = this.cb.hitscan(p.pos, dir, step, p);
    if (hit) {
      const point = p.pos.clone().addScaledVector(dir, hit.t);
      this.cb.onHit(p, hit, point, dir);
      if (p.cfg.splash) this.explosion(point, 0xff8a3d, p.cfg.splash.r);
      return true;
    }
    p.pos.addScaledVector(p.vel, dt);
    p.obj.position.copy(p.pos);
    p.obj.lookAt(p.pos.clone().add(p.vel));
    if (p.spin) { p.spinA = (p.spinA || 0) + dt * p.spin; p.obj.rotateX(p.spinA); }
    if (p.life <= 0 && this.cb.onExpire) this.cb.onExpire(p);
    return p.life <= 0;
  }

  // sphere (r = 0.08) vs boxes, bounce with restitution; utilities settle, frags keep fusing
  stepNade(p, dt) {
    const r = 0.08;
    p.fuse -= dt;
    if (!p.rest) {
      p.vel.y -= G * dt;
      const n = Math.max(1, Math.ceil(p.vel.length() * dt / 0.05));
      const sdt = dt / n;
      for (let s = 0; s < n; s++) {
        p.pos.addScaledVector(p.vel, sdt);
        for (const b of this.world.near(p.pos.x, p.pos.y, p.pos.z, 1)) {
          if (p.pos.x + r <= b.min[0] || p.pos.x - r >= b.max[0] || p.pos.y + r <= b.min[1] || p.pos.y - r >= b.max[1] || p.pos.z + r <= b.min[2] || p.pos.z - r >= b.max[2]) continue;
          // push out along the axis of least penetration
          const pen = [
            [b.max[0] - (p.pos.x - r), 0, 1], [(p.pos.x + r) - b.min[0], 0, -1],
            [b.max[1] - (p.pos.y - r), 1, 1], [(p.pos.y + r) - b.min[1], 1, -1],
            [b.max[2] - (p.pos.z - r), 2, 1], [(p.pos.z + r) - b.min[2], 2, -1],
          ].sort((a, c) => a[0] - c[0])[0];
          const ax = ['x', 'y', 'z'][pen[1]];
          p.pos[ax] += pen[0] * pen[2];
          if (p.def.id === 'jumppad' && pen[1] === 1 && pen[2] > 0) { this.placePad(p); return true; }
          if (p.def.impact) { p.pos[ax] += 0.02 * pen[2]; this.detonate(p); this.scene.remove(p.obj); return true; } // molotov: shatters on contact
          p.vel[ax] *= -0.38;
          for (const o of ['x', 'y', 'z']) if (o !== ax) p.vel[o] *= 0.72;
          if (pen[1] === 1 && pen[2] > 0 && Math.abs(p.vel.y) < 1.2 && Math.hypot(p.vel.x, p.vel.z) < 0.6) p.rest = true;
          this.cb.onBounce && this.cb.onBounce(p);
        }
      }
      p.obj.rotation.x += p.spin.x * dt; p.obj.rotation.y += p.spin.y * dt;
      if (p.pos.y < this.world.killY) return true;
    }
    p.obj.position.copy(p.pos);
    if (p.fuse <= 0) { this.detonate(p); return true; }
    return false;
  }

  placePad(p) {
    const obj = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x2ee6c5, emissive: 0x0d7f6c, emissiveIntensity: 0.6 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
    obj.add(base, ring);
    obj.position.copy(p.pos); obj.position.y -= 0.02;
    this.scene.add(obj);
    this.pads.push({ obj, pos: obj.position.clone(), life: p.def.life, cool: 0, launch: p.def.launch });
    this.cb.onExplode && this.cb.onExplode('pad', p.pos, p.def);
  }

  detonate(p) {
    const id = p.def.id;
    if (id === 'frag') this.explosion(p.pos, 0xff8a3d, p.def.radius * 0.5);
    if (id === 'flash') this.explosion(p.pos, 0xffffff, 1.2);
    if (id === 'smoke') this.makeSmoke(p.pos, p.def);
    if (id === 'molotov') this.makeFire(p.pos, p.def, p.owner);
    this.cb.onExplode && this.cb.onExplode(id, p.pos.clone(), p.def, p);
  }

  // Molotov fire pool: flickering flame sprites + a warm light; the game damages anyone standing in it.
  makeFire(pos, def, owner) {
    if (!this.fireTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 40, 2, 32, 36, 30); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.35, 'rgba(255,150,40,0.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(60, 40, 32, 62); g.quadraticCurveTo(4, 40, 32, 2); g.fill();
      this.fireTex = new THREE.CanvasTexture(c); this.fireTex.colorSpace = THREE.SRGBColorSpace;
    }
    const obj = new THREE.Group(); obj.position.copy(pos); obj.position.y = Math.round(pos.y * 10) / 10;
    const flames = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * def.radius * 0.9;
      sp.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r); sp.userData = { ph: Math.random() * 10, s: 0.5 + Math.random() * 0.6 };
      obj.add(sp); flames.push(sp);
    }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(def.radius, 24), new THREE.MeshBasicMaterial({ color: 0x1a0d06, transparent: true, opacity: 0.55, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.03; obj.add(scorch);
    const light = new THREE.PointLight(0xff7a1a, 6, def.radius * 4); light.position.y = 0.8; obj.add(light);
    this.scene.add(obj);
    (this.fires = this.fires || []).push({ obj, flames, light, pos: obj.position.clone(), r: def.radius, life: def.life, t: 0, def, owner, tick: 0 });
  }
  fireAt(p) { return (this.fires || []).find((f) => f.t < f.life && Math.hypot(p.x - f.pos.x, p.z - f.pos.z) < f.r && Math.abs(p.y - f.pos.y) < 1.6); }

  makeSmoke(pos, def) {
    const blobs = [];
    for (let i = 0; i < 26; i++) {
      const s = 1.2 + Math.random() * 1.2;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xe9e6f2, roughness: 1, transparent: true, opacity: 0, depthWrite: false, flatShading: true }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * def.radius * 0.8;
      m.position.set(pos.x + Math.cos(a) * r, pos.y + 0.6 + Math.random() * 2.2, pos.z + Math.sin(a) * r);
      this.scene.add(m);
      blobs.push({ m, s });
    }
    this.smokes.push({ pos: pos.clone(), r: def.radius, t: 0, life: def.life, blobs });
  }

  explosion(pos, color, radius) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos);
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, step: (t) => { const k = t / 0.35; m.scale.setScalar(0.2 + radius * Math.sqrt(k)); m.material.opacity = 0.9 * (1 - k); return k >= 1; } });
  }

  // jump pads: returns the pad the feet are standing on (and ready), else null
  padAt(pos) {
    for (const pad of this.pads) if (pad.cool <= 0 && Math.hypot(pos.x - pad.pos.x, pos.z - pad.pos.z) < 0.9 && Math.abs(pos.y - pad.pos.y) < 0.4) return pad;
    return null;
  }

  // is the segment a->b inside any smoke cloud? (for bots later)
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      if (s.t < 0.5 || s.t > s.life - 1) continue;
      const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, s.pos.clone().sub(a).dot(ab) / ab.lengthSq()));
      if (a.clone().addScaledVector(ab, t).distanceTo(s.pos) < s.r) return true;
    }
    return false;
  }
}
