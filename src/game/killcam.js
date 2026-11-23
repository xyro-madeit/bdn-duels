// Killcam: a 5 s ring buffer of every actor's pose at 30 Hz. On death we replay the last
// 3.5 s in third person orbiting the killer, driving the actors' models from the recording.
const HZ = 30, KEEP = 5;

export class Killcam {
  constructor() { this.frames = []; this.acc = 0; this.play = null; }

  record(dt, time, actors) {
    this.acc += dt;
    if (this.acc < 1 / HZ) return;
    this.acc = 0;
    this.frames.push({ t: time, s: actors.map((a) => ({ a, x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: a.yaw, pitch: a.pitch, alive: a.alive, cr: a.mover.crouched, sp: a.mover.hSpeed, g: a.mover.onGround, w: a.def && a.def.id, f: a.firedT || 0 })) });
    while (this.frames.length && this.frames[0].t < time - KEEP) this.frames.shift();
  }

  start(killer, victim, time, len = 3.5) {
    if (!this.frames.length) return false;
    this.play = { killer, victim, t0: Math.max(this.frames[0].t, time - len), t1: time + 0.4, t: 0 };
    this.play.t = this.play.t0;
    return true;
  }

  stop() { this.play = null; }
  get active() { return !!this.play; }

  // advance playback; returns the interpolated snapshot list or null when done
  step(dt) {
    const P = this.play;
    if (!P) return null;
    P.t += dt;
    if (P.t >= P.t1) { this.play = null; return null; }
    const F = this.frames;
    let i = F.findIndex((f) => f.t >= P.t);
    if (i < 0) i = F.length - 1;
    const b = F[i], a = F[Math.max(0, i - 1)];
    const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (P.t - a.t) / (b.t - a.t)));
    return b.s.map((sb) => {
      const sa = a.s.find((x) => x.a === sb.a) || sb;
      const L = (p, q) => p + (q - p) * k;
      return { a: sb.a, x: L(sa.x, sb.x), y: L(sa.y, sb.y), z: L(sa.z, sb.z), yaw: L(sa.yaw, sb.yaw), pitch: L(sa.pitch, sb.pitch), alive: k < 0.5 ? sa.alive : sb.alive, cr: sb.cr, sp: sb.sp, g: sb.g, w: sb.w, f: sb.f, t: P.t };
    });
  }
}
