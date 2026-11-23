import * as THREE from 'three';
import { Mover } from '../physics/move.js';
import { WEAPONS } from '../weapons/defs.js';
import { buildSoldier, setSoldierGun, poseSoldier, TEAM_COLORS } from '../game/soldier.js';

// Difficulty = human-like limits: how fast they notice you, how fast and how accurately they turn,
// how often they go for the head, and how much movement tech they use.
// fov: what they can see (deg) · hear: gunfire radius (m) · lag: how far behind your movement
// their crosshair follows (s) · burst/pause: trigger discipline on automatics.
export const DIFF = {
  easy:   { react: 0.75, turn: 4,  err: 5.0, settle: 0.45, head: 0.05, rof: 1.6, cone: 7,   speed: 0.85, tech: 0.0, frag: 0.25, fov: 90,  hear: 22, lag: 0.22, burst: [3, 5],  pause: [0.45, 0.8] },
  normal: { react: 0.5,  turn: 6,  err: 3.2, settle: 0.55, head: 0.12, rof: 1.3, cone: 5,   speed: 1.0,  tech: 0.3, frag: 0.5,  fov: 110, hear: 30, lag: 0.15, burst: [4, 7],  pause: [0.3, 0.55] },
  hard:   { react: 0.3,  turn: 9,  err: 1.8, settle: 0.7,  head: 0.25, rof: 1.1, cone: 3.5, speed: 1.05, tech: 0.7, frag: 0.9,  fov: 140, hear: 40, lag: 0.09, burst: [6, 10], pause: [0.2, 0.35] },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const BOT_GUNS = ['striker', 'triburst', 'wasp', 'breacher', 'longshot', 'sidekick', 'judge', 'hornet'];
const IDEAL = { auto: 14, burst: 18, semi: 16, pump: 5, spin: 14 };
const NAMES = ['Vex', 'Nova', 'Rook', 'Kilo', 'Juno', 'Bolt', 'Echo', 'Zed', 'Mako', 'Onyx', 'Rift', 'Taz', 'Grit', 'Sable', 'Pike'];
const D2R = Math.PI / 180;
let nameI = Math.floor(Math.random() * NAMES.length);

const markerTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.translate(32, 32); g.rotate(Math.PI / 4);
  g.fillStyle = '#ff4d3d'; g.fillRect(-14, -14, 28, 28); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(-14, -14, 28, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

export class Bot {
  constructor(scene, world, team, opts = {}) {
    this.isBot = true;
    this.team = team;
    this.name = opts.name || NAMES[nameI++ % NAMES.length];
    this.mover = new Mover(world);
    this.maxHp = 150; this.hp = 150; this.alive = true;
    this.yaw = 0; this.pitch = 0;
    this.kills = 0; this.deaths = 0; this.dmgDealt = 0;
    this.finisher = opts.finisher || ['ghost', 'lightning', 'confetti', 'shatter', 'ember'][Math.floor(Math.random() * 5)];
    this.soldier = buildSoldier(TEAM_COLORS[opts.colorIdx ?? team] ?? 0xd8433a);
    this.model = this.soldier.group;
    scene.add(this.model);
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex, depthTest: false, transparent: true }));
    this.marker.scale.setScalar(0.35); this.marker.position.y = 2.25; this.marker.renderOrder = 10; this.marker.visible = false;
    this.model.add(this.marker);
    this.setWeapon(opts.weapon || BOT_GUNS[Math.floor(Math.random() * BOT_GUNS.length)]);
    this.reset();
  }

  setWeapon(id) { this.def = WEAPONS[id]; this.mag = this.def.mag; setSoldierGun(this.soldier, this.def); }

  reset() {
    this.hp = this.maxHp; this.alive = true; this.deadT = 0;
    this.mag = this.def.mag; this.cd = 0.5; this.reloadT = 0; this.burstLeft = 0;
    this.target = null; this.visible = false; this.lastSeen = null; this.seenAt = -99; this.reactT = 0;
    this.errYaw = 0; this.errPitch = 0; this.thinkT = 0; this.path = null; this.pathT = 0;
    this.strafe = 1; this.strafeT = 0; this.stuckT = 0; this.blindT = 0; this.fragCd = 6 + Math.random() * 6;
    this.markT = 0; this.burnT = 0; this.t = 0;
    this.track = null; this.yawVel = 0; this.pitchVel = 0; this.burstShots = 0; this.burstMax = 5;
    this.alertT = 0; this.alertBy = null; this.roam = null; this.lookAt = null;
    this.model.visible = true; this.model.rotation.set(0, 0, 0);
  }

  spawn(x, z, yaw, y = 0) { this.mover.spawn(x, y + 0.01, z); this.yaw = yaw; this.pitch = 0; this.reset(); }

  get pos() { return this.mover.pos; }
  eye() { return new THREE.Vector3(this.mover.pos.x, this.mover.pos.y + (this.mover.crouched ? 0.95 : 1.62), this.mover.pos.z); }
  chest() { return new THREE.Vector3(this.mover.pos.x, this.mover.pos.y + this.mover.h * 0.6, this.mover.pos.z); }
  hitboxes() {
    const p = this.mover.pos, h = this.mover.h;
    return [
      { part: 'head', min: [p.x - 0.19, p.y + h - 0.36, p.z - 0.19], max: [p.x + 0.19, p.y + h + 0.04, p.z + 0.19] },
      { part: 'body', min: [p.x - 0.36, p.y, p.z - 0.24], max: [p.x + 0.36, p.y + h - 0.36, p.z + 0.24] },
    ];
  }

  // shared target interface (same as dummies / player)
  damage(n) { if (!this.alive) return false; this.hp -= n; this.reactT = Math.min(this.reactT, 0.08); if (this.hp <= 0) { this.hp = 0; this.alive = false; this.deaths++; return true; } return false; }
  knock(v) { this.mover.vel.add(v); }
  launch(vy) { this.mover.launch(vy); }
  burn(dps, time) { this.burnDps = dps; this.burnT = time; this.burnTick = 0; }
  mark(time) { this.markT = Math.max(this.markT, time); }
  blind(t) { this.blindT = Math.max(this.blindT, t); this.target = null; this.visible = false; }
  // got shot: turn toward the shooter (they can still be out of sight)
  alert(attacker) {
    if (!attacker || attacker === this || !this.alive) return;
    this.alertT = 1.6; this.alertBy = attacker;
    if (!this.visible) { this.lastSeen = attacker.pos.clone(); this.lookAt = attacker.pos.clone(); this.pathT = 0; }
  }
  // heard gunfire: investigate roughly where it came from (never an exact position)
  hear(pos, ctxTime, diff) {
    if (!this.alive || this.visible) return;
    const D = DIFF[diff] || DIFF.normal;
    const d = pos.distanceTo(this.mover.pos);
    if (d > D.hear) return;
    const fuzz = 1.5 + d * 0.12;
    this.lastSeen = new THREE.Vector3(pos.x + rnd(-fuzz, fuzz), pos.y, pos.z + rnd(-fuzz, fuzz));
    this.lookAt = this.lastSeen.clone();
    this.seenAt = ctxTime - 1; this.pathT = 0; this.roam = null;
  }

  // ctx: { diff, enemies(bot) -> actors, los(a,b) -> bool, nav, live, shoot(bot, dirs), throwFrag(bot, vel), onDot(bot, n), time }
  update(dt, ctx) {
    this.t += dt;
    if (!this.alive) { this.deadT += dt; const k = Math.min(1, this.deadT / 0.35); this.model.rotation.x = -k * 1.45; if (this.deadT > 3) this.model.visible = false; return; }
    const D = DIFF[ctx.diff] || DIFF.normal;
    const m = this.mover;
    this.cd -= dt; this.thinkT -= dt; this.reactT -= dt; this.blindT -= dt; this.strafeT -= dt; this.fragCd -= dt; this.pathT -= dt;
    if (this.markT > 0) this.markT -= dt;
    if (this.burnT > 0) { this.burnT -= dt; this.burnTick += dt; if (this.burnTick >= 0.5) { this.burnTick -= 0.5; ctx.onDot(this, this.burnDps * 0.5); if (!this.alive) return; } }
    this.marker.visible = this.markT > 0 || this.burnT > 0;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.mag = this.def.mag; }

    // ---- perception (a few times a second, like a human glance)
    if (this.thinkT <= 0) {
      this.thinkT = 0.12 + Math.random() * 0.1;
      const eye = this.eye();
      let best = null, bd = 1e9;
      // only what's inside their field of view (or very close / already being fought / just shot them)
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if (this.blindT <= 0) for (const e of ctx.enemies(this)) {
        if (!e.alive) continue;
        const c = e.chest(), d = c.distanceTo(eye);
        const vx = c.x - eye.x, vz = c.z - eye.z, vl = Math.hypot(vx, vz) || 1;
        const ang = Math.acos(Math.max(-1, Math.min(1, (vx * fx + vz * fz) / vl)));
        const inView = ang < (D.fov / 2) * D2R || d < 6 || // close by = they hear your footsteps
 (e === this.target && this.visible) || (this.alertT > 0 && e === this.alertBy && ang < 1.4);
        if (inView && d < bd && ctx.los(eye, c)) { bd = d; best = e; }
      }
      this.alertT -= 0.17;
      const wasVisible = this.visible;
      this.visible = !!best;
      if (best) {
        if (best !== this.target || !wasVisible) { this.reactT = D.react * (0.8 + Math.random() * 0.5); this.errYaw = (Math.random() * 2 - 1) * D.err * 2.5 * D2R; this.errPitch = (Math.random() * 2 - 1) * D.err * 1.5 * D2R; }
        this.target = best; this.lastSeen = best.pos.clone(); this.seenAt = ctx.time;
        this.aimHead = Math.random() < D.head;
      } else if (ctx.time - this.seenAt > 4) {
        // lost track: no wallhack. Roam the map until they see or hear someone.
        this.roamT = (this.roamT || 0) - 0.17;
        if (!this.roam || Math.hypot(this.roam.x - m.pos.x, this.roam.z - m.pos.z) < 2 || this.roamT <= 0 || (this.pathT <= 0 && !this.path)) {
          const quiet = ctx.time - this.seenAt > 12;
          let ne = null, nd = 1e9;
          if (quiet) for (const e of ctx.enemies(this)) { const d = e.pos.distanceTo(m.pos); if (d < nd) { nd = d; ne = e; } }
          // a hunch near the enemy (never exact, keeps rounds moving) or a random spot biased to the middle,
          // snapped to the nearest walkable nav node so it's always reachable
          const want = ne ? { x: ne.pos.x + rnd(-6, 6), y: ne.pos.y, z: ne.pos.z + rnd(-6, 6) } : (() => { const n = ctx.nav.nodes[Math.floor(Math.random() * ctx.nav.nodes.length)]; return { x: n.x * 0.7, y: n.y, z: n.z * 0.7 }; })();
          const node = ctx.nav.nearest(want.x, want.y, want.z);
          this.roam = node ? new THREE.Vector3(node.x, node.y, node.z) : null;
          this.roamT = 8; this.pathT = 0;
        }
        this.lastSeen = this.roam; this.lookAt = null;
      }
      if (!this.visible && this.lastSeen && (this.pathT <= 0 || !this.path)) {
        this.path = ctx.nav.path(m.pos, this.lastSeen); this.pathT = 1.0;
      }
    }

    // ---- aim
    const T = this.target;
    let wantYaw = this.yaw, wantPitch = 0;
    if (T && this.visible && T.alive) {
      const eye = this.eye();
      const aimPt = this.aimHead ? T.pos.clone().setY(T.pos.y + T.mover.h - 0.15) : T.chest();
      // human tracking: the crosshair follows where you WERE (lag), so strafing makes them miss
      if (!this.track) this.track = aimPt.clone();
      this.track.lerp(aimPt, 1 - Math.exp(-dt / D.lag));
      const v = this.track.clone().sub(eye);
      wantYaw = Math.atan2(-v.x, -v.z) + this.errYaw;
      wantPitch = Math.atan2(v.y, Math.hypot(v.x, v.z)) + this.errPitch;
      // error shrinks while tracking (settling onto you), then wobbles a bit
      const s = Math.pow(1 - D.settle, dt * 3);
      this.errYaw *= s; this.errPitch *= s;
      this.errYaw += (Math.random() - 0.5) * D.err * 0.06 * D2R; this.errPitch += (Math.random() - 0.5) * D.err * 0.04 * D2R;
    } else {
      this.track = null;
      if (this.lookAt) { const v = this.lookAt.clone().sub(m.pos); wantYaw = Math.atan2(-v.x, -v.z); }
      else { const hv = m.vel; if (Math.hypot(hv.x, hv.z) > 1) wantYaw = Math.atan2(-hv.x, -hv.z); }
    }
    // turning is a slightly under-damped spring: fast flicks overshoot a little, like a hand
    const dyaw = ((wantYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const k = D.turn * D.turn, c = 1.3 * D.turn;
    this.yawVel += (dyaw * k - this.yawVel * c) * dt;
    this.pitchVel += ((wantPitch - this.pitch) * k - this.pitchVel * c) * dt;
    this.yaw += this.yawVel * dt; this.pitch += this.pitchVel * dt;
    const aimErr = Math.abs(dyaw) + Math.abs(wantPitch - this.pitch);

    // ---- shoot
    if (ctx.live && T && this.visible && this.reactT <= 0 && this.blindT <= 0 && this.reloadT <= 0) {
      const dist = T.pos.distanceTo(m.pos);
      if (this.mag <= 0) this.reloadT = this.def.reload;
      else if (this.cd <= 0 && aimErr < D.cone * D2R && dist < (this.def.falloff ? this.def.falloff[1] * 1.6 : 60)) this.fire(ctx, D);
    }

    // ---- move
    let wx = 0, wz = 0, jump = false, crouch = false;
    if (ctx.live) {
      if (T && this.visible) {
        const to = T.pos.clone().sub(m.pos); to.y = 0;
        const dist = to.length(); to.normalize();
        const ideal = IDEAL[this.def.kind] || 14;
        const fw = dist > ideal + 3 ? 1 : dist < ideal - 3 ? -0.7 : 0;
        if (this.strafeT <= 0) { this.strafeT = 0.45 + Math.random() * 0.9; this.strafe = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.15) this.strafe = 0; }
        wx = to.x * fw - to.z * this.strafe; wz = to.z * fw + to.x * this.strafe;
        if (Math.random() < D.tech * dt * 0.8 && m.onGround) jump = true;                 // hop
        if (Math.random() < D.tech * dt * 0.5 && m.hSpeed > 6) crouch = true;             // slide
      } else if (this.path && this.path.length) {
        let n = this.path[0];
        if (Math.hypot(n.x - m.pos.x, n.z - m.pos.z) < 0.9) { this.path.shift(); n = this.path[0]; }
        if (n) { wx = n.x - m.pos.x; wz = n.z - m.pos.z; }
        if (Math.random() < D.tech * dt * 0.3 && m.hSpeed > 6) crouch = true;
      } else if (this.lastSeen) { wx = this.lastSeen.x - m.pos.x; wz = this.lastSeen.z - m.pos.z; }
      // utility: frag where they were last seen when we can't see them
      if (!this.visible && this.lastSeen && this.fragCd <= 0 && ctx.time - this.seenAt < 3 && Math.random() < D.frag) {
        const d = Math.hypot(this.lastSeen.x - m.pos.x, this.lastSeen.z - m.pos.z);
        if (d > 6 && d < 20) { ctx.throwFrag(this, this.lastSeen); this.fragCd = 14 + Math.random() * 8; }
        else this.fragCd = 2;
      }
      // unstick: if we're trying to move but not moving, jump
      if ((wx || wz) && m.hSpeed < 1.2 && m.onGround) { this.stuckT += dt; if (this.stuckT > 0.35) { jump = true; this.stuckT = 0; this.pathT = 0; } } else this.stuckT = 0;
    }
    // don't walk off roofs/bridges: probe for ground just ahead (chasm maps only)
    if (ctx.safe && ctx.chasm) {
      if (wx || wz) {
        const l = Math.hypot(wx, wz);
        const ux = wx / l, uz = wz / l;
        if (!ctx.safe(m.pos.x + ux * 1.3, m.pos.y, m.pos.z + uz * 1.3)) { wx = 0; wz = 0; this.strafe = -this.strafe; this.strafeT = 0.6; }
        // no slides or hops toward an edge (a hop carries ~5 m)
        for (const k of [2.2, 3.6, 5]) if (!ctx.safe(m.pos.x + ux * k, m.pos.y, m.pos.z + uz * k)) { jump = false; crouch = false; break; }
      }
      // momentum carrying us toward a drop: brake against it
      const v = m.vel, sp = Math.hypot(v.x, v.z);
      if (sp > 1 && m.onGround && !ctx.safe(m.pos.x + (v.x / sp) * (0.5 + sp * 0.12), m.pos.y, m.pos.z + (v.z / sp) * (0.5 + sp * 0.12))) { wx = -v.x; wz = -v.z; jump = false; crouch = false; }
    }
    const wl = Math.hypot(wx, wz);
    m.speedMul = D.speed * (this.def.moveMul || 1); m.jumpMul = this.def.jumpMul || 1;
    const cmd = { fwd: wl > 0.01 ? 1 : 0, side: 0, jumpHeld: jump, jumpPressed: jump, crouchHeld: crouch || m.sliding, crouchPressed: crouch, yaw: wl > 0.01 ? Math.atan2(-wx / wl, -wz / wl) : this.yaw, ads: false };
    m.step(dt, cmd);
    if (m.onGround) this.lastGround = m.pos.clone();
    if (!ctx.floaty && m.events.some((e) => e.type === 'fell')) { this.hp = 0; this.alive = false; this.deaths++; ctx.onFell && ctx.onFell(this); }

    poseSoldier(this.soldier, { pos: m.pos, yaw: this.yaw, pitch: this.pitch, speed: m.hSpeed, crouched: m.crouched, t: this.t, onGround: m.onGround });
  }

  fire(ctx, D) {
    const d = this.def;
    this.mag--;
    if (d.kind === 'burst') {
      this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : d.burst - 1;
      this.cd = this.burstLeft > 0 ? d.rate : d.burstDelay * D.rof;
    } else if (d.kind === 'auto') {
      // trigger discipline: short bursts, then a pause to re-aim
      this.burstShots++;
      if (this.burstShots >= this.burstMax) { this.burstShots = 0; this.burstMax = Math.round(rnd(D.burst[0], D.burst[1])); this.cd = rnd(D.pause[0], D.pause[1]); }
      else this.cd = d.rate;
    } else this.cd = d.rate * D.rof;
    const cp = Math.cos(this.pitch);
    const f = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), u = new THREE.Vector3().crossVectors(r, f);
    const sp = (d.spreadHip * 0.55 + (this.mover.onGround ? 0 : 1)) * D2R;
    const dirs = [];
    for (let i = 0; i < (d.pellets || 1); i++) {
      const a = sp * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
      dirs.push(f.clone().addScaledVector(r, Math.tan(a) * Math.cos(th)).addScaledVector(u, Math.tan(a) * Math.sin(th)).normalize());
    }
    // recoil drift on long sprays
    this.errPitch += (d.recoil ? d.recoil.up[0] : 0.5) * 0.35 * D2R;
    ctx.shoot(this, dirs);
  }
}
