// Crate Yard: 40x40 m, mirror-symmetric across x = 0 (spawns at x = ±16).
// Sightline notes: the center tower sees both lanes but is exposed from both stairs;
// side lanes are broken every ~8 m by containers so no lane is longer than ~18 m unbroken.
// Blocks: [x0, y0, z0, x1, y1, z1, colorKey]
export const CRATE_YARD = {
  id: 'crateyard',
  name: 'Crate Yard',
  // bright arena palette: clean concrete, red-orange and blue containers, yellow crates
  palette: {
    ground: '#bdb8ac', wall: '#ebe6db', trim: '#c4bdae',
    a: '#e2553b', b: '#f2b33d', c: '#2f7fd6', d: '#8d96a0',
  },
  env: { sky: ['#2f8fe8', '#7fc0f5', '#e6f4ff'], fog: 0xd6ecfb, fogNear: 60, fogFar: 180, sun: 3.6 },
  spawns: [{ x: -16, z: 0, yaw: -Math.PI / 2 }, { x: 16, z: 0, yaw: Math.PI / 2 }],
  // team sides (yaw faces the middle); FFA points spread around the yard
  teamSpawns: [
    [{ x: -16, z: 0, yaw: -Math.PI / 2 }, { x: -17, z: -9, yaw: -Math.PI / 2 }, { x: -17, z: 9, yaw: -Math.PI / 2 }],
    [{ x: 16, z: 0, yaw: Math.PI / 2 }, { x: 17, z: 9, yaw: Math.PI / 2 }, { x: 17, z: -9, yaw: Math.PI / 2 }],
  ],
  ffaSpawns: [
    { x: -17, z: -17, yaw: -Math.PI * 0.75 }, { x: 17, z: 17, yaw: Math.PI * 0.25 }, { x: -17, z: 17, yaw: -Math.PI * 0.25 },
    { x: 17, z: -17, yaw: Math.PI * 0.75 }, { x: -16, z: 0, yaw: -Math.PI / 2 }, { x: 16, z: 0, yaw: Math.PI / 2 },
    { x: 0, z: 11, yaw: 0 }, { x: 0, z: -11, yaw: Math.PI },
  ],
  blocks: buildBlocks(),
};

function buildBlocks() {
  const B = [];
  const box = (x0, y0, z0, x1, y1, z1, k) => B.push([x0, y0, z0, x1, y1, z1, k]);
  // mirror across x=0
  const mir = (x0, y0, z0, x1, y1, z1, k) => { box(x0, y0, z0, x1, y1, z1, k); box(-x1, y0, z0, -x0, y1, z1, k); };

  // ground + perimeter walls
  box(-22, -1, -22, 22, 0, 22, 'ground');
  box(-22, 0, -22, 22, 5, -20, 'wall');
  box(-22, 0, 20, 22, 5, 22, 'wall');
  box(-22, 0, -20, -20, 5, 20, 'wall');
  box(20, 0, -20, 22, 5, 20, 'wall');
  // wall caps
  box(-22, 5, -22, 22, 5.3, -20, 'trim');
  box(-22, 5, 20, 22, 5.3, 22, 'trim');
  box(-22, 5, -20, -20, 5.3, 20, 'trim');
  box(20, 5, -20, 22, 5.3, 20, 'trim');

  // center tower: 4x4 platform at 3 m, stairs on ±x (0.5 m steps)
  box(-2, 0, -2, 2, 3, 2, 'c');
  box(-2, 3, -2.0, 2, 3.9, -1.7, 'trim'); // parapets on z sides
  box(-2, 3, 1.7, 2, 3.9, 2.0, 'trim');
  for (let i = 0; i < 6; i++) mir(2 + i * 0.6, 0, -1, 2 + (i + 1) * 0.6, 3 - i * 0.5, 1, 'b');

  // spawn cover (L-walls)
  mir(13, 0, -4, 14, 1.4, 4, 'd');
  mir(10, 0, 6, 15, 2.6, 7, 'a');
  mir(10, 0, -7, 15, 2.6, -6, 'a');

  // side-lane shipping containers (6 x 2.6 x 2.5)
  mir(4, 0, 9, 10, 2.6, 11.5, 'c');
  mir(4, 0, -11.5, 10, 2.6, -9, 'a');
  box(-3, 0, 14, 3, 2.6, 16.5, 'a');           // center-lane container north
  box(-3, 0, -16.5, 3, 2.6, -14, 'c');         // center-lane container south
  box(-3, 2.6, 14.4, 1, 5.2, 16.5, 'b');       // stacked
  box(-1, 2.6, -16.5, 3, 5.2, -14.4, 'b');

  // crates (1 m: needs a jump; 0.5 m: step up)
  mir(6, 0, 3, 7, 1, 4, 'b');
  mir(6, 0, -4, 7, 1, -3, 'b');
  mir(7, 0, -4, 7.5, 0.5, -3, 'trim');
  mir(16, 0, 14, 18, 2, 16, 'c');
  mir(16, 0, -16, 18, 2, -14, 'a');
  mir(15, 0, 14, 16, 1, 16, 'b');              // step crate up to the corner box
  mir(15, 0, -16, 16, 1, -14, 'b');

  // low walls in the mid-lanes for slide cover
  mir(6, 0, 13, 9, 1.0, 13.5, 'd');
  mir(6, 0, -13.5, 9, 1.0, -13, 'd');
  return B;
}
