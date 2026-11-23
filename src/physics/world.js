// Ray vs one AABB (slab test). Returns entry distance t or null.
export function rayAABB(o, d, min, max, maxT) {
  let t0 = 0, t1 = maxT;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (d[a] || 1e-12);
    let tn = (min[a] - o[a]) * inv, tf = (max[a] - o[a]) * inv;
    if (tn > tf) { const t = tn; tn = tf; tf = t; }
    if (tn > t0) t0 = tn;
    if (tf < t1) t1 = tf;
    if (t0 > t1) return null;
  }
  return t0;
}

// Static collision world: axis-aligned boxes in meters.
// box = { min:[x,y,z], max:[x,y,z], kill?:bool }
export class World {
  constructor() {
    this.boxes = [];
    this.killY = -25;
  }
  add(min, max, extra = {}) {
    const b = { min, max, ...extra };
    this.boxes.push(b);
    return b;
  }
  clear() { this.boxes.length = 0; }

  // Boxes overlapping the region around (x,y,z) with half-extent r (cheap broadphase).
  near(x, y, z, r) {
    const out = [];
    for (const b of this.boxes) {
      if (b.max[0] < x - r || b.min[0] > x + r) continue;
      if (b.max[2] < z - r || b.min[2] > z + r) continue;
      if (b.max[1] < y - r || b.min[1] > y + r + 2) continue;
      out.push(b);
    }
    return out;
  }

  // Ray vs boxes (slab test). Returns { t, box, normal } or null.
  raycast(o, d, maxT) {
    let best = null;
    for (const b of this.boxes) {
      let t0 = 0, t1 = maxT, nAxis = -1, nSign = 0;
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const inv = 1 / (d[a] || 1e-12);
        let tn = (b.min[a] - o[a]) * inv, tf = (b.max[a] - o[a]) * inv;
        let s = -1;
        if (tn > tf) { const t = tn; tn = tf; tf = t; s = 1; }
        if (tn > t0) { t0 = tn; nAxis = a; nSign = s; }
        if (tf < t1) t1 = tf;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && (!best || t0 < best.t)) {
        const normal = [0, 0, 0];
        if (nAxis >= 0) normal[nAxis] = nSign;
        best = { t: t0, box: b, normal };
      }
    }
    return best;
  }
}
