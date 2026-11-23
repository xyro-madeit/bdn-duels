import * as THREE from 'three';

// First-person camera feel: interpolated position, smoothed eye height, step smoothing,
// spring landing dip, slide roll, head bob, speed FOV and hit shake.
export class FPSCamera {
  constructor(camera) {
    this.cam = camera;
    this.baseHFov = 90;
    this.eye = 1.62;
    this.stepSmooth = 0;
    this.dip = 0; this.dipV = 0;
    this.roll = 0;
    this.bob = 0;
    this.fovBoost = 0;
    this.bobScale = 1; // 0 turns head bob off (settings)
    this.zoom = 1; // ADS magnification (set each frame by the weapon system)
    this.shakeT = 0; this.shakeAmp = 0;
    this.tmp = new THREE.Vector3();
  }

  onEvents(events) {
    for (const e of events) {
      if (e.type === 'land' && e.v > 4) this.dipV -= Math.min(e.v, 22) * 0.03;
      if (e.type === 'slide') this.dipV -= 0.25;
    }
  }
  onStep(offset) { this.stepSmooth -= offset; } // lifted instantly; camera catches up
  shake(amp = 0.012, t = 0.15) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, t); }

  update(m, input, alpha, dt) {
    const c = this.cam;
    const p = this.tmp.lerpVectors(m.prevPos, m.pos, alpha);
    const targetEye = m.crouched ? 0.95 : 1.62;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 16);
    this.stepSmooth *= Math.exp(-dt * 14);
    // spring for landing dip
    const k = 140, d = 18;
    this.dipV += (-k * this.dip - d * this.dipV) * dt;
    this.dip += this.dipV * dt;
    this.dip = Math.max(-0.35, Math.min(0.1, this.dip));

    const hs = m.hSpeed;
    let bobY = 0, bobRoll = 0;
    if (m.onGround && !m.sliding && hs > 0.5) {
      this.bob += hs * dt * 1.3;
      const amt = Math.min(1, hs / 7.4);
      bobY = Math.sin(this.bob * 2) * 0.014 * amt * this.bobScale;
      bobRoll = Math.sin(this.bob) * 0.003 * amt * this.bobScale;
    }
    const targetRoll = m.sliding ? THREE.MathUtils.degToRad(3) : 0;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 10);

    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sx = (Math.random() - 0.5) * this.shakeAmp; sy = (Math.random() - 0.5) * this.shakeAmp;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }

    c.position.set(p.x, p.y + this.eye + this.stepSmooth + this.dip + bobY, p.z);
    c.rotation.set(input.pitch + sy, input.yaw + sx, this.roll + bobRoll);

    // FOV: horizontal base converted to the vertical fov three.js expects, +6° above 8 m/s
    const boostT = hs > 8.5 ? Math.min(1, (hs - 8.5) / 3) * 4 : 0;
    this.fovBoost += (boostT - this.fovBoost) * Math.min(1, dt * 5);
    const hf = THREE.MathUtils.degToRad(this.baseHFov + this.fovBoost * (this.zoom > 1.01 ? 0 : 1));
    const vf = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / this.zoom / c.aspect));
    if (Math.abs(vf - c.fov) > 0.01) { c.fov = vf; c.updateProjectionMatrix(); }
  }
}
