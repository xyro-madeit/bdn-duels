// Block-list helpers for map files. All maps are mirror-symmetric across x = 0 so both
// teams get the same lanes. Block = [x0, y0, z0, x1, y1, z1, colorKey].
export function blocks(fn) {
  const B = [];
  const box = (x0, y0, z0, x1, y1, z1, k) => B.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), k]);
  const mir = (x0, y0, z0, x1, y1, z1, k) => { box(x0, y0, z0, x1, y1, z1, k); box(-x1, y0, z0, -x0, y1, z1, k); };
  // stairs from (x0..x1) climbing along z from z0 toward z0 + n*run (dir = +1 / -1), 0.5 m risers
  const stairs = (x0, x1, z0, dir, n, k, base = 0, run = 0.8, m = true) => {
    for (let i = 0; i < n; i++) {
      const za = z0 + dir * i * run, zb = za + dir * run;
      (m ? mir : box)(x0, base, za, x1, base + (i + 1) * 0.5, zb, k);
    }
  };
  fn({ box, mir, stairs });
  return B;
}

export const sideSpawns = (x, y, zs, yaw) => zs.map((z) => ({ x, y, z, yaw }));
