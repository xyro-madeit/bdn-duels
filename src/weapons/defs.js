// Weapon stats. Angles in degrees, times in seconds, damage per bullet/pellet.
// Direction targets (body TTK): Striker ~0.45 s, Wasp ~0.38 s, Breacher one pump < 4 m,
// Longshot one-shot headshot / 85 body, Judge 2 head / 3 body, Quill one-hit headshot.
//
// kind: auto | semi | burst | pump | spin | proj | melee | util
// inspect: how the toss-and-catch spins it  { axis: 'x'|'y'|'z', turns, height }

const gun = (o) => ({
  head: 1.6, falloff: [30, 60, 0.8], range: 200,
  spreadHip: 1.5, spreadAds: 0.1, spreadMove: 1.2, spreadAir: 3.0, bloomPer: 0.12, bloomMax: 1.2,
  adsTime: 0.25, adsZoom: 1.3, adsSens: 0.85, equip: 0.4, pellets: 1,
  magOutAt: 0.22, magInAt: 0.62,
  recoil: { up: [0.6], side: 0.25, recover: 10 },
  kick: 0.03, kickRot: 0.05, shake: 0.004,
  inspect: { axis: 'x', turns: 1, height: 0.42 },
  ...o,
});

export const WEAPONS = {
  // ---------------- primaries
  striker: gun({
    id: 'striker', name: 'Striker', slot: 'primary', kind: 'auto', desc: 'Full-auto rifle. Steady all-rounder.',
    dmg: 25, rate: 0.15, mag: 30, reserve: 120, reload: 2.0, reloadEmpty: 2.4,
    recoil: { up: [0.45, 0.55, 0.65, 0.75, 0.8, 0.75, 0.7, 0.65], side: 0.32, recover: 9 },
    vm: { hip: [0.13, -0.135, -0.28], adsZ: -0.12, sightY: 0.1 },
  }),
  triburst: gun({
    id: 'triburst', name: 'Tri-Burst', slot: 'primary', kind: 'burst', desc: '3-round burst rifle. Reward for precise taps.',
    dmg: 30, head: 1.7, rate: 0.065, burst: 3, burstDelay: 0.3, mag: 24, reserve: 96, reload: 2.1, reloadEmpty: 2.5,
    spreadHip: 1.8, adsZoom: 1.45, adsTime: 0.28,
    recoil: { up: [0.5, 0.6, 0.7], side: 0.18, recover: 12 },
    vm: { hip: [0.13, -0.135, -0.28], adsZ: -0.13, sightY: 0.1 },
    inspect: { axis: 'z', turns: 2, height: 0.4 },
  }),
  wasp: gun({
    id: 'wasp', name: 'Wasp', slot: 'primary', kind: 'auto', desc: 'Fast SMG. Melts up close, falls off fast.',
    dmg: 17, head: 1.4, rate: 0.075, mag: 32, reserve: 160, reload: 1.7, reloadEmpty: 2.0,
    falloff: [12, 30, 0.6], range: 120, spreadHip: 2.0, spreadAds: 0.35, spreadMove: 0.6, adsZoom: 1.15, adsTime: 0.18, equip: 0.3,
    recoil: { up: [0.3, 0.35, 0.4], side: 0.4, recover: 12 },
    vm: { hip: [0.12, -0.13, -0.26], adsZ: -0.16, sightY: 0.075 },
    inspect: { axis: 'y', turns: 2, height: 0.45 },
  }),
  breacher: gun({
    id: 'breacher', name: 'Breacher', slot: 'primary', kind: 'pump', desc: 'Pump shotgun. One pump up close.',
    dmg: 12.5, head: 1.5, pellets: 9, rate: 0.85, mag: 6, reserve: 30, shellTime: 0.45, reload: 0.45, reloadEmpty: 0.45,
    falloff: [4, 14, 0.3], range: 45, spreadHip: 4.5, spreadAds: 3.4, spreadMove: 0.5, spreadAir: 1, bloomPer: 0, adsZoom: 1.1,
    recoil: { up: [3.2], side: 0.6, recover: 16 }, kick: 0.07, kickRot: 0.2, shake: 0.012,
    vm: { hip: [0.13, -0.135, -0.28], adsZ: -0.16, sightY: 0.07 },
  }),
  twinfang: gun({
    id: 'twinfang', name: 'Twin Fang', slot: 'primary', kind: 'semi', desc: 'Double-barrel. Two huge blasts, then reload.',
    dmg: 12, head: 1.5, pellets: 12, rate: 0.22, mag: 2, reserve: 24, reload: 1.9, reloadEmpty: 1.9, magOutAt: 0.3, magInAt: 0.7,
    falloff: [5, 14, 0.3], range: 35, spreadHip: 6, spreadAds: 5, spreadMove: 0.5, spreadAir: 1, bloomPer: 0, adsZoom: 1.08,
    recoil: { up: [3.8], side: 0.8, recover: 14 }, kick: 0.08, kickRot: 0.24, shake: 0.016,
    vm: { hip: [0.13, -0.135, -0.28], adsZ: -0.16, sightY: 0.06 },
    inspect: { axis: 'x', turns: -1, height: 0.38 },
  }),
  longshot: gun({
    id: 'longshot', name: 'Longshot', slot: 'primary', kind: 'semi', desc: 'Bolt sniper. Headshot = elimination.',
    dmg: 85, head: 1.6, rate: 1.2, mag: 5, reserve: 25, reload: 2.6, reloadEmpty: 3.0,
    falloff: [200, 300, 1], range: 400, spreadHip: 6, spreadAds: 0, spreadMove: 3, spreadAir: 6, bloomPer: 0,
    adsZoom: 3.6, adsTime: 0.35, adsSens: 0.4, scope: true, equip: 0.55,
    recoil: { up: [2.6], side: 0.3, recover: 6 }, kick: 0.06, kickRot: 0.16, shake: 0.01,
    vm: { hip: [0.13, -0.13, -0.3], adsZ: -0.2, sightY: 0.1 },
  }),
  quill: gun({
    id: 'quill', name: 'Quill', slot: 'primary', kind: 'proj', desc: 'Crossbow. Bolts drop a little; headshots one-hit.',
    dmg: 70, head: 2.0, rate: 0.15, mag: 1, reserve: 20, reload: 0.9, reloadEmpty: 0.9, autoReload: true,
    proj: { speed: 90, gravity: 4, model: 'bolt' }, spreadHip: 1.2, spreadAds: 0, bloomPer: 0, adsZoom: 1.6,
    recoil: { up: [1.0], side: 0.1, recover: 10 }, kick: 0.04, kickRot: 0.06,
    vm: { hip: [0.13, -0.13, -0.28], adsZ: -0.15, sightY: 0.08 },
    inspect: { axis: 'y', turns: 1, height: 0.36 },
  }),
  buzzsaw: gun({
    id: 'buzzsaw', name: 'Buzzsaw', slot: 'primary', kind: 'spin', desc: 'Minigun. Spin up, then shred. Slows you down.',
    dmg: 11, head: 1.4, rate: 0.05, spinUp: 0.6, mag: 150, reserve: 300, reload: 3.6, reloadEmpty: 3.6, 
    falloff: [15, 40, 0.6], range: 150, spreadHip: 2.4, spreadAds: 1.4, bloomPer: 0.03, bloomMax: 1, adsZoom: 1.1, equip: 0.7,
    recoil: { up: [0.12], side: 0.25, recover: 14 }, kick: 0.012, kickRot: 0.015, shake: 0.003,
    vm: { hip: [0.12, -0.16, -0.32], adsZ: -0.25, sightY: 0.12 },
    inspect: { axis: 'z', turns: 1, height: 0.2 },
  }),

  // ---------------- secondaries
  glasscannon: gun({
    id: 'glasscannon', name: 'Glass Cannon', slot: 'primary', kind: 'semi', desc: 'One crystal round. 150 damage anywhere it lands.',
    dmg: 150, head: 1, rate: 0.6, mag: 1, reserve: 0, reload: 1.5, reloadEmpty: 1.5, glass: true,
    range: 220, falloff: [999, 1000, 1], spreadHip: 0.9, spreadAds: 0, spreadMove: 0.6, bloomPer: 0, adsZoom: 1.35, adsTime: 0.22, equip: 0.45,
    recoil: { up: [5.5], side: 0.4, recover: 8 }, kick: 0.09, kickRot: 0.35, shake: 0.016,
    vm: { hip: [0.1, -0.1, -0.27], adsZ: -0.22, sightY: 0.072 },
    inspect: { axis: 'y', turns: 2, height: 0.45 },
  }),
  sidekick: gun({
    id: 'sidekick', name: 'Sidekick', slot: 'secondary', kind: 'semi', desc: 'Reliable pistol. 2 headshots.',
    dmg: 25, head: 2.0, rate: 0.14, mag: 12, reserve: 60, reload: 1.4, reloadEmpty: 1.6, magOutAt: 0.2, magInAt: 0.6,
    range: 120, falloff: [20, 45, 0.7], spreadHip: 1.0, spreadAds: 0.08, spreadMove: 0.8, spreadAir: 2.5, bloomPer: 0.3, bloomMax: 1.0,
    adsTime: 0.18, adsZoom: 1.15, adsSens: 0.9, equip: 0.3,
    recoil: { up: [1.25], side: 0.22, recover: 14 }, kick: 0.045, kickRot: 0.11,
    vm: { hip: [0.095, -0.095, -0.25], adsZ: -0.2, sightY: 0.078 },
    inspect: { axis: 'z', turns: 3, height: 0.4 },
  }),
  judge: gun({
    id: 'judge', name: 'Judge', slot: 'secondary', kind: 'semi', desc: 'Revolver. 2 to the head, 3 to the body.',
    dmg: 34, head: 1.8, rate: 0.42, mag: 6, reserve: 36, reload: 2.2, reloadEmpty: 2.2, magOutAt: 0.25, magInAt: 0.7,
    range: 150, falloff: [25, 50, 0.8], spreadHip: 1.1, spreadAds: 0.05, bloomPer: 0.4, adsZoom: 1.2, adsTime: 0.2, equip: 0.35,
    recoil: { up: [2.2], side: 0.3, recover: 12 }, kick: 0.05, kickRot: 0.2, shake: 0.007,
    vm: { hip: [0.095, -0.095, -0.25], adsZ: -0.2, sightY: 0.07 },
    inspect: { axis: 'y', turns: 3, height: 0.42 },
  }),
  hornet: gun({
    id: 'hornet', name: 'Hornet', slot: 'secondary', kind: 'auto', desc: 'Machine pistol. Spray at close range.',
    dmg: 14, head: 1.4, rate: 0.06, mag: 32, reserve: 128, reload: 1.5, reloadEmpty: 1.8,
    falloff: [8, 22, 0.55], range: 90, spreadHip: 2.5, spreadAds: 0.9, spreadMove: 0.5, adsZoom: 1.1, adsTime: 0.16, equip: 0.25,
    recoil: { up: [0.35], side: 0.5, recover: 12 }, kick: 0.025, kickRot: 0.05,
    vm: { hip: [0.095, -0.1, -0.25], adsZ: -0.2, sightY: 0.07 },
    inspect: { axis: 'z', turns: 2, height: 0.35 },
  }),
  boomer: gun({
    id: 'boomer', name: 'Boomer', slot: 'secondary', kind: 'proj', desc: 'Hand cannon. Heavy ball with drop and a small blast.',
    dmg: 75, head: 1.4, rate: 0.3, mag: 2, reserve: 16, reload: 1.6, reloadEmpty: 1.6,
    proj: { speed: 60, gravity: 14, model: 'ball', splash: { r: 1.6, dmg: 25 } }, spreadHip: 0.8, spreadAds: 0, bloomPer: 0, adsZoom: 1.15,
    recoil: { up: [4.5], side: 0.5, recover: 10 }, kick: 0.08, kickRot: 0.3, shake: 0.014, equip: 0.4,
    vm: { hip: [0.1, -0.1, -0.26], adsZ: -0.22, sightY: 0.097 },
  }),
  signal: gun({
    id: 'signal', name: 'Signal', slot: 'secondary', kind: 'proj', desc: 'Flare gun. Sets targets on fire and lights them up.',
    dmg: 20, head: 1.5, rate: 0.3, mag: 1, reserve: 12, reload: 1.6, reloadEmpty: 1.6, autoReload: true,
    proj: { speed: 45, gravity: 9, model: 'flare', burn: { dps: 8, time: 4 } }, spreadHip: 0.6, spreadAds: 0, bloomPer: 0, adsZoom: 1.1,
    recoil: { up: [2.5], side: 0.2, recover: 10 }, kick: 0.05, kickRot: 0.18, equip: 0.35,
    vm: { hip: [0.1, -0.1, -0.26], adsZ: -0.22, sightY: 0.075 },
    inspect: { axis: 'x', turns: 2, height: 0.45 },
  }),

  // ---------------- melee (LMB swing; RMB special where listed)
  fists: melee({ id: 'fists', name: 'Fists', desc: 'Fast jabs.', vm: { hip: [0.11, -0.16, -0.4], adsZ: -0.3, sightY: 0 }, dmg: 25, swing: 0.32, hitAt: 0.45, range: 2.2, arc: 60, inspect: { axis: 'none', turns: 0, height: 0 } }),
  knife: melee({ id: 'knife', vm: { hip: [0.15, -0.17, -0.34], adsZ: -0.3, sightY: 0 },  name: 'Butterfly Knife', desc: 'Balisong. Quick slash, flashy flips.', dmg: 35, swing: 0.4, hitAt: 0.4, range: 2.3, arc: 70, inspect: { axis: 'x', turns: 3, height: 0.5, style: 'balisong', dur: 2.2 } }),
  katana: melee({ id: 'katana', name: 'Katana', desc: 'Fast, long reach.', dmg: 45, swing: 0.55, hitAt: 0.42, range: 2.8, arc: 90, inspect: { axis: 'z', turns: 1, height: 0.55 } }),
  doubleedge: melee({ id: 'doubleedge', name: 'Double-Edge', desc: 'Two-sided blade, heavy swing.', dmg: 50, swing: 0.62, hitAt: 0.45, range: 2.7, arc: 110, inspect: { axis: 'y', turns: 2, height: 0.5 } }),
  scythe: melee({ id: 'scythe', name: 'Scythe', desc: 'Wide sweep that hits everything in front of you.', dmg: 55, swing: 0.78, hitAt: 0.5, range: 3.0, arc: 150, vm: { hip: [0.3, -0.42, -0.58], adsZ: -0.3, sightY: 0 }, inspect: { axis: 'y', turns: 1, height: 0.3 } }),
  hammer: melee({ id: 'hammer', name: 'Hammer', desc: 'Slow, huge damage, knocks back.', dmg: 70, swing: 1.0, hitAt: 0.55, range: 2.5, arc: 70, knock: 9, vm: { hip: [0.24, -0.32, -0.46], adsZ: -0.3, sightY: 0 }, inspect: { axis: 'x', turns: 1, height: 0.25, style: 'shoulder', dur: 2.0 } }),
  karambit: melee({ id: 'karambit', vm: { hip: [0.15, -0.17, -0.34], adsZ: -0.3, sightY: 0 },  name: 'Karambit', desc: 'Hooked blade. Very fast slashes.', dmg: 30, swing: 0.3, hitAt: 0.4, range: 2.1, arc: 75, inspect: { axis: 'z', turns: 2, height: 0.35, style: 'karambit' } }),
  rapier: melee({ id: 'rapier', name: 'Rapier', desc: 'Thrusting sword. Longest reach, narrow hit.', dmg: 42, swing: 0.45, hitAt: 0.45, range: 3.2, arc: 35, inspect: { axis: 'z', turns: 1, height: 0.5, style: 'salute', dur: 2.0 } }),
  bat: melee({ id: 'bat', name: 'Baseball Bat', desc: 'Taped wooden bat. Big swings, knocks back.', dmg: 55, swing: 0.75, hitAt: 0.5, range: 2.6, arc: 100, knock: 7, vm: { hip: [0.22, -0.3, -0.44], adsZ: -0.3, sightY: 0 }, inspect: { axis: 'x', turns: 1, height: 0.4, style: 'shoulder', dur: 2.0 } }),
  shard: melee({ id: 'shard', vm: { hip: [0.15, -0.17, -0.34], adsZ: -0.3, sightY: 0 },  name: 'Crystal Shard', desc: 'Glass blade. 1 damage from the front, 150 in the back. Lets you double jump.', dmg: 1, backstab: 150, doubleJump: true, swing: 0.36, hitAt: 0.4, range: 2.2, arc: 70, glass: true, inspect: { axis: 'y', turns: 2, height: 0.45, style: 'admire', dur: 2.4 } }),
  axe: melee({ id: 'axe', name: 'Axe', desc: 'Chunky chop.', dmg: 60, swing: 0.85, hitAt: 0.5, range: 2.5, arc: 80, inspect: { axis: 'x', turns: 2, height: 0.6 } }),

  // ---------------- utilities: throwables only (LMB throw; Q quick-throw from any slot)
  frag: util({ id: 'frag', name: 'Frag Grenade', desc: 'Hold to cook (2.5 s fuse). Up to 100 damage.', charges: 1, recharge: 14, fuse: 2.5, throwSpeed: 18, radius: 5, dmg: 100 }),
  flash: util({ id: 'flash', name: 'Flash Bomb', desc: 'Blinds anyone looking at it.', charges: 2, recharge: 12, fuse: 1.1, throwSpeed: 20, radius: 18 }),
  molotov: util({ id: 'molotov', name: 'Molotov', desc: 'Bursts into a fire pool on impact: 25 damage per second for 6 s.', charges: 1, recharge: 16, fuse: 9, impact: true, throwSpeed: 17, radius: 2.8, life: 6, dps: 25 }),
  smoke: util({ id: 'smoke', name: 'Smoke Bomb', desc: 'Thick cloud that blocks sight for 8 s.', charges: 1, recharge: 16, fuse: 1.0, throwSpeed: 16, radius: 4, life: 8 }),
};

// Every weapon has an ability on E with its own cooldown (tracked per slot).
const ABILITIES = {
  striker: { key: 'overclock', name: 'Overclock', desc: '+35% fire rate for 4 s.', cd: 14, dur: 4 },
  triburst: { key: 'mark', name: 'Tracker Round', desc: 'Your next burst marks the target through walls for 5 s.', cd: 12 },
  wasp: { key: 'steady', name: 'Steady Hands', desc: 'No spread penalty from moving or jumping for 4 s.', cd: 12, dur: 4 },
  breacher: { key: 'slug', name: 'Slug Round', desc: 'Next shot fires one pinpoint 90-damage slug.', cd: 10 },
  twinfang: { key: 'blastjump', name: 'Blast Jump', desc: 'Fire both barrels at your feet to launch yourself.', cd: 8 },
  longshot: { key: 'ping', name: 'Recon Ping', desc: 'Reveals every enemy through walls for 3 s.', cd: 18, dur: 3 },
  quill: { key: 'grapple', name: 'Grapple Bolt', desc: 'Fires a bolt that pulls you to where it lands.', cd: 10 },
  buzzsaw: { key: 'shield', name: 'Bullet Shield', desc: 'Drops a 3 m wall in front of you for 5 s.', cd: 18, dur: 5 },
  sidekick: { key: 'hotmag', name: 'Hot Mag', desc: 'Instant reload and +20% damage for 3 s.', cd: 10, dur: 3 },
  judge: { key: 'fan', name: 'Fan the Hammer', desc: 'Empties the cylinder in under half a second.', cd: 10 },
  hornet: { key: 'drum', name: 'Drum Mag', desc: 'Uses no ammo for 3 s.', cd: 14, dur: 3 },
  boomer: { key: 'rocketjump', name: 'Cannon Jump', desc: 'A blast at your feet launches you high.', cd: 10 },
  signal: { key: 'flarefan', name: 'Flare Spread', desc: 'Fires three flares in a fan.', cd: 12 },
  fists: { key: 'uppercut', name: 'Uppercut', desc: 'Launches the target into the air for 40 damage.', cd: 6 },
  knife: { key: 'lunge', name: 'Lunge', desc: 'Lunge 5 m into a 50-damage stab.', cd: 4, dist: 5, dmg: 50 },
  katana: { key: 'deflect', name: 'Deflect', desc: 'Block all incoming damage for 0.8 s.', cd: 8, dur: 0.8 },
  doubleedge: { key: 'whirl', name: 'Whirlwind', desc: '360° spin: 40 damage to everyone around you.', cd: 8, dmg: 40, range: 3.2 },
  scythe: { key: 'reaper', name: 'Reaper Dash', desc: 'Dash 7 m, hitting everything you pass for 40.', cd: 6, dist: 7, dmg: 40 },
  hammer: { key: 'slam', name: 'Ground Slam', desc: 'Shockwave: 50 damage and knockback within 3.5 m.', cd: 10, dmg: 50, range: 3.5 },
  glasscannon: { key: 'steady', name: 'Focus', desc: 'Perfect accuracy while moving and jumping for 3 s.', cd: 14, dur: 3 },
  karambit: { key: 'whirl', name: 'Hook Spin', desc: 'Spin and rake everyone within 2.6 m for 30.', cd: 6, dmg: 30, range: 2.6 },
  rapier: { key: 'lunge', name: 'Flèche', desc: 'Lunge 6 m into a 60-damage thrust.', cd: 5, dist: 6, dmg: 60 },
  bat: { key: 'homerun', name: 'Home Run', desc: 'A full swing for 45 that sends the target flying.', cd: 8, dmg: 45 },
  shard: { key: 'doublejump', name: 'Double Jump', desc: 'Passive: press jump again in mid-air for a second jump.', cd: 0, passive: true },
  axe: { key: 'axethrow', name: 'Axe Throw', desc: 'Throw the axe for 80 damage. It comes back.', cd: 8, dmg: 80 },
};
for (const id in ABILITIES) WEAPONS[id].ability = ABILITIES[id];

// Weight: [move speed multiplier, jump multiplier]. Heavier = slower and lower jumps; melee is full speed.
const WEIGHT = {
  striker: [0.93, 0.97], triburst: [0.93, 0.97], wasp: [0.97, 1], breacher: [0.91, 0.96], twinfang: [0.92, 0.97],
  longshot: [0.86, 0.94], quill: [0.92, 0.97], buzzsaw: [0.7, 0.86], glasscannon: [0.95, 0.98],
  sidekick: [0.99, 1], judge: [0.98, 1], hornet: [0.99, 1], boomer: [0.95, 0.98], signal: [0.98, 1],
  hammer: [0.92, 0.97], scythe: [0.97, 1],
};
for (const w of Object.values(WEAPONS)) { const k = WEIGHT[w.id] || [1, 1]; w.moveMul = k[0]; w.jumpMul = k[1]; }

function melee(o) {
  return { slot: 'melee', kind: 'melee', head: 1, equip: 0.3, adsZoom: 1, adsTime: 0.2, adsSens: 1, spread: 0, mag: 0, reserve: 0,
    vm: { hip: [0.2, -0.26, -0.38], adsZ: -0.3, sightY: 0 }, inspect: { axis: 'x', turns: 1, height: 0.45 }, ...o };
}
function util(o) {
  return { slot: 'utility', kind: 'util', head: 1, equip: 0.25, adsZoom: 1, adsTime: 0.2, adsSens: 1, mag: 0, reserve: 0,
    vm: { hip: [0.14, -0.14, -0.3], adsZ: -0.3, sightY: 0 }, inspect: { axis: 'y', turns: 2, height: 0.45 }, ...o };
}

export const SLOTS = ['primary', 'secondary', 'melee', 'utility'];
export const byslot = (s) => Object.values(WEAPONS).filter((w) => w.slot === s);
export const DEFAULT_LOADOUT = ['striker', 'sidekick', 'fists', 'frag'];
