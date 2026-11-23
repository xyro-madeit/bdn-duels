import { blocks } from './util.js';

// Snow Bridge: two cliffs joined by a long bridge over a chasm. Lower side ledges (y = -1.5)
// give a flanking route with steps up to each cliff; stone pillars rising from the chasm break
// sightlines between bridge and ledges. Falling = eliminated.
export const SNOW_BRIDGE = {
  id: 'snowbridge', name: 'Snow Bridge',
  palette: { ground: '#f4f8fb', wall: '#eaf1f6', trim: '#a9bccb', a: '#b5552f', b: '#e09a3e', c: '#cfe0ec', d: '#4f7fa6' },
  surfaces: { a: 'wood', b: 'wood', d: 'steel' },
  env: { sky: ['#4f9be0', '#a9d2f2', '#f2f8fc'], fog: 0xe8f2f9, fogNear: 35, fogFar: 125, sun: 3.0 },
  noGround: true, floorY: -24, killY: -6,
  teamSpawns: [
    [{ x: -17, y: 0, z: 0, yaw: -Math.PI / 2 }, { x: -17, y: 0, z: -3, yaw: -Math.PI / 2 }, { x: -17, y: 0, z: 3, yaw: -Math.PI / 2 }],
    [{ x: 17, y: 0, z: 0, yaw: Math.PI / 2 }, { x: 17, y: 0, z: 3, yaw: Math.PI / 2 }, { x: 17, y: 0, z: -3, yaw: Math.PI / 2 }],
  ],
  ffaSpawns: [
    { x: -17, y: 0, z: 0, yaw: -Math.PI / 2 }, { x: 17, y: 0, z: 0, yaw: Math.PI / 2 }, { x: -15, y: 0, z: -12, yaw: -Math.PI / 2 },
    { x: 15, y: 0, z: 12, yaw: Math.PI / 2 }, { x: -6, y: -1.5, z: 8.7, yaw: -Math.PI / 2 }, { x: 6, y: -1.5, z: -8.7, yaw: Math.PI / 2 },
    { x: -15, y: 0, z: 12, yaw: -Math.PI / 2 }, { x: 15, y: 0, z: -12, yaw: Math.PI / 2 },
  ],
  // distant snowy peaks and the chasm walls (scenery only)
  decor: (() => {
    const out = []; let seed = 3; const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2, d = 70 + r() * 50, w = 18 + r() * 22, h = 12 + r() * 30;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      out.push([x - w / 2, -24, z - w / 2, x + w / 2, h, z + w / 2, 'wall']);
    }
    return out;
  })(),
  blocks: blocks(({ box, mir }) => {
    mir(11, -24, -14, 20, 0, 14, 'wall');                  // cliffs
    box(-20, -24, 14, 20, 6, 17, 'wall'); box(-20, -24, -17, 20, 6, -14, 'wall'); // canyon walls (solid boundary)
    mir(19, 0, -14, 20, 4, 14, 'wall');                    // rock face behind each spawn
    box(-11, -0.8, -2.5, 11, 0, 2.5, 'trim');              // main bridge
    mir(1, 0, -2.5, 5, 1, -2.3, 'd'); mir(7, 0, -2.5, 11, 1, -2.3, 'd'); // railings with gaps
    mir(1, 0, 2.3, 5, 1, 2.5, 'd'); mir(7, 0, 2.3, 11, 1, 2.5, 'd');
    box(-1, 0, 0.6, 1, 1.3, 2.0, 'b');                     // bridge cover
    mir(5, 0, -2.0, 6.5, 1.2, -0.8, 'b');
    // side ledges + steps up to the cliffs
    box(-9, -2.3, 7.5, 9, -1.5, 10, 'c'); box(-9, -2.3, -10, 9, -1.5, -7.5, 'c');
    mir(9, -2.3, 7.5, 10, -1.0, 10, 'c'); mir(10, -2.3, 7.5, 11, -0.5, 10, 'c');
    mir(9, -2.3, -10, 10, -1.0, -7.5, 'c'); mir(10, -2.3, -10, 11, -0.5, -7.5, 'c');
    // stone pillars rising out of the chasm
    mir(3, -24, 4.6, 4.5, 2.5, 6.2, 'trim'); mir(3, -24, -6.2, 4.5, 2.5, -4.6, 'trim');
    // cabins + crates on the cliffs
    mir(14, 0, -9, 17, 3, -5, 'a'); mir(14, 0, 5, 17, 3, 9, 'a');
    mir(12, 0, -1, 13, 1.2, 1, 'b');
  }),
};
