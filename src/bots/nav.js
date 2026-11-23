// Navigation graph built automatically from the map. Nodes sit on every walkable surface
// (ground, mezzanines, roofs, bridges) on a 1.5 m grid wherever a standing player fits.
// Links: two-way between neighbours within a step-up (0.6 m) with a clear body-width corridor;
// one-way "drop" links off ledges (up to 5.5 m down). Bots run A* over it.
const STEP = 1.5, R = 0.4, H = 1.8;

export class NavGraph {
  constructor(world, opts = {}) {
    this.world = world;
    const b = opts.bounds || { x0: -19.5, x1: 19.5, z0: -19.5, z1: 19.5 };
    const minY = opts.minY ?? Math.max(-6, (world.killY ?? -25) + 0.5);
    this.nodes = [];
    const cells = new Map();
    const key = (i, k) => i + ',' + k;
    for (let x = b.x0, i = 0; x <= b.x1 + 1e-6; x += STEP, i++) for (let z = b.z0, k = 0; z <= b.z1 + 1e-6; z += STEP, k++) {
      for (const y of this.surfacesAt(x, z, minY)) this.addNode(x, y, z, cells, key(i, k));
    }
    for (const h of opts.hints || []) {
      const i = Math.round((h.x - b.x0) / STEP), k = Math.round((h.z - b.z0) / STEP);
      this.addNode(h.x, h.y, h.z, cells, key(i, k));
    }
    // link neighbours (3x3 cells)
    for (const n of this.nodes) {
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        const list = cells.get(key(n.i + di, n.k + dk));
        if (!list) continue;
        for (const m of list) {
          if (m === n || n.links.some((l) => l.n === m)) continue;
          const d = Math.hypot(n.x - m.x, n.z - m.z);
          if (d > STEP * 1.5 + 0.01) continue;
          const dy = m.y - n.y;
          if (Math.abs(dy) <= 0.6) { if (this.walkable(n, m, Math.max(n.y, m.y)) && this.supported(n, m)) n.links.push({ n: m, d }); }
          else if (dy < -0.6 && dy >= -5.5 && this.walkable(n, m, n.y)) n.links.push({ n: m, d: d + 1 }); // drop
        }
      }
    }
  }

  addNode(x, y, z, cells, ck) {
    const i = +ck.split(',')[0], k = +ck.split(',')[1];
    const n = { x, y, z, i, k, links: [] };
    this.nodes.push(n);
    if (!cells.has(ck)) cells.set(ck, []);
    cells.get(ck).push(n);
  }

  // top faces under (x,z) that support a standing player with headroom
  surfacesAt(x, z, minY) {
    const out = [];
    const tops = [];
    for (const bx of this.world.boxes) {
      if (bx.temp) continue;
      if (x - 0.15 < bx.min[0] || x + 0.15 > bx.max[0] || z - 0.15 < bx.min[2] || z + 0.15 > bx.max[2]) continue;
      if (bx.max[1] < minY || bx.max[1] > 30) continue;
      tops.push(bx.max[1]);
    }
    for (const y of tops) {
      let ok = true;
      for (const bx of this.world.boxes) {
        if (x + R <= bx.min[0] || x - R >= bx.max[0] || z + R <= bx.min[2] || z - R >= bx.max[2]) continue;
        if (y + 0.05 < bx.max[1] && y + H > bx.min[1]) { ok = false; break; }
      }
      if (ok && !out.some((v) => Math.abs(v - y) < 0.1)) out.push(y);
    }
    return out;
  }

  // body-width corridor clear at knee and chest height, from height y
  walkable(a, b, y = a.y ?? 0) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    const d = [dx / len, 0, dz / len];
    for (const h of [0.65, 1.3]) for (const off of [-0.3, 0.3]) {
      const o = [a.x - d[2] * off, y + h, a.z + d[0] * off];
      if (this.world.raycast(o, d, len)) return false;
    }
    return true;
  }

  // floor all the way along a link (so paths never cut a corner over a gap)
  supported(a, b) {
    const lo = Math.min(a.y, b.y) - 0.7, hi = Math.max(a.y, b.y) + 0.6;
    for (let t = 0.25; t < 1; t += 0.25) {
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      let ok = false;
      for (const bx of this.world.boxes) {
        if (x < bx.min[0] - 0.05 || x > bx.max[0] + 0.05 || z < bx.min[2] - 0.05 || z > bx.max[2] + 0.05) continue;
        if (bx.max[1] >= lo && bx.max[1] <= hi) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }

  nearest(x, y, z) {
    let best = null, bd = 1e9;
    for (const n of this.nodes) {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2 + ((n.y - y) * 2) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // A* from world point a to world point b; returns [{x,y,z}, ...] or null
  path(a, b) {
    const s = this.nearest(a.x, a.y || 0, a.z), g = this.nearest(b.x, b.y || 0, b.z);
    if (!s || !g) return null;
    const open = new Map([[s, 0]]), came = new Map(), gs = new Map([[s, 0]]);
    const h = (n) => Math.hypot(n.x - g.x, n.z - g.z, n.y - g.y);
    let guard = 0;
    while (open.size && guard++ < 6000) {
      let cur = null, cf = 1e9;
      for (const [n, f] of open) if (f < cf) { cf = f; cur = n; }
      if (cur === g) {
        const out = [{ x: g.x, y: g.y, z: g.z }];
        let c = g; while (came.has(c)) { c = came.get(c); out.unshift({ x: c.x, y: c.y, z: c.z }); }
        return out;
      }
      open.delete(cur);
      for (const { n, d } of cur.links) {
        const ng = gs.get(cur) + d;
        if (ng < (gs.has(n) ? gs.get(n) : 1e9)) { gs.set(n, ng); came.set(n, cur); open.set(n, ng + h(n)); }
      }
    }
    return null;
  }
}
