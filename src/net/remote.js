import * as THREE from 'three';
import { WEAPONS } from '../weapons/defs.js';
import { buildSoldier, setSoldierGun, setSoldierLook, poseSoldier, TEAM_COLORS } from '../game/soldier.js';

// The other player in an online match. Same target interface as bots (pos, eye, hitboxes, damage…)
// so all combat code works unchanged. Its pose comes from 20 Hz snapshots, drawn INTERP seconds in
// the past and interpolated; its health is owned by the other client (we only predict it).
export const SNAP_HZ = 20;
const INTERP = 0.11;

export class RemotePlayer {
  constructor(scene, meta) {
    this.isRemote = true; this.team = 1; this.name = (meta.name || 'Opponent').slice(0, 16);
    this.maxHp = 150; this.hp = 150; this.alive = true;
    this.kills = 0; this.deaths = 0; this.dmgDealt = 0;
    this.finisher = meta.finisher || 'shatter';
    this.soldier = buildSoldier(TEAM_COLORS[1]);
    setSoldierLook(this.soldier, { hat: meta.hat });
    this.model = this.soldier.group; scene.add(this.model);
    this.mover = { pos: new THREE.Vector3(), crouched: false, hSpeed: 0, onGround: true, h: 1.8, vel: new THREE.Vector3() };
    this.yaw = 0; this.pitch = 0;
    this.snaps = []; this.offset = null; this.lastMsg = performance.now() / 1000; this.t = 0;
    this.setWeapon('sidekick');
  }

  setWeapon(id) { if (this.def && this.def.id === id) return; this.def = WEAPONS[id] || WEAPONS.sidekick; setSoldierGun(this.soldier, this.def); }
  get pos() { return this.mover.pos; }
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.mover.crouched ? 0.95 : 1.62), this.pos.z); }
  chest() { return new THREE.Vector3(this.pos.x, this.pos.y + this.mover.h * 0.6, this.pos.z); }
  hitboxes() {
    const p = this.pos, h = this.mover.h;
    return [
      { part: 'head', min: [p.x - 0.19, p.y + h - 0.36, p.z - 0.19], max: [p.x + 0.19, p.y + h + 0.04, p.z + 0.19] },
      { part: 'body', min: [p.x - 0.36, p.y, p.z - 0.24], max: [p.x + 0.36, p.y + h - 0.36, p.z + 0.24] },
    ];
  }

  // Their client decides if they die; we just show the predicted health. The net layer forwards
  // the hit (see main.js dealDamage), so these never kill locally.
  damage(n) { if (this.alive) this.hp = Math.max(1, this.hp - n); return false; }
  knock() {} launch() {} burn() {} mark(time) { this.markT = Math.max(this.markT || 0, time); } blind() {} alert() {} hear() {}

  spawn(x, z, yaw, y = 0) { this.hp = this.maxHp; this.alive = true; this.model.visible = true; this.model.rotation.set(0, 0, 0); this.snaps.length = 0; this.mover.pos.set(x, y, z); this.yaw = yaw; }
  die() { this.alive = false; this.hp = 0; this.deaths++; }

  // snapshot: { t, p:[x,y,z], y, pi, c, s, g, w }
  push(s) {
    const now = performance.now() / 1000;
    this.lastMsg = now;
    const off = now - s.t; // their clock -> ours (+ one-way delay); keep the smallest seen, let it drift up slowly
    this.offset = this.offset === null ? off : Math.min(off, this.offset + 0.002);
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();
    if (s.w) this.setWeapon(s.w);
  }

  update(dt) {
    this.t += dt;
    const S = this.snaps;
    if (S.length) {
      const rt = performance.now() / 1000 - this.offset - INTERP; // render time on their clock
      const i = S.findIndex((x) => x.t > rt);
      let a, b, k;
      if (i === 0) { a = b = S[0]; k = 1; }
      else if (i === -1) { // past the newest snapshot: extrapolate up to 100 ms
        b = S[S.length - 1]; a = S[Math.max(0, S.length - 2)];
        k = b.t === a.t ? 1 : Math.min((rt - a.t) / (b.t - a.t), 1 + 0.1 / (b.t - a.t));
      } else { a = S[i - 1]; b = S[i]; k = (rt - a.t) / (b.t - a.t); }
      const L = (p, q) => p + (q - p) * k;
      let dy = b.y - a.y; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
      const nx = L(a.p[0], b.p[0]), nz = L(a.p[2], b.p[2]);
      this.mover.hSpeed = dt > 0 ? Math.hypot(nx - this.pos.x, nz - this.pos.z) / dt : 0;
      this.mover.pos.set(nx, L(a.p[1], b.p[1]), nz);
      this.yaw = a.y + dy * k; this.pitch = L(a.pi, b.pi);
      this.mover.crouched = !!b.c; this.mover.onGround = !!b.g; this.mover.h = b.c ? 1.1 : 1.8;
      this.mover.hSpeed = b.s ?? this.mover.hSpeed;
    }
    if (this.alive) {
      poseSoldier(this.soldier, { pos: this.pos, yaw: this.yaw, pitch: this.pitch, speed: this.mover.hSpeed, crouched: this.mover.crouched, t: this.t, onGround: this.mover.onGround });
    }
    this.model.visible = this.alive;
  }

  muzzle() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return this.eye().addScaledVector(f, 0.7).addScaledVector(r, 0.18).add(new THREE.Vector3(0, -0.2, 0));
  }
  dispose(scene) { scene.remove(this.model); }
}
