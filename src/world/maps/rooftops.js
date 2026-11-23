import { blocks } from './util.js';

// Rooftops: two buildings (roofs at y = 8) split by a 5.6 m gap. A normal running jump falls
// short (~5.1 m); a slide-jump started ~2 m before the edge clears it. A narrow plank at the north edge is the safe
// (but exposed) crossing. Falling off = eliminated.
export const ROOFTOPS = {
  id: 'rooftops', name: 'Rooftops',
  palette: { ground: '#3a4250', wall: '#e8e0d2', trim: '#a99f92', a: '#c9d1d9', b: '#f0a43c', c: '#3fa6c9', d: '#5b6672' },
  surfaces: { a: 'steel', c: 'steel', d: 'steel' },
  env: { sky: ['#3b6fd1', '#9bb8e8', '#ffc98f'], fog: 0xf0cdb0, fogNear: 55, fogFar: 175, sun: 3.2 },
  noGround: true, floorY: -14, killY: 2,
  // waypoints across the plank so bots can path between roofs
  navHints: [-3.4, -2.1, -0.7, 0.7, 2.1, 3.4].map((x) => ({ x, y: 8, z: 11.6 })),
  teamSpawns: [
    [{ x: -17, y: 8, z: 0, yaw: -Math.PI / 2 }, { x: -17, y: 8, z: -4, yaw: -Math.PI / 2 }, { x: -17, y: 8, z: 4, yaw: -Math.PI / 2 }],
    [{ x: 17, y: 8, z: 0, yaw: Math.PI / 2 }, { x: 17, y: 8, z: 4, yaw: Math.PI / 2 }, { x: 17, y: 8, z: -4, yaw: Math.PI / 2 }],
  ],
  ffaSpawns: [
    { x: -17, y: 8, z: 4, yaw: -Math.PI / 2 }, { x: 17, y: 8, z: -4, yaw: Math.PI / 2 }, { x: -9, y: 8, z: -11, yaw: -Math.PI / 2 },
    { x: 9, y: 8, z: 11, yaw: Math.PI / 2 }, { x: -10, y: 8, z: 4, yaw: -Math.PI / 2 }, { x: 10, y: 8, z: -4, yaw: Math.PI / 2 },
  ],
  // surrounding city skyline (scenery only)
  decor: (() => {
    const out = []; let seed = 7; const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2, d = 38 + r() * 40, w = 6 + r() * 9, h = 4 + r() * 26;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      out.push([x - w / 2, -14, z - w / 2, x + w / 2, h, z + w / 2, r() < 0.5 ? 'wall' : 'c']);
    }
    return out;
  })(),
  blocks: blocks(({ box, mir }) => {
    mir(2.8, -14, -14, 20, 8, 14, 'wall');                 // the two buildings
    mir(19.4, 8, -14, 20, 8.8, 14, 'trim');               // parapets (outer edges)
    mir(2.8, 8, -14, 20, 8.8, -13.4, 'trim'); mir(2.8, 8, 13.4, 20, 8.8, 14, 'trim');
    mir(2.8, 8, -13.4, 3.3, 8.8, -7, 'trim'); mir(2.8, 8, 7, 3.3, 8.8, 10.6, 'trim'); // gap-side parapets, open run-up in the middle
    box(-2.8, 7.8, 11, 2.8, 8, 12.2, 'b');                    // plank bridge
    mir(7, 8, -9, 9, 9.4, -7, 'a'); mir(7, 8, 7, 9, 9.4, 9, 'a');   // AC units
    mir(12, 8, -2, 15, 11, 2, 'c');                        // roof-access sheds
    mir(15.5, 8, -11, 18, 9, -6, 'd');                     // vents
    mir(5, 8, -1, 6, 9.1, 1, 'a');                         // low cover by the gap
    mir(14, 8, 8, 18, 10.5, 12, 'c');                      // water tank base
  }),
};
