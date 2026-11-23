import * as THREE from 'three';

// Movement tuning. These numbers ARE the game feel; see the plan's direction table.
export const MOVE = {
  run: 7.4, ads: 4.2, crouch: 3.2,
  accel: 15, friction: 9, stopSpeed: 3.2,          // snappy starts, crisp stops
  airAccel: 70, airCap: 0.9,
  gravity: 27, fallMul: 1.15, apexMul: 0.65, apexBand: 1.6, jumpV: 9.0, // ~1.45 m jump with a little hang at the top
  coyote: 0.09, jumpBuffer: 0.12,
  slideMin: 5, slideBoost: 11, slideTime: 0.6, slideCurve: 2.3, slideCd: 0.4, slideBuffer: 0.15,
  slideJumpBonus: 0.6, slideTurn: 1.6,
  maxSpeed: 16,
  bhopWindow: 0.08, bhopLoss: 0.02,
  stepUp: 0.55,
  radius: 0.4, hStand: 1.8, hCrouch: 1.1,
};

const EPS = 0.001;

export class Mover {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.r = MOVE.radius;
    this.h = MOVE.hStand;
    this.onGround = false;
    this.groundTime = 0;
    this.airTime = 0;
    this.crouched = false;
    this.sliding = false;
    this.slideT = 0;
    this.slideCd = 0;
    this.slideDir = new THREE.Vector3(1, 0, 0);
    this.jumpBuf = 0;
    this.justLanded = false;
    this.stepOffset = 0; // how far we were lifted by step-up this tick (camera smooths it)
    this.events = []; // {type:'land'|'jump'|'slide'|'slidejump'|'fell', v}
    this.speedMul = 1;
    this.dashT = 0; this.dashDir = new THREE.Vector3(); this.dashSpeed = 0; this.dashExit = 9;
  }

  spawn(x, y, z) {
    this.pos.set(x, y, z); this.prevPos.copy(this.pos); this.vel.set(0, 0, 0);
    this.sliding = false; this.crouched = false; this.h = MOVE.hStand;
  }

  get hSpeed() { return Math.hypot(this.vel.x, this.vel.z); }
  get state() { return this.sliding ? 'slide' : !this.onGround ? 'air' : this.crouched ? 'crouch' : 'ground'; }

  overlaps(b, y = this.pos.y, h = this.h) {
    const p = this.pos, r = this.r;
    return p.x + r > b.min[0] && p.x - r < b.max[0] &&
      y + h > b.min[1] && y < b.max[1] &&
      p.z + r > b.min[2] && p.z - r < b.max[2];
  }
  free(boxes, y, h) { for (const b of boxes) if (this.overlaps(b, y, h)) return false; return true; }

  step(dt, c) {
    const M = MOVE;
    this.prevPos.copy(this.pos);
    this.stepOffset = 0;
    this.events.length = 0;

    this.jumpBuf = c.jumpPressed ? M.jumpBuffer : Math.max(0, this.jumpBuf - dt);
    const wantJump = this.jumpBuf > 0 || c.jumpHeld; // holding jump = auto-hop
    this.slideCd = Math.max(0, this.slideCd - dt);

    // Wish direction in world space. forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    let wx = -s * c.fwd + co * c.side, wz = -co * c.fwd - s * c.side;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    let hs = this.hSpeed;
    const boxes = this.world.near(this.pos.x, this.pos.y, this.pos.z, 3 + hs * dt);

    // ---- dash (scythe special / dash utility / knife lunge): fixed-speed burst, no gravity
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.set(this.dashDir.x * this.dashSpeed, this.dashDir.y * this.dashSpeed, this.dashDir.z * this.dashSpeed);
      const wasG = this.onGround; this.onGround = false;
      this.collide(dt, boxes, wasG);
      if (this.dashT <= 0) { // exit with a little carry
        const k = this.dashExit / Math.max(1e-3, this.hSpeed);
        this.vel.x *= Math.min(1, k); this.vel.z *= Math.min(1, k); this.vel.y = Math.min(this.vel.y, 2);
        this.events.push({ type: 'dashEnd' });
      }
      this.justLanded = false; this.airTime = this.onGround ? 0 : this.airTime + dt;
      return;
    }

    // ---- slide start: tap crouch while running (press is buffered so a tap just before
    // landing still slides), or land while holding crouch. Releasing crouch (or pulling back) stops it.
    this.crouchBuf = c.crouchPressed ? M.slideBuffer : Math.max(0, (this.crouchBuf || 0) - dt);
    if (!this.sliding && this.onGround && hs >= M.slideMin && this.slideCd <= 0 &&
        (this.crouchBuf > 0 || (this.justLanded && c.crouchHeld))) {
      this.sliding = true;
      this.crouchBuf = 0;
      this.slideT = M.slideTime;
      this.slideDir.set(this.vel.x / hs, 0, this.vel.z / hs);
      this.slideSpeed = this.slideStart = Math.min(M.maxSpeed, Math.max(hs, M.slideBoost));
      this.events.push({ type: 'slide', v: this.slideSpeed });
    }

    let jumped = false;
    const canJump = this.onGround || this.airTime < M.coyote;

    if (this.sliding) {
      if (wantJump && canJump) {
        // slide-jump: keep slide speed + bonus
        const v = Math.min(M.maxSpeed, this.slideSpeed + M.slideJumpBonus);
        this.vel.x = this.slideDir.x * v; this.vel.z = this.slideDir.z * v;
        this.vel.y = M.jumpV * (this.jumpMul ?? 1);
        this.endSlide();
        jumped = true;
        this.events.push({ type: 'slidejump', v });
      } else {
        // friction bites immediately: ease-out curve loses speed fastest at the start, then settles
        const p = 1 - Math.max(0, this.slideT - dt) / M.slideTime;
        const k = 1 - Math.pow(1 - p, M.slideCurve);
        this.slideSpeed = M.crouch + (this.slideStart - M.crouch) * (1 - k);
        if (wl > 0) {
          const cross = this.slideDir.x * wz - this.slideDir.z * wx;
          const ang = Math.max(-M.slideTurn * dt, Math.min(M.slideTurn * dt, Math.atan2(cross, this.slideDir.x * wx + this.slideDir.z * wz)));
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const nx = this.slideDir.x * ca - this.slideDir.z * sa, nz = this.slideDir.x * sa + this.slideDir.z * ca;
          this.slideDir.set(nx, 0, nz);
        }
        this.vel.x = this.slideDir.x * this.slideSpeed; this.vel.z = this.slideDir.z * this.slideSpeed;
        this.slideT -= dt;
        // cancel early: let go of crouch or pull back, and the slide bleeds off like a real stop
        const held = M.slideTime - this.slideT;
        const cancel = held > 0.12 && (!c.crouchHeld || c.fwd < 0);
        if (cancel) { this.vel.x *= 0.55; this.vel.z *= 0.55; }
        if (cancel || this.slideT <= 0 || !this.onGround) this.endSlide();
      }
    } else {
      if (wantJump && canJump) {
        this.vel.y = M.jumpV * (this.jumpMul ?? 1);
        jumped = true;
        this.jumpBuf = 0;
        this.events.push({ type: 'jump', v: hs });
      } else if (c.jumpPressed && !this.onGround && this.airJumps > 0 && this.airTime > 0.08) {
        // double jump (Crystal Shard): a fresh press in mid-air
        this.vel.y = M.jumpV * 0.92; this.airJumps--;
        this.events.push({ type: 'jump', v: hs, air: true });
      }
      if (this.onGround) this.airJumps = this.extraJumps || 0;
      if (this.onGround && !jumped) {
        // Friction is skipped for the first bhopWindow after landing so a quick re-jump keeps speed.
        if (this.groundTime >= M.bhopWindow) this.applyFriction(dt);
        const wish = c.ads ? M.ads : this.crouched ? M.crouch : M.run;
        this.accelerate(wx, wz, wl > 0 ? wish * this.speedMul * Math.min(1, wl) : 0, M.accel, dt); // analog stick: partial tilt = slower
      } else {
        // Source-style air accel: tiny wishspeed cap, big accel = air strafing
        if (wl > 0) this.airAccelerate(wx, wz, M.run * this.speedMul, dt);
      }
    }

    // horizontal speed cap
    hs = this.hSpeed;
    if (hs > M.maxSpeed) { this.vel.x *= M.maxSpeed / hs; this.vel.z *= M.maxSpeed / hs; }

    // ---- crouch height
    const wantCrouch = c.crouchHeld || this.sliding;
    if (wantCrouch && !this.crouched) { this.crouched = true; this.h = M.hCrouch; }
    else if (!wantCrouch && this.crouched) {
      if (this.free(this.world.near(this.pos.x, this.pos.y, this.pos.z, 3), this.pos.y, M.hStand)) { this.crouched = false; this.h = M.hStand; }
    }

    // ---- gravity + collide
    // lighter gravity near the apex = a little hang time; slightly heavier on the way down
    const gMul = Math.abs(this.vel.y) < M.apexBand && !this.onGround ? M.apexMul : this.vel.y < 0 ? M.fallMul : 1;
    this.vel.y -= M.gravity * gMul * (this.gravityScale ?? 1) * dt;
    const wasGround = this.onGround;
    this.onGround = false;
    this.collide(dt, boxes, wasGround && !jumped);

    // ground snap when walking down steps
    if (!this.onGround && wasGround && !jumped && this.vel.y <= 0) {
      let best = null;
      for (const b of boxes) {
        const top = b.max[1];
        if (top <= this.pos.y + EPS && this.pos.y - top <= M.stepUp &&
            this.pos.x + this.r > b.min[0] && this.pos.x - this.r < b.max[0] &&
            this.pos.z + this.r > b.min[2] && this.pos.z - this.r < b.max[2]) {
          if (best === null || top > best) best = top;
        }
      }
      if (best !== null) { this.stepOffset += best - this.pos.y; this.pos.y = best; this.vel.y = 0; this.onGround = true; }
    }

    // ---- landing / timers
    this.justLanded = false;
    if (this.onGround) {
      if (!wasGround) {
        this.justLanded = true;
        this.vel.x *= 1 - M.bhopLoss; this.vel.z *= 1 - M.bhopLoss;
        this.events.push({ type: 'land', v: this.landVy || 0 });
        this.groundTime = 0;
      } else this.groundTime += dt;
      this.airTime = 0;
    } else {
      this.airTime = jumped ? M.coyote + 1 : this.airTime + dt; // jumping consumes coyote time
      this.groundTime = 0;
    }

    if (this.pos.y < this.world.killY) this.events.push({ type: 'fell' });
  }

  endSlide() { this.sliding = false; this.slideCd = MOVE.slideCd; }

  // Burst `dist` meters along `dir` (normalized, may include y) over `time` seconds.
  dash(dir, dist, time = 0.22, exit = 9) {
    this.dashDir = dir.clone().normalize();
    this.dashSpeed = dist / time;
    this.dashT = time;
    this.dashExit = exit;
    if (this.sliding) this.endSlide();
  }
  launch(vy) { this.vel.y = vy; this.onGround = false; this.airTime = MOVE.coyote + 1; this.jumpBuf = 0; }

  applyFriction(dt) {
    const sp = this.hSpeed;
    if (sp < 1e-4) { this.vel.x = this.vel.z = 0; return; }
    const control = Math.max(sp, MOVE.stopSpeed);
    const ns = Math.max(0, sp - control * MOVE.friction * dt);
    this.vel.x *= ns / sp; this.vel.z *= ns / sp;
  }
  accelerate(wx, wz, wish, accel, dt) {
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = wish - cur;
    if (add <= 0) return;
    const a = Math.min(accel * wish * dt, add);
    this.vel.x += a * wx; this.vel.z += a * wz;
  }
  airAccelerate(wx, wz, wish, dt) {
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = Math.min(wish, MOVE.airCap) - cur;
    if (add <= 0) return;
    const a = Math.min(MOVE.airAccel * wish * dt, add);
    this.vel.x += a * wx; this.vel.z += a * wz;
  }

  collide(dt, boxes, allowStep) {
    const p = this.pos, v = this.vel;
    const dist = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.1));
    const sdt = dt / n;
    this.landVy = 0;
    for (let i = 0; i < n; i++) {
      // X
      p.x += v.x * sdt;
      for (const b of boxes) if (this.overlaps(b)) {
        if (allowStep && this.tryStep(b, boxes)) continue;
        p.x = v.x > 0 ? b.min[0] - this.r - EPS : b.max[0] + this.r + EPS;
        v.x = 0;
      }
      // Z
      p.z += v.z * sdt;
      for (const b of boxes) if (this.overlaps(b)) {
        if (allowStep && this.tryStep(b, boxes)) continue;
        p.z = v.z > 0 ? b.min[2] - this.r - EPS : b.max[2] + this.r + EPS;
        v.z = 0;
      }
      // Y
      p.y += v.y * sdt;
      for (const b of boxes) if (this.overlaps(b)) {
        if (v.y <= 0) { this.landVy = Math.max(this.landVy, -v.y); p.y = b.max[1]; v.y = 0; this.onGround = true; }
        else { p.y = b.min[1] - this.h - EPS; v.y = 0; }
      }
    }
  }

  tryStep(b, boxes) {
    const rise = b.max[1] - this.pos.y;
    if (rise <= 0 || rise > MOVE.stepUp) return false;
    if (!this.free(boxes, b.max[1] + EPS, this.h)) return false;
    this.pos.y = b.max[1] + EPS;
    this.stepOffset += rise;
    return true;
  }
}
