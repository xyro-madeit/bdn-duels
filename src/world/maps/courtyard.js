import { blocks } from './util.js';

// Courtyard: sunlit sandstone plaza. Fountain in the middle, colonnades splitting the side
// lanes, raised terraces north and south (stairs in the center), market stalls by the spawns.
export const COURTYARD = {
  id: 'courtyard', name: 'Courtyard',
  palette: { ground: '#d4c39f', wall: '#f2e8d2', trim: '#d3bf96', a: '#c4703a', b: '#5fae5a', c: '#efe2c4', d: '#3f9fb8' },
  surfaces: { a: 'wood', c: 'concrete', b: 'concrete' },
  env: { sky: ['#2b88e0', '#86c3f2', '#fff3da'], fog: 0xf3ead8, fogNear: 60, fogFar: 180, sun: 3.8 },
  teamSpawns: [
    [{ x: -17, y: 0, z: 0, yaw: -Math.PI / 2 }, { x: -17, y: 0, z: -5, yaw: -Math.PI / 2 }, { x: -17, y: 0, z: 5, yaw: -Math.PI / 2 }],
    [{ x: 17, y: 0, z: 0, yaw: Math.PI / 2 }, { x: 17, y: 0, z: 5, yaw: Math.PI / 2 }, { x: 17, y: 0, z: -5, yaw: Math.PI / 2 }],
  ],
  ffaSpawns: [
    { x: -17, y: 0, z: -12, yaw: -Math.PI / 2 }, { x: 17, y: 0, z: 12, yaw: Math.PI / 2 }, { x: -17, y: 0, z: 12, yaw: -Math.PI / 2 },
    { x: 17, y: 0, z: -12, yaw: Math.PI / 2 }, { x: -8, y: 2.5, z: 17, yaw: 0 }, { x: 8, y: 2.5, z: -17, yaw: Math.PI },
    { x: 0, y: 0, z: -8, yaw: Math.PI }, { x: 0, y: 0, z: 8, yaw: 0 },
  ],
  blocks: blocks(({ box, mir, stairs }) => {
    box(-22, -1, -22, 22, 0, 22, 'ground');
    box(-22, 0, -22, 22, 7, -20, 'wall'); box(-22, 0, 20, 22, 7, 22, 'wall');
    box(-22, 0, -20, -20, 7, 20, 'wall'); box(20, 0, -20, 22, 7, 20, 'wall');
    box(-22, 7, -22, 22, 7.4, -20, 'trim'); box(-22, 7, 20, 22, 7.4, 22, 'trim');
    // fountain: low basin ring + column
    box(-3, 0, -3, 3, 0.8, -2.4, 'trim'); box(-3, 0, 2.4, 3, 0.8, 3, 'trim');
    box(-3, 0, -2.4, -2.4, 0.8, 2.4, 'trim'); box(2.4, 0, -2.4, 3, 0.8, 2.4, 'trim');
    box(-2.4, 0, -2.4, 2.4, 0.3, 2.4, 'd');
    box(-0.6, 0, -0.6, 0.6, 2.6, 0.6, 'c'); box(-1.2, 2.6, -1.2, 1.2, 2.9, 1.2, 'c');
    // colonnades: pillars + lintel beams
    for (const z of [-12, -6, 0, 6, 12]) mir(8, 0, z - 0.5, 9, 4, z + 0.5, 'c');
    mir(8, 4, -12.5, 9, 4.6, 12.5, 'trim');
    // terraces north/south with center stairs
    box(-12, 0, 15, 12, 2.5, 20, 'c'); box(-12, 0, -20, 12, 2.5, -15, 'c');
    stairs(-2, 2, 11, +1, 5, 'trim', 0, 0.8, false);
    stairs(-2, 2, -11, -1, 5, 'trim', 0, 0.8, false);
    mir(2, 2.5, 15, 12, 3.3, 15.3, 'trim'); mir(2, 2.5, -15.3, 12, 3.3, -15, 'trim'); // terrace balustrades
    // planters, stalls, low walls
    mir(4, 0, -9, 6, 0.9, -7, 'b'); mir(4, 0, 7, 6, 0.9, 9, 'b');
    mir(12, 0, -3, 13, 1.1, 3, 'trim');
    mir(14, 0, -10, 16, 2.2, -8, 'a'); mir(14, 0, 8, 16, 2.2, 10, 'a');
  }),
};
