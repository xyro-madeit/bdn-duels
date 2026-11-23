import { blocks, sideSpawns } from './util.js';

// Warehouse: two floors. Mezzanines along the north and south walls (y = 5), four staircases,
// and a center catwalk with a drop-hole over a crate. Ground floor is racks and pallets.
// Sightlines: the catwalk sees the whole floor but is exposed from both mezzanines.
export const WAREHOUSE = {
  id: 'warehouse', name: 'Warehouse',
  palette: { ground: '#a29e96', wall: '#e2ddd2', trim: '#7d8790', a: '#f07a2a', b: '#e9c062', c: '#3d8bc7', d: '#9aa3ab' },
  surfaces: { wall: 'container', c: 'steel', a: 'steel' },
  env: { sky: ['#3a8ad6', '#8cc4ee', '#e3f1fb'], fog: 0xc9dbe8, fogNear: 50, fogFar: 150, sun: 3.2 },
  teamSpawns: [
    [{ x: -17, y: 0, z: 0, yaw: -Math.PI / 2 }, { x: -12, y: 0, z: -2.5, yaw: -Math.PI / 2 }, { x: -12, y: 0, z: 2.5, yaw: -Math.PI / 2 }],
    [{ x: 17, y: 0, z: 0, yaw: Math.PI / 2 }, { x: 12, y: 0, z: 2.5, yaw: Math.PI / 2 }, { x: 12, y: 0, z: -2.5, yaw: Math.PI / 2 }],
  ],
  ffaSpawns: [
    { x: -17, y: 0, z: 0, yaw: -Math.PI / 2 }, { x: 17, y: 0, z: 0, yaw: Math.PI / 2 }, { x: 0, y: 0, z: -15, yaw: Math.PI },
    { x: 0, y: 0, z: 15, yaw: 0 }, { x: -12, y: 5, z: 16, yaw: -Math.PI / 2 }, { x: 12, y: 5, z: -16, yaw: Math.PI / 2 },
    { x: -10, y: 0, z: -4, yaw: -Math.PI / 2 }, { x: 10, y: 0, z: 4, yaw: Math.PI / 2 },
  ],
  blocks: blocks(({ box, mir, stairs }) => {
    box(-22, -1, -22, 22, 0, 22, 'ground');
    box(-22, 0, -22, 22, 9, -20, 'wall'); box(-22, 0, 20, 22, 9, 22, 'wall');
    box(-22, 0, -20, -20, 9, 20, 'wall'); box(20, 0, -20, 22, 9, 20, 'wall');
    // mezzanines (walk on y = 5)
    box(-20, 4.6, 12, 20, 5, 20, 'c'); box(-20, 4.6, -20, 20, 5, -12, 'c');
    // center catwalk with a drop-hole from z -2 to 2
    box(-1.4, 4.6, 2, 1.4, 5, 12, 'c'); box(-1.4, 4.6, -12, 1.4, 5, -2, 'c');
    mir(1.4, 5, 2, 1.6, 6, 12, 'd'); mir(1.4, 5, -12, 1.6, 6, -2, 'd');
    // mezzanine railings (stair landings at |x| 15..18 stay open)
    mir(1.6, 5, 11.8, 14.8, 6, 12, 'd'); mir(1.6, 5, -12, 14.8, 6, -11.8, 'd');
    // four staircases up to the mezzanines
    stairs(15, 18, 4, +1, 10, 'd');
    stairs(15, 18, -4, -1, 10, 'd');
    // support columns
    for (const x of [-10, -4, 4, 10]) { box(x - 0.3, 0, 11.7, x + 0.3, 4.6, 12.3, 'trim'); box(x - 0.3, 0, -12.3, x + 0.3, 4.6, -11.7, 'trim'); }
    // ground floor: racks, pallets, crates
    mir(6, 0, -7, 7.2, 3.2, -1, 'd'); mir(6, 0, 1, 7.2, 3.2, 7, 'd');
    mir(11, 0, -1, 12.6, 1.2, 1, 'b');
    box(-1, 0, -1, 1, 1.1, 1, 'b');
    mir(3, 0, 8, 5, 2, 10, 'a'); mir(3, 0, -10, 5, 2, -8, 'a');
    mir(14, 0, -2.5, 15, 1.4, 2.5, 'trim');
    // roof trusses (open skylights between them)
    for (const z of [-16, -8, 0, 8, 16]) box(-20, 8.4, z - 0.25, 20, 9, z + 0.25, 'trim');
    box(-20, 8.6, -0.15, 20, 9, 0.15, 'trim');
    // mezzanine cover
    mir(6, 5, 14, 8, 6.2, 16, 'b'); mir(6, 5, -16, 8, 6.2, -14, 'b');
    box(-2, 5, 16, 2, 6, 18, 'a'); box(-2, 5, -18, 2, 6, -16, 'a');
  }),
};
