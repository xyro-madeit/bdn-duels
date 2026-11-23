import * as THREE from 'three';
import './ui/ui.css';
import { startLoop } from './core/loop.js';
import { Input, IDLE_CMD, BINDS, BIND_LABELS, setBind, resetBinds, keyName, PAD_BINDS, setPadBind, PADCFG, savePadCfg, PAD_NAMES } from './core/input.js';
import { PadNav } from './ui/padnav.js';
import { World, rayAABB } from './physics/world.js';
import { WeaponSystem } from './weapons/weapons.js';
import { DEFAULT_LOADOUT, WEAPONS, SLOTS, byslot } from './weapons/defs.js';
import { Projectiles } from './game/projectiles.js';
import { Viewmodel } from './fps/viewmodel.js';
import { Impacts } from './fx/impacts.js';
import { Dummy } from './game/targets.js';
import { Bot } from './bots/bot.js';
import { NavGraph } from './bots/nav.js';
import { Match, MODES } from './modes/match.js';
import { Killcam } from './game/killcam.js';
import { buildSoldier, poseSoldier, setSoldierLook, setSoldierGun, TEAM_COLORS } from './game/soldier.js';
import { initFinishers, updateFinishers, playFinisher, FINISHERS } from './fx/finishers.js';
import { Hud } from './ui/hud.js';
import { sfx } from './audio/sfx.js';
import { Mover, MOVE } from './physics/move.js';
import { buildMap } from './world/build.js';
import { CRATE_YARD } from './world/maps/crateyard.js';
import { MAPS } from './world/maps/index.js';
import { FPSCamera } from './fps/camera.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { renderThumbs } from './ui/thumbs.js';
import { Turntable } from './ui/turntable.js';
import { finImg } from './ui/finIcons.js';
import { tickCosmetics } from './progression/cosmetics.js';
import { prepareGlass, releaseGlass } from './fx/glass.js';
import { preloadModels } from './weapons/glb.js';
import { Progress, XP_RULES, xpToNext, MAX_LEVEL, UNLOCKS, BONUS } from './progression/xp.js';
import { WRAPS, SKINS, COLORS, HATS, rewardInfo } from './progression/cosmetics.js';
import { findMatch, newCode } from './net/lobby.js';
import { RemotePlayer, SNAP_HZ } from './net/remote.js';
import { backend } from './net/net.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer / scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Adaptive resolution keeps the frame rate steady: start at up to 1.5x pixel density, drop a step
// whenever frames start missing the display refresh, and climb back only after a long stable stretch
// (never above a level that already dropped frames, so it can't oscillate).
const PR = { max: Math.min(devicePixelRatio, 1.5), min: 0.6, cur: Math.min(devicePixelRatio, 1.5), ceil: Math.min(devicePixelRatio, 1.5), slow: 0, n: 0, t: 0, stable: 0 };
renderer.setPixelRatio(PR.cur);
// Detect a browser frame cap: frames arrive every ~33 ms while the game itself needs only a few ms
// (Chrome Energy Saver / Safari Low Power Mode cap pages at 30 fps). Tell the player how to lift it.
const CAP = { n: 0, slowInt: 0, work: 0, t: 0, shown: false };
function capCheck(dt, workMs) {
  CAP.n++; CAP.t += dt; CAP.work += workMs; CAP.last = CAP.last === undefined ? workMs : CAP.last * 0.95 + workMs * 0.05; if (dt > 0.028 && dt < 0.04) CAP.slowInt++;
  if (CAP.t < 3) return;
  const capped = CAP.slowInt / CAP.n > 0.8 && CAP.work / CAP.n < 12;
  if (capped && !CAP.shown) {
    CAP.shown = true;
    const el = document.createElement('div'); el.id = 'capNote';
    el.innerHTML = `<b>Your browser is limiting the game to 30 fps</b><span>The game only needs ${(CAP.work / CAP.n).toFixed(1)} ms per frame. This cap comes from <b>Energy Saver</b> (Chrome: Settings → Performance, or plug in your charger) or <b>Low Power Mode</b> (Mac: System Settings → Battery).</span><button>OK</button>`;
    el.querySelector('button').onclick = () => el.remove();
    document.body.appendChild(el); setTimeout(() => el.remove(), 15000);
  }
  CAP.n = CAP.slowInt = CAP.work = CAP.t = 0;
}
function adaptResolution(dt) {
  PR.n++; PR.t += dt; if (dt > 1 / 50) PR.slow++;
  if (PR.t < 1) return;
  const bad = PR.slow / PR.n > 0.06;
  if (bad && PR.cur > PR.min) { PR.ceil = PR.cur - 0.05; PR.cur = Math.max(PR.min, +(PR.cur - 0.15).toFixed(2)); renderer.setPixelRatio(PR.cur); PR.stable = 0; }
  else if (!bad && ++PR.stable >= 10 && PR.cur + 0.1 <= PR.ceil) { PR.cur = +(PR.cur + 0.1).toFixed(2); renderer.setPixelRatio(PR.cur); PR.stable = 0; }
  else if (!bad && PR.stable >= 30) { PR.ceil = Math.min(PR.max, PR.ceil + 0.1); PR.stable = 10; } // a one-off hitch doesn't cap quality forever
  PR.slow = 0; PR.n = 0; PR.t = 0;
}
renderer.setSize(innerWidth, innerHeight);
// Filmic tone mapping + an environment map for real reflections on metal (grounded look).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCF soft is ~2x the cost for little visible gain here
renderer.autoClear = false; // world pass, then depth clear, then viewmodel pass

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog(0xc9d6e0, 55, 170);
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
scene.environmentIntensity = 0.6;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x8a8070, 1.15));
const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
sun.position.set(18, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- world / player
const world = new World();
let map = CRATE_YARD;
let mapGroup = buildMap(scene, world, map);
// Swap the arena: rebuild geometry + colliders, nav graph, sky and fog for the map's mood.
function loadMap(id) {
  const m = MAPS[id] || CRATE_YARD;
  if (m === map && mapGroup) return;
  scene.remove(mapGroup);
  mapGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  map = m;
  mapGroup = buildMap(scene, world, map);
  nav = new NavGraph(world, { hints: map.navHints });
  botCtx.nav = nav;
  const env = map.env || {};
  scene.background = skyTexture(env.sky);
  scene.fog.color.setHex(env.fog ?? 0xc9d6e0); scene.fog.near = env.fogNear ?? 55; scene.fog.far = env.fogFar ?? 170;
  sun.intensity = env.sun ?? 3.2;
}

const input = new Input(canvas);
const me = new Mover(world);
const fcam = new FPSCamera(camera);
let nav = new NavGraph(world);
function respawn() {
  const s = map.spawns[0];
  me.spawn(s.x, 0.01, s.z);
  input.yaw = s.yaw; input.pitch = 0;
}
respawn();

// The player as an "actor": same interface as bots/dummies so all damage code is shared.
const player = {
  isPlayer: true, name: 'You', team: 0, mover: me, get def() { return ws.def; }, maxHp: 150, hp: 150, alive: true, kills: 0, deaths: 0, dmgDealt: 0,
  get pos() { return me.pos; }, get yaw() { return input.yaw; }, get pitch() { return input.pitch; },
  eye() { return new THREE.Vector3(me.pos.x, me.pos.y + fcam.eye, me.pos.z); },
  chest() { return new THREE.Vector3(me.pos.x, me.pos.y + me.h * 0.6, me.pos.z); },
  hitboxes() {
    const p = me.pos, h = me.h;
    return [
      { part: 'head', min: [p.x - 0.19, p.y + h - 0.36, p.z - 0.19], max: [p.x + 0.19, p.y + h + 0.04, p.z + 0.19] },
      { part: 'body', min: [p.x - 0.36, p.y, p.z - 0.24], max: [p.x + 0.36, p.y + h - 0.36, p.z + 0.24] },
    ];
  },
  damage(n) {
    if (!this.alive || godMode) return false;
    if (ws.buffs.deflect > 0) { sfx.deflect(); hud.toast('DEFLECTED'); return false; }
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.deaths++; return true; }
    return false;
  },
  knock(v) { me.vel.add(v); }, launch(vy) { me.launch(vy); },
  burn(dps, time, by = null) { this.burnDps = dps; this.burnT = time; this.burnTick = 0; this.burnBy = by; }, mark() {},
};
let godMode = false;
const playerSoldier = buildSoldier(TEAM_COLORS[0]); // your body, seen only in the killcam
playerSoldier.group.visible = false;
scene.add(playerSoldier.group);


// ---------- settings (saved in this browser)
const SETTINGS_KEY = 'bdn_duels_settings';
const settings = { sens: 0.8, fov: 90, bob: 0.6, diff: 'normal', finisher: 'shatter', mode: 'duel', map: 'random', wrap: 'none', skin: 'none', color: 'graphite', hat: 'none', crosshair: 'cross', shadows: true, perf: false, padSens: 1, invertY: false, aimAssist: 'strong', name: 'Player' + Math.floor(1000 + Math.random() * 9000) };
const progress = new Progress();
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
if (settings.aimAssist === true || settings.aimAssist === false || settings.aimAssist === undefined) settings.aimAssist = 'strong';
if (!settings.v2) { if (settings.color === 'teal') settings.color = 'graphite'; settings.v2 = 1; } // neutral arms by default
function applySettings() {
  input.sens = settings.sens; input.padSens = settings.padSens; input.invertY = !!settings.invertY;
  // graphics: shadows on/off, performance mode caps resolution for weaker machines
  if (renderer.shadowMap.enabled !== !!settings.shadows) { renderer.shadowMap.enabled = !!settings.shadows; scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); }); }
  PR.max = settings.perf ? 0.75 : Math.min(devicePixelRatio, 1.5); PR.ceil = Math.min(PR.ceil, PR.max); if (PR.cur > PR.max) { PR.cur = PR.max; renderer.setPixelRatio(PR.cur); }
  fcam.baseHFov = settings.fov;
  fcam.bobScale = settings.bob;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
for (const [id, key, fmt] of [['Sens', 'sens', (v) => v.toFixed(2)], ['Fov', 'fov', (v) => v + '°'], ['Bob', 'bob', (v) => Math.round(v * 100) + '%'], ['PadSens', 'padSens', (v) => v.toFixed(2)]]) {
  const el = $('s' + id), out = $('v' + id);
  const paint = () => { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%'); out.textContent = fmt(+el.value); };
  el.value = settings[key]; paint();
  el.oninput = () => { settings[key] = +el.value; paint(); applySettings(); };
}
applySettings();
$('sInvert').checked = !!settings.invertY; $('sInvert').onchange = () => { settings.invertY = $('sInvert').checked; applySettings(); };
function renderAssist() {
  $('sAssist').innerHTML = [['off', 'Off'], ['slight', 'Slight'], ['strong', 'Strong']].map(([k, n]) => `<button class="${settings.aimAssist === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('');
  $('sAssist').querySelectorAll('button').forEach((b) => b.onclick = () => { settings.aimAssist = b.dataset.k; applySettings(); renderAssist(); sfx.ui(); });
}
renderAssist();
$('sShadows').checked = !!settings.shadows; $('sShadows').onchange = () => { settings.shadows = $('sShadows').checked; applySettings(); };
$('sPerf').checked = !!settings.perf; $('sPerf').onchange = () => { settings.perf = $('sPerf').checked; applySettings(); };
// crosshair style picker (Settings)
const XH_STYLES = { cross: 'Dynamic', static: 'Static', dot: 'Dot', crossdot: 'Cross + dot', circle: 'Circle', tee: 'T' };
function renderXh() {
  $('sXh').innerHTML = Object.entries(XH_STYLES).map(([k, n]) => `<button class="${settings.crosshair === k ? 'on' : ''}" data-x="${k}">${n}</button>`).join('');
  $('sXh').querySelectorAll('button').forEach((b) => b.onclick = () => { settings.crosshair = b.dataset.x; applySettings(); renderXh(); });
  const st = settings.crosshair === 'static' ? 'cross' : settings.crosshair;
  $('xh').dataset.style = st; document.querySelector('.xhp').dataset.style = st; hudXh(settings.crosshair);
}
let hudXh = () => {};

// ---------- start overlay
const start = $('start');
// Play starts a fresh match of the chosen mode; Resume returns to the one in progress.
$('play').onclick = () => { if (settings.mode === 'online') { openOnline(); return; } startMatch(settings.mode); input.lock(); };
$('resume').onclick = () => input.lock();
input.onLockChange = (locked) => {
  start.classList.toggle('hidden', locked);
  if (locked) { turntable.stop(); gridTT.stop(); detailTT.stop(); }
  else if ($('tab-locker').classList.contains('on')) turntable.start();
  else if ($('tab-loadout').classList.contains('on')) { gridTT.start(); detailTT.start(); }
  if (!locked) $('resume').classList.toggle('hidden', !(match && match.state !== 'over'));
};

// ---------- debug HUD
let peak = 0, peakT = 0, fpsN = 0, fpsT = 0;
const hist = new Float32Array(220);
let histI = 0;
const gctx = $('graph').getContext('2d');
function drawGraph() {
  const g = gctx; g.clearRect(0, 0, 220, 48);
  g.strokeStyle = 'rgba(22,19,31,.15)'; g.beginPath();
  for (const v of [MOVE.run, MOVE.slideBoost]) { const y = 46 - (v / MOVE.maxSpeed) * 44; g.moveTo(0, y); g.lineTo(220, y); }
  g.stroke();
  g.strokeStyle = '#16131f'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i < 220; i++) { const v = hist[(histI + i) % 220]; const y = 46 - (v / MOVE.maxSpeed) * 44; i ? g.lineTo(i, y) : g.moveTo(i, y); }
  g.stroke();
}

// ---------- weapons, targets, fx, hud
const vm = new Viewmodel();
const impacts = new Impacts(scene);
const hud = new Hud($('hud'));
hudXh = (st) => { hud.xhStyle = st; };
renderXh();
const dummies = [
  new Dummy(scene, -9, 0, -1),
  new Dummy(scene, -5, 0, 6),
  new Dummy(scene, 0, 0, -6.5, { move: { axis: 'x', range: 5, speed: 1.1 } }),
  new Dummy(scene, 0, 3, 0),
  new Dummy(scene, 11, 0, 3),
];
const _o = new THREE.Vector3(), _m = new THREE.Vector3(), _end = new THREE.Vector3();
function eyePos(out) { return out.set(me.pos.x, me.pos.y + fcam.eye, me.pos.z); }
function falloff(def, t) { const [a, b, k] = def.falloff; return t <= a ? 1 : t >= b ? k : 1 + (k - 1) * ((t - a) / (b - a)); }

// ---------- match state
let match = null;          // current Match (null before the first Play)
let net = null;            // online session: { ch, host, opp, remote, started } (see "online 1v1")
const nsend = (k, d) => { if (net && net.ch) net.ch.send(k, d); };
let matchXP = { kills: 0, heads: 0, rounds: 0 };
let bots = [];
const killcam = new Killcam();
let spectate = null;       // ally actor we're watching after death
let matchTime = 0;
const isRange = () => !match || match.mode.range;
// Everything `attacker` can damage: enemy actors (+ dummies in the range)
function targetsFor(attacker = player) {
  const out = [];
  if (isRange()) { if (attacker === player) for (const d of dummies) if (d.alive) out.push(d); }
  else for (const a of match.actors) if (a !== attacker && a.alive && (match.mode.ffa || a.team !== attacker.team)) out.push(a);
  return out;
}

// Nearest hit along a ray: map geometry or a target hitbox (dummy, bot or player).
// (hit.kind is 'dummy' for any damageable target; hit.dummy is that target.)
function hitscan(o, d, range, attacker = player) {
  const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z];
  const w = world.raycast(oa, da, range);
  let best = w ? { t: w.t, kind: 'world', normal: w.normal } : null;
  for (const dm of targetsFor(attacker)) {
    if (!dm.alive) continue;
    for (const hb of dm.hitboxes()) {
      const t = rayAABB(oa, da, hb.min, hb.max, best ? best.t : range);
      if (t !== null && (!best || t < best.t)) best = { t, kind: 'dummy', dummy: dm, part: hb.part };
    }
  }
  return best;
}

function lookDir() { const cp = Math.cos(input.pitch); return new THREE.Vector3(-Math.sin(input.yaw) * cp, Math.sin(input.pitch), -Math.cos(input.yaw) * cp); }
function flatForward() { return new THREE.Vector3(-Math.sin(input.yaw), 0, -Math.cos(input.yaw)); }
let lastCmd = { ...IDLE_CMD };
function moveDirOrForward() {
  const s = Math.sin(input.yaw), c = Math.cos(input.yaw);
  const v = new THREE.Vector3(-s * lastCmd.fwd + c * lastCmd.side, 0, -c * lastCmd.fwd - s * lastCmd.side);
  return v.lengthSq() > 0 ? v.normalize() : flatForward();
}
const chest = (dm) => new THREE.Vector3(dm.pos.x, dm.pos.y + 1.1, dm.pos.z);
function clearLine(a, b) { const d = b.clone().sub(a); const len = d.length(); const w = world.raycast([a.x, a.y, a.z], [d.x / len, d.y / len, d.z / len], len); return !w; }

// All damage goes through here. attacker/weapon drive the killfeed, stats and finishers.
function dealDamage(dm, dmg, head, point, quiet, attacker = player, weapon = ws.def) {
  if (!dm.alive) return false;
  if (dm.isRemote && attacker === player) nsend('hit', { dmg, head, w: weapon && weapon.id });
  const killed = dm.damage(dmg);
  if (dm.alert) dm.alert(attacker);
  if (dm === player && !killed && player.alive && dmg > 0 && attacker && attacker !== player) {
    hud.hurt(attacker.pos, me.pos, input.yaw); sfx.hurt(); fcam.shake(0.006, 0.1); input.rumble(0.7, 0.3, 140);
  }
  if (attacker === player && dm !== player) {
    player.dmgDealt += dmg;
    hud.number(point, dmg, head); hud.hit(head, killed);
    if (killed) { sfx.kill(); fcam.shake(0.008, 0.12); input.rumble(0.4, 0.8, 160); stats.kills++; if (dm.isBot && match && !match.mode.range && match.state === 'live') { matchXP.kills++; if (head) matchXP.heads++; } }
    else if (!quiet) head ? sfx.head() : sfx.hit();
  } else if (attacker && attacker.isBot) attacker.dmgDealt += dmg;
  if (killed) onKilled(dm, attacker, weapon, head);
  return killed;
}

function onKilled(victim, killer, weapon, head) {
  if (victim.isDummy) { victim.finished = true; if (killer === player) playFinisher(settings.finisher, victim.pos.clone(), victim.model.rotation.y, 0xd8433a, victim.model); return; }
  // online: tell the opponent first, so they count the kill before the host's round-over arrives
  if (victim === player) nsend('dead', { by: killer && killer.isRemote ? 1 : 0, w: weapon && weapon.id, head: !!head });
  hud.feed(killer, victim, weapon, head);
  const roundOver = match && !match.mode.range && (() => { match.onKill(victim, killer); return match.state === 'roundEnd'; })();
  // finisher on the last kill of a round (or every kill in FFA)
  if (roundOver || (match && match.mode.ffa)) {
    const kind = killer === player ? settings.finisher : killer && killer.finisher;
    if (victim.isBot || victim.isRemote) playFinisher(kind || 'shatter', victim.pos.clone(), victim.yaw, 0xd8433a, victim.model);
  }
  if (victim === player) {
    vm.hidden = true;
    if (killer && (killer.isBot || killer.isRemote)) setTimeout(() => { if (!player.alive && killcam.start(killer, player, matchTime)) hud.killcam(killer, weapon); }, 500);
  }
}

// Area damage with line-of-sight and linear falloff (frag, cannon splash). Hurts the owner too (half).
function splash(point, r, maxDmg, skip, attacker = player, weapon) {
  const list = targetsFor(attacker);
  if (attacker && attacker.alive && !list.includes(attacker)) list.push(attacker);
  for (const dm of list) {
    if (!dm.alive || dm === skip) continue;
    const c = chest(dm), d = c.distanceTo(point);
    const self = dm === attacker ? 0.5 : 1;
    if (d < r && clearLine(point.clone().add(new THREE.Vector3(0, 0.2, 0)), c)) dealDamage(dm, (maxDmg * (1 - d / r) * 0.85 + maxDmg * 0.15) * self, false, c, true, attacker, weapon || WEAPONS.frag);
  }
  const pd = point.distanceTo(me.pos);
  if (pd < r * 2.5) fcam.shake(0.02 * (1 - pd / (r * 2.5)), 0.3);
}

function flashPlayer(point, r) {
  if (player.alive) {
    eyePos(_o);
    const d = point.distanceTo(_o);
    if (d <= r && clearLine(_o, point)) {
      const facing = (lookDir().dot(point.clone().sub(_o).normalize()) + 1) / 2; // 1 = staring at it
      const k = Math.pow(facing, 2.2) * Math.sqrt(1 - d / r);
      if (k > 0.05) hud.flash(k, 0.4 + 2.6 * k);
    }
  }
  // bots get blinded the same way (based on where they're looking)
  for (const b of bots) {
    if (!b.alive) continue;
    const e = b.eye(), d = point.distanceTo(e);
    if (d > r || !clearLine(e, point)) continue;
    const f = new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw));
    const facing = (f.dot(point.clone().sub(e).setY(0).normalize()) + 1) / 2;
    const k = Math.pow(facing, 2) * Math.sqrt(1 - d / r);
    if (k > 0.15) b.blind(0.4 + 2.6 * k);
  }
}

// Melee: everything in the swing arc (wide weapons cleave, narrow ones hit the nearest).
// opts: { reach, all: hit in 360°, range, knock, launch }
function meleeHit(def, dmg, opts = {}) {
  eyePos(_o);
  const f = lookDir();
  const half = (def.arc / 2) * Math.PI / 180;
  const range = (opts.range || def.range) + (opts.reach || 0);
  const hits = [];
  for (const dm of targetsFor(player)) {
    if (!dm.alive) continue;
    const c = chest(dm), v = c.clone().sub(_o);
    const dist = Math.max(0, v.length() - 0.45);
    if (dist > range) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, f.dot(v.clone().normalize()))));
    if (!opts.all && ang > half && dist > 0.6) continue;
    if (!clearLine(_o, c)) continue;
    hits.push({ dm, dist, c });
  }
  hits.sort((a, b) => a.dist - b.dist);
  const cleave = opts.all || def.arc >= 100;
  for (const h of cleave ? hits : hits.slice(0, 1)) {
    let dd = dmg;
    if (def.backstab && dmg === def.dmg) { // behind the target (they're facing away from you) = backstab
      const yaw = h.dm.yaw ?? (h.dm.model ? h.dm.model.rotation.y : 0);
      const tf = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), toMe = me.pos.clone().sub(h.dm.pos).setY(0).normalize();
      if (tf.dot(toMe) < -0.25) { dd = def.backstab; hud.toast('BACKSTAB'); }
    }
    dealDamage(h.dm, dd, false, h.c, true);
    sfx.meleeHit(def);
    impacts.puff(h.c, [-f.x, -f.y, -f.z], 0xb03a2e, 6);
    const kb = opts.knock || def.knock;
    if (kb) h.dm.knock(h.c.clone().sub(me.pos).setY(0).normalize().multiplyScalar(kb));
    if (opts.launch) h.dm.launch(opts.launch);
  }
  if (hits.length) fcam.shake(def.knock || opts.knock ? 0.02 : 0.009, 0.12);
  return hits.length;
}

let dashHits = null; // reaper dash damage window
let stepT = 0;
let pendingSlam = null; // hammer slam fired in the air lands later

// Buzzsaw Bullet Shield: temporary wall (blocks bullets + movement) in front of the player
const shields = [];
function placeShield(dur) {
  const f = flatForward(), c = me.pos.clone().addScaledVector(f, 1.6);
  const r = new THREE.Vector3(-f.z, 0, f.x); // perpendicular
  const half = 1.5, t = 0.15, h = 2.2;
  const ax = Math.abs(f.x) > Math.abs(f.z); // snap to the nearest axis so it is an AABB
  const min = ax ? [c.x - t, c.y, c.z - half] : [c.x - half, c.y, c.z - t];
  const max = ax ? [c.x + t, c.y + h, c.z + half] : [c.x + half, c.y + h, c.z + t];
  addShield(min, max, dur);
  nsend('shield', { min, max, dur });
  void r;
}
function addShield(min, max, dur) {
  const h = max[1] - min[1];
  const box = world.add(min, max, { temp: true });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], h, max[2] - min[2]),
    new THREE.MeshStandardMaterial({ color: 0x7fd8ff, emissive: 0x2a7fb0, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, roughness: 0.2, metalness: 0.3, depthWrite: false }));
  mesh.position.set((min[0] + max[0]) / 2, min[1] + h / 2, (min[2] + max[2]) / 2);
  scene.add(mesh);
  shields.push({ box, mesh, t: dur });
}
// projectiles the opponent should see (as harmless ghosts)
const v3 = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
function shootP(def, o, d, extra = {}) {
  proj.shoot(def, o, d, extra);
  nsend('proj', { w: def.id, o: v3(o), d: v3(d), x: { proj: extra.proj, spin: extra.spin, axe: extra.axe ? 1 : 0 } });
}
function throwP(def, o, v, fuse) {
  proj.throw(def, o, v, fuse);
  nsend('nade', { w: def.id, o: v3(o), v: v3(v), f: fuse });
}
function fxNet(pos, color, size) { proj.explosion(pos, color, size); nsend('fx', { p: v3(pos), c: color, s: size }); }
// ---- weapon abilities (E). Buffs/one-shot modifiers live in WeaponSystem; world effects here.
function useAbility(def, a) {
  hud.toast(a.name.toUpperCase());
  sfx.ability();
  const up = new THREE.Vector3(0, 1, 0);
  switch (a.key) {
    case 'overclock': case 'steady': case 'drum': case 'hotmag': case 'deflect': case 'mark': case 'slug': sfx.equip(); break;
    case 'blastjump': { // both barrels at your feet: up and away from where you look
      const back = lookDir().multiplyScalar(-1);
      me.launch(10); me.vel.x += back.x * 7; me.vel.z += back.z * 7;
      sfx.fire(def); fcam.shake(0.02, 0.25); fxNet(me.pos.clone(), 0xffd7a0, 0.9); break;
    }
    case 'rocketjump': {
      const d = moveDirOrForward();
      me.launch(15); me.vel.x += d.x * 4; me.vel.z += d.z * 4;
      sfx.boom(0.7); fcam.shake(0.02, 0.3); fxNet(me.pos.clone(), 0xff8a3d, 1.6); splash(me.pos.clone(), 2.5, 40); vm.shot(); break;
    }
    case 'ping': for (const dm of targetsFor(player)) if (dm.alive) dm.mark(a.dur); sfx.pad(); break;
    case 'grapple': eyePos(_o); shootP(def, _o.clone().addScaledVector(lookDir(), 0.5), lookDir(), { proj: { speed: 140, gravity: 0, model: 'bolt' }, grapple: true }); vm.shot(); sfx.fire(def); break;
    case 'shield': placeShield(a.dur); sfx.pad(); break;
    case 'fan': break;
    case 'flarefan': eyePos(_o); for (const off of [-0.14, 0, 0.14]) { const d = lookDir().applyAxisAngle(up, off); shootP(def, _o.clone().addScaledVector(d, 0.5), d); } vm.shot(); sfx.fire(def); break;
    // straight where the crosshair points (up/down too)
    case 'reaper': me.dash(lookDir(), a.dist, 0.25, 9); dashHits = { set: new Set(), dmg: a.dmg, t: 0.32 }; sfx.dash(); fcam.shake(0.006, 0.2); break;
    case 'lunge': me.dash(flatForward(), a.dist, 0.2, 7); sfx.dash(); break;
    case 'slam': if (!me.onGround) { me.vel.y = -28; pendingSlam = a; } break;
    case 'axethrow': eyePos(_o); shootP(def, _o.clone().addScaledVector(lookDir(), 0.6), lookDir(), { proj: { speed: def.id === 'shard' ? 48 : 38, gravity: def.id === 'shard' ? 3 : 6, model: def.id }, axe: a.dmg, spin: 20 }); ws.axeAway = 1.4; sfx.swing(def); break;
  }
}
// melee abilities land mid-animation
function abilityHit(def, a) {
  if (a.key === 'whirl') { meleeHit(def, a.dmg, { all: true, range: a.range }); sfx.swing(def); }
  if (a.key === 'uppercut') meleeHit(def, 40, { launch: 9 });
  if (a.key === 'lunge') meleeHit(def, a.dmg, { reach: 0.8 });
  if (a.key === 'homerun') { meleeHit(def, a.dmg, { knock: 17, launch: 6, reach: 0.3 }); fcam.shake(0.012, 0.15); }
  if (a.key === 'slam' && !pendingSlam) doSlam(a);
}
function doSlam(a) {
  const feet = me.pos.clone();
  fxNet(feet.clone().setY(feet.y + 0.1), 0xd9d2c0, a.range * 0.6);
  sfx.slam(); fcam.shake(0.03, 0.35);
  for (const dm of targetsFor(player)) {
    if (!dm.alive) continue;
    const c = chest(dm);
    if (c.distanceTo(feet.clone().setY(feet.y + 1)) < a.range) { dealDamage(dm, a.dmg, false, c, true); dm.knock(c.clone().sub(feet).setY(0).normalize().multiplyScalar(10)); dm.launch(5); }
  }
}

// Molotov pools burn everyone standing in them (twice a second) — including the thrower.
function burnFires(dt) {
  for (const f of proj.fires || []) {
    f.tick += dt; if (f.tick < 0.5) continue; f.tick -= 0.5;
    if (f.ghost) { if (player.alive && proj.fireAt(me.pos) === f) {} continue; } // opponent's fire: their client sends the damage
    const victims = isRange() ? dummies.filter((d) => d.alive) : (match ? match.actors.filter((a) => a.alive) : [player]);
    for (const v of victims) if (Math.hypot(v.pos.x - f.pos.x, v.pos.z - f.pos.z) < f.r && Math.abs(v.pos.y - f.pos.y) < 1.6) {
      dealDamage(v, f.def.dps * 0.5 * (v === f.owner ? 0.5 : 1), false, chest(v), true, f.owner || player, f.def); sfx.burn();
    }
  }
}
function updateShields(dt) {
  for (let i = shields.length - 1; i >= 0; i--) {
    const s = shields[i]; s.t -= dt;
    s.mesh.material.opacity = 0.35 * Math.min(1, s.t / 0.4);
    if (s.t <= 0) { scene.remove(s.mesh); world.boxes.splice(world.boxes.indexOf(s.box), 1); shields.splice(i, 1); }
  }
}

const proj = new Projectiles(scene, world, {
  hitscan: (o, d, r, p) => hitscan(o, d, r, p && p.ghost && net ? net.remote : player),
  onHit(p, hit, point) {
    const def = p.def;
    if (p.ghost) { // the opponent's projectile: visuals only (their client sends the damage)
      if (hit.kind === 'world') impacts.puff(point, hit.normal, def.proj && def.proj.model === 'flare' ? 0xff8a2a : undefined);
      if (def.proj && def.proj.splash) { proj.explosion(point, 0xff8a3d, def.proj.splash.r * 0.5); sfx.boom(0.5); }
      return;
    }
    if (p.grapple) { // Quill grapple: pull the player to the impact point
      const to = point.clone().sub(me.pos).add(new THREE.Vector3(0, 0.6, 0));
      const dist = Math.max(0, to.length() - 1.0);
      if (dist > 0.5) { me.dash(to, dist, Math.max(0.15, dist / 32), 8); sfx.dash(); }
      return;
    }
    if (p.axe) { if (hit.kind === 'dummy') { dealDamage(hit.dummy, p.axe, false, point); sfx.meleeHit(def); } else sfx.bounce(); return; }
    if (hit.kind === 'world') { impacts.hole(point, hit.normal); impacts.puff(point, hit.normal, def.proj.model === 'flare' ? 0xff8a2a : undefined); }
    else {
      const head = hit.part === 'head';
      dealDamage(hit.dummy, def.dmg * (head ? def.head : 1), head, point);
      if (def.proj.burn) { hit.dummy.burn(def.proj.burn.dps, def.proj.burn.time); hit.dummy.mark(def.proj.burn.time); sfx.burn(); }
    }
    if (def.proj.splash) { splash(point, def.proj.splash.r, def.proj.splash.dmg, hit.kind === 'dummy' ? hit.dummy : null); sfx.boom(0.5); }
  },
  onExplode(kind, point, def, p) {
    if (kind === 'frag' && p && p.ghost) { sfx.boom(1); const pd = point.distanceTo(me.pos); if (pd < def.radius * 2.5) fcam.shake(0.02 * (1 - pd / (def.radius * 2.5)), 0.3); return; }
    if (kind === 'frag') { sfx.boom(1); splash(point, def.radius, def.dmg, null, (p && p.owner) || player, def); }
    if (kind === 'flash') { sfx.flashbang(); flashPlayer(point, def.radius); }
    if (kind === 'smoke') sfx.smoke();
    if (kind === 'molotov') { sfx.ignite && sfx.ignite(); if (p && !p.ghost) proj.fires[proj.fires.length - 1].owner = (p && p.owner) || player; else if (p && p.ghost) proj.fires[proj.fires.length - 1].ghost = true; }
    if (kind === 'pad') sfx.pad();
  },
  onBounce() { sfx.bounce(); },
});

const LOADOUT_KEY = 'bdn_duels_loadout';
function savedLoadout() {
  let l = DEFAULT_LOADOUT.slice();
  try { const s = JSON.parse(localStorage.getItem(LOADOUT_KEY) || 'null'); if (Array.isArray(s) && s.length === 4 && s.every((id, i) => WEAPONS[id] && WEAPONS[id].slot === SLOTS[i])) l = s; } catch (e) {}
  // anything not unlocked yet falls back to the starter item for that slot
  return l.map((id, i) => (progress.has('w:' + id) ? id : DEFAULT_LOADOUT[i]));
}
let loadout = savedLoadout();

const ws = new WeaponSystem(loadout, {
  onShot({ def, dirs, slug, mark, dmgMul = 1 }) {
    input.rumble(Math.min(1, def.kick * 6), Math.min(1, def.kick * 9), 55);
    eyePos(_o);
    dirs = magnetize(dirs, _o, def);
    vm.muzzleView(_m); camera.localToWorld(_m);
    vm.shot(); sfx.fire(def); fcam.shake(def.shake, 0.06); player.firedT = matchTime;
    nsend('shot', { w: def.id, o: v3(_o), d: dirs.slice(0, 3).map(v3) });
    if (def.id === 'longshot') setTimeout(sfx.bolt, 380);
    for (const b of bots) b.hear(me.pos, matchTime, settings.diff);
    const agg = new Map();
    dirs.forEach((dir, i) => {
      const hit = hitscan(_o, dir, def.range);
      const end = _o.clone().addScaledVector(dir, Math.min(hit ? hit.t : 120, 150));
      if (i < 4) impacts.tracer(_m, end);
      if (!hit) return;
      if (hit.kind === 'world') { if (i < 5) impacts.hole(end, hit.normal); impacts.puff(end, hit.normal, undefined, dirs.length > 1 ? 2 : 6); if (i === 0) sfx.impact(); return; }
      const head = hit.part === 'head';
      const a = agg.get(hit.dummy) || { dmg: 0, head: false, point: end };
      a.dmg += (slug ? 90 : def.dmg * falloff(def, hit.t)) * (head ? def.head : 1) * dmgMul;
      a.head = a.head || head;
      agg.set(hit.dummy, a);
      impacts.puff(end, [-dir.x, -dir.y, -dir.z], 0xb03a2e, dirs.length > 1 ? 2 : 5);
    });
    for (const [dm, a] of agg) { dealDamage(dm, a.dmg, a.head, a.point); if (mark) { dm.mark(5); hud.toast('TARGET MARKED'); } }
  },
  onFireFx(def) { vm.shot(); sfx.fire(def); },
  onAbilityDenied() { sfx.dry(); },
  onAbility({ def, a }) { useAbility(def, a); },
  onAbilityHit({ def, a }) { abilityHit(def, a); },
  onProjectile({ def, dir }) {
    eyePos(_o);
    dir = magnetize([dir], _o, def)[0];
    // launched from the eye line so it flies where the crosshair points
    shootP(def, _o.clone().addScaledVector(dir, 0.5), dir);
    vm.shot(); sfx.fire(def); fcam.shake(def.shake, 0.06);
  },
  onPump() { sfx.pump(); },
  onInspect() { sfx.inspect(); },
  onSwing(def) { sfx.swing(def); nsend('swing', { w: def.id }); },
  onMelee({ def, dmg, reach }) { meleeHit(def, dmg || def.dmg, { reach }); },
  onThrow({ def, fuseLeft }) {
    eyePos(_o);
    const dir = lookDir();
    const v = dir.clone().multiplyScalar(def.throwSpeed).add(new THREE.Vector3(0, 2.5, 0)).addScaledVector(me.vel, 0.4);
    throwP(def, _o.clone().addScaledVector(dir, 0.45).add(new THREE.Vector3(0, -0.12, 0)), v, fuseLeft);
    sfx.toss();
  },
  onPin() { sfx.pin(); },
  onEquip() { sfx.equip(); },
  onDry() { sfx.dry(); },
  onItemGone(def) { hud.toast(def.kind === 'util' ? `OUT OF ${def.name.toUpperCase()}` : `${def.name.toUpperCase()} EMPTY`); sfx.dry(); },
  onReloadStep(step) { step === 'shell' ? sfx.shell() : step === 'out' ? sfx.magOut() : sfx.magIn(); },
});
const stats = { kills: 0 };
const debug = { ads: false, strafe: false }; // automation-only overrides (window.BDN.debug)

initFinishers(scene, camera);
// equipped cosmetics must be unlocked (e.g. after a progress reset)
for (const [k, pre, def] of [['finisher', 'fin', 'shatter'], ['wrap', 'wrap', 'none'], ['skin', 'skin', 'none'], ['color', 'color', 'graphite'], ['hat', 'hat', 'none']]) if (!progress.has(pre + ':' + settings[k])) settings[k] = def;
function applyCosmetics() {
  vm.setCosmetics({ wrap: settings.wrap, skin: settings.skin, cuff: COLORS[settings.color].hex });
  setSoldierLook(playerSoldier, { color: COLORS[settings.color].hex, hat: settings.hat });
  applySettings();
}
vm.scene.environment = envMap;
vm.scene.environmentIntensity = 0.7;


// ---------- keybinds: every action can be rebound (2 keys each), saved in this browser
let listening = null; // { action, index, el }
function renderBinds() {
  $('bindList').innerHTML = `<div class="brow bh"><span></span><span>Key</span><span>Alt key</span><span>Controller</span></div>` + Object.keys(BIND_LABELS).map((a) => `<div class="brow"><span>${BIND_LABELS[a]}</span>${[0, 1].map((i) => {
    const c = BINDS[a][i]; return `<button data-a="${a}" data-i="${i}" class="${c ? '' : 'empty'}">${c ? keyName(c) : '—'}</button>`; }).join('')}${['forward', 'back', 'left', 'right'].includes(a) ? '<button class="empty" disabled>Left stick</button>' : `<button data-a="${a}" data-i="2" data-pad="1" class="${PAD_BINDS[a] && PAD_BINDS[a][0] ? '' : 'empty'}">${PAD_BINDS[a] && PAD_BINDS[a].length ? PAD_BINDS[a].map(keyName).join(' / ') : '—'}</button>`}</div>`).join('');
  $('bindList').querySelectorAll('button').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    if (listening) listening.el.classList.remove('listen');
    listening = { action: b.dataset.a, index: +b.dataset.i, el: b, pad: !!b.dataset.pad };
    b.classList.add('listen'); b.textContent = b.dataset.pad ? 'Press a button…' : 'Press…';
  });
}
function captureBind(code) {
  if (!listening) return false;
  const { action, index, pad } = listening;
  if (pad && code !== 'Escape' && code !== 'Backspace' && !code.startsWith('GP_')) return true; // controller column wants a pad button
  if (!pad && code.startsWith('GP_')) return true;
  listening = null;
  if (pad) { if (code !== 'Escape') setPadBind(action, code === 'Backspace' ? null : code); sfx.ui(); renderBinds(); return true; }
  if (code === 'Escape') { renderBinds(); return true; }
  setBind(action, Math.min(index, BINDS[action].length), code === 'Backspace' ? null : code);
  sfx.ui(); renderBinds(); return true;
}
addEventListener('keydown', (e) => { if (listening) { e.preventDefault(); e.stopPropagation(); captureBind(e.code); } }, true);
addEventListener('mousedown', (e) => { if (listening && !e.target.closest('#bindList button')) { e.preventDefault(); captureBind('Mouse' + e.button); } }, true);
addEventListener('wheel', (e) => { if (listening) captureBind(e.deltaY < 0 ? 'WheelUp' : 'WheelDown'); }, { capture: true, passive: true });
$('bReset').onclick = () => { resetBinds(); sfx.ui(); renderBinds(); };
renderBinds();

// ---------- lobby: loadout with rendered weapon images
const gridTT = new Turntable(280, 150), detailTT = new Turntable(520, 260);
const THUMBS = renderThumbs(Object.values(WEAPONS));
hud.thumbs = THUMBS;
// Blender models stream in after boot: refresh thumbnails, the viewmodel and the lobby when ready
preloadModels().then(() => {
  Object.assign(THUMBS, renderThumbs(Object.values(WEAPONS)));
  vm.cosKey = null; applyCosmetics();
  if (typeof renderLobby === 'function') renderLobby();
  hud.slotKey = null;
});
const SLOT_NAMES = ['Primary', 'Secondary', 'Melee', 'Utility'];
const KIND_NAMES = { auto: 'Automatic', semi: 'Semi-auto', burst: 'Burst', pump: 'Pump-action', spin: 'Heavy', proj: 'Projectile', melee: 'Melee', util: 'Throwable' };
let pickSlot = 0, hoverId = null;
const pct = (v) => Math.round(Math.max(0.04, Math.min(1, v)) * 100);
function statsOf(w) {
  if (w.kind === 'melee') return [['Damage', w.dmg / 75, w.dmg], ['Speed', 0.32 / w.swing, (1 / w.swing).toFixed(1) + '/s'], ['Reach', w.range / 3, w.range + ' m']];
  if (w.kind === 'util') return [['Charges', w.charges / 2, w.charges], ['Recharge', 8 / w.recharge, w.recharge + ' s']];
  const shot = w.dmg * (w.pellets || 1);
  const rps = 1 / w.rate;
  return [['Damage', shot / 120, Math.round(shot)], ['Fire rate', Math.min(1, rps / 15), rps.toFixed(1) + '/s'], ['Range', (w.falloff[1] || 60) / 80, w.falloff[1] + ' m'], ['Mobility', w.moveMul || 1, Math.round((w.moveMul || 1) * 100) + '%'], ['Magazine', Math.min(1, w.mag / 40), w.mag]];
}
const FIN_ICON = { ghost: '⚰', lightning: 'ϟ', confetti: '✦', shatter: '◆', ember: '♨', pixel: '▦', balloon: '●', spotlight: '✧' };
const lockTag = (id) => (progress.has(id) ? '' : `<span class="lock">🔒 LV ${progress.levelFor(id)}</span>`);
function renderModes() {
  $('lmodes').innerHTML = Object.values(MODES).map((m) => `<button class="${settings.mode === m.id ? 'on' : ''}" data-m="${m.id}" title="${m.desc}">${m.name}</button>`).join('');
  $('ldiff').innerHTML = ['easy', 'normal', 'hard'].map((d) => `<button class="${settings.diff === d ? 'on' : ''}" data-d="${d}">${d}</button>`).join('');
  $('lmodes').querySelectorAll('button').forEach((b) => b.onclick = () => { settings.mode = b.dataset.m; applySettings(); sfx.ui(); renderModes(); });
  $('ldiff').querySelectorAll('button').forEach((b) => b.onclick = () => { settings.diff = b.dataset.d; applySettings(); sfx.ui(); renderModes(); });
  $('lmap').innerHTML = [['random', 'Random map'], ...Object.values(MAPS).map((m) => [m.id, m.name])].map(([id, n]) => `<button class="${settings.map === id ? 'on' : ''}" data-map="${id}">${n}</button>`).join('');
  $('lmap').querySelectorAll('button').forEach((b) => b.onclick = () => { settings.map = b.dataset.map; applySettings(); sfx.ui(); renderModes(); });
  const rng = MODES[settings.mode].range, onl = MODES[settings.mode].online;
  const mapName = rng ? 'Crate Yard' : settings.map === 'random' ? 'Random map' : MAPS[settings.map].name;
  $('playSub').textContent = `${MODES[settings.mode].name}${rng || onl ? '' : ' · ' + settings.diff + ' bots'} · ${mapName}`;
  $('ldiff').style.visibility = rng || onl ? 'hidden' : 'visible';
  $('lmap').style.visibility = rng ? 'hidden' : 'visible';
}
function renderLobby() {
  $('lslots').innerHTML = SLOTS.map((s, i) => { const w = WEAPONS[loadout[i]]; return `<button class="lslot ${i === pickSlot ? 'on' : ''}" data-i="${i}"><div class="k">${i + 1} · ${SLOT_NAMES[i]}</div><img src="${THUMBS[w.id]}" alt=""><b>${w.name}</b></button>`; }).join('')
    + `<button class="lslot fin ${pickSlot === 4 ? 'on' : ''}" data-i="4"><div class="k">Finisher</div><img class="finimg" src="${finImg(settings.finisher)}" alt=""><b>${FINISHERS[settings.finisher].name}</b></button>`;
  if (pickSlot === 4) {
    $('ptitle').textContent = 'Choose Finisher · plays on the last kill of a round';
    $('lgrid').innerHTML = Object.entries(FINISHERS).map(([id, f]) => `<button class="wcard fcard ${settings.finisher === id ? 'on' : ''} ${progress.has('fin:' + id) ? '' : 'locked'}" data-f="${id}"><img class="finimg" src="${finImg(id)}" alt=""><b>${f.name}</b><small>${f.desc}</small>${lockTag('fin:' + id)}</button>`).join('');
    $('ldetail').innerHTML = `<img class="finimg big" src="${finImg(settings.finisher)}" alt=""><div class="type">Finisher</div><h2>${FINISHERS[settings.finisher].name}</h2><p>${FINISHERS[settings.finisher].desc}</p><p class="muted">Plays on the final elimination of each round, and on every elimination in Free-for-All and the Practice Range.</p>`;
    $('lslots').querySelectorAll('.lslot').forEach((b) => b.onclick = () => { pickSlot = +b.dataset.i; hoverId = null; sfx.ui(); renderLobby(); });
    $('lgrid').querySelectorAll('.fcard').forEach((b) => b.onclick = () => { if (!progress.has('fin:' + b.dataset.f)) { sfx.dry(); return; } settings.finisher = b.dataset.f; applySettings(); sfx.ui(); renderLobby(); });
    return;
  }
  $('ptitle').textContent = `Choose ${SLOT_NAMES[pickSlot]}`;
  $('lgrid').innerHTML = byslot(SLOTS[pickSlot]).map((w) => `<button class="wcard ${loadout[pickSlot] === w.id ? 'on' : ''} ${progress.has('w:' + w.id) ? '' : 'locked'}" data-id="${w.id}"><canvas class="tt" width="280" height="150"></canvas><b>${w.name}</b><small>${KIND_NAMES[w.kind]}${w.ability ? ' · ' + w.ability.name : ''}</small>${lockTag('w:' + w.id)}</button>`).join('');
  // every weapon card is a live model, turning slowly
  gridTT.set([...$('lgrid').querySelectorAll('.wcard')].map((b) => ({ canvas: b.querySelector('canvas'), def: WEAPONS[b.dataset.id], cos: { wrap: settings.wrap, skin: settings.skin } })));
  if (!input.active) gridTT.start();
  renderDetail(hoverId || loadout[pickSlot]);
  $('lslots').querySelectorAll('.lslot').forEach((b) => b.onclick = () => { pickSlot = +b.dataset.i; hoverId = null; sfx.ui(); renderLobby(); });
  $('lgrid').querySelectorAll('.wcard').forEach((b) => {
    b.onclick = () => { if (!progress.has('w:' + b.dataset.id)) { sfx.dry(); return; } loadout[pickSlot] = b.dataset.id; try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout)); } catch (e) {} ws.setLoadout(loadout); sfx.ui(); renderLobby(); };
    b.onmouseenter = () => { hoverId = b.dataset.id; renderDetail(hoverId); };
    b.onmouseleave = () => { hoverId = null; renderDetail(loadout[pickSlot]); };
  });
}
function renderDetail(id) {
  const w = WEAPONS[id];
  $('ldetail').innerHTML = `<canvas class="tt big" width="520" height="260"></canvas><div class="type">${SLOT_NAMES[SLOTS.indexOf(w.slot)]} · ${KIND_NAMES[w.kind]}</div><h2>${w.name}</h2><p>${w.desc}</p>
    ${statsOf(w).map(([n, v, t]) => `<div class="stat"><span>${n}</span><i><u style="width:${pct(v)}%"></u></i><em>${t}</em></div>`).join('')}
    ${w.ability ? `<div class="abilitybox"><div class="t">${w.ability.name}<span>${w.ability.passive ? 'Passive' : 'E · ' + w.ability.cd + 's'}</span></div><p>${w.ability.desc}</p></div>` : ''}`;
  detailTT.set([{ canvas: $('ldetail').querySelector('canvas'), def: w, cos: { wrap: settings.wrap, skin: settings.skin } }]);
  if (!input.active) detailTT.start();
}
document.querySelectorAll('#ltabs button').forEach((b) => b.onclick = () => {
  if (b.dataset.tab === 'locker') renderLocker(); else turntable.stop();
  if (b.dataset.tab === 'loadout') { gridTT.start(); detailTT.start(); } else { gridTT.stop(); detailTT.stop(); }
  document.querySelectorAll('#ltabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.ltab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
});
// ---------- level bar + Locker tab
function renderLevel() {
  const need = xpToNext(progress.level);
  $('lvl').innerHTML = `<b>LV ${progress.level}</b><i><u style="width:${progress.level >= MAX_LEVEL ? 100 : (progress.xp / need) * 100}%"></u></i><small>${progress.level >= MAX_LEVEL ? 'MAX' : progress.xp + ' / ' + need + ' XP'}</small>`;
}
const turntable = new Turntable(280, 150);
function renderLocker() {
  const sec = (title, kind, items, cur, img) => `<div class="lsec"><div class="lph">${title}</div><div class="lgrid small">${Object.entries(items).map(([k, it]) => {
    const id = kind + ':' + k, ok = progress.has(id);
    const vis = img ? `<canvas class="tt" width="280" height="150" data-tt="${id}"></canvas>` : kind === 'color' ? `<div class="swatch" style="background:#${it.hex.toString(16).padStart(6, '0')}"></div>` : `<div class="ficon">${{ none: '⛑', beanie: '◗', cap: '◖', headset: '◎', bucket: '◒', crown: '♛', halo: '◯' }[k]}</div>`;
    return `<button class="wcard ${cur === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-kind="${kind}" data-k="${k}">${vis}<b>${it.name}</b>${it.desc ? `<small>${it.desc}</small>` : ''}${lockTag(id)}</button>`;
  }).join('')}</div></div>`;
  $('tab-locker').innerHTML = sec('Gun wrap · applies to every gun', 'wrap', WRAPS, settings.wrap, true) + sec('Melee skin · applies to every blade', 'skin', SKINS, settings.skin, true)
    + sec('Avatar color · glove cuffs, visor and armbands', 'color', COLORS, settings.color, false) + sec('Headwear · seen in killcams', 'hat', HATS, settings.hat, false)
    + `<div class="lsec"><div class="lph">Level track</div><div class="track">${Object.entries(UNLOCKS).map(([l, id]) => { const nm = (x) => { const r = rewardInfo(x); return r.kind === 'w' ? WEAPONS[r.key].name : r.kind === 'fin' ? FINISHERS[r.key].name : r.name; }; return `<div class="ti ${progress.level >= +l ? 'got' : ''}"><b>${l}</b><span>${nm(id)}${BONUS[l] ? ' + ' + nm(BONUS[l]) : ''}</span></div>`; }).join('')}</div></div>`;
  // live spinning previews: wraps on the revolver, skins on the katana
  turntable.set([...$('tab-locker').querySelectorAll('canvas.tt')].map((cv) => {
    const [kind, k] = cv.dataset.tt.split(':');
    return { canvas: cv, def: kind === 'wrap' ? WEAPONS.judge : WEAPONS.katana, cos: kind === 'wrap' ? { wrap: k } : { skin: k } };
  }));
  turntable.start();
  $('tab-locker').querySelectorAll('.wcard').forEach((b) => b.onclick = () => {
    const kind = b.dataset.kind, k = b.dataset.k;
    if (!progress.has(kind + ':' + k)) { sfx.dry(); return; }
    settings[{ wrap: 'wrap', skin: 'skin', color: 'color', hat: 'hat' }[kind]] = k;
    applyCosmetics(); sfx.ui(); renderLocker();
  });
}
// sandbox switch for testing everything without grinding
$('sUnlock').checked = progress.unlockAll;
$('sUnlock').onchange = () => { progress.unlockAll = $('sUnlock').checked; progress.save(); loadout = savedLoadout(); ws.setLoadout(loadout); renderLobby(); renderLocker(); };
renderLevel();
applyCosmetics();
renderLobby();
renderModes();

// ---------- matches (offline, vs bots)

function botShoot(bot, dirs) {
  const def = bot.def, o = bot.eye(); bot.firedT = matchTime;
  const f = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw)), r = new THREE.Vector3(Math.cos(bot.yaw), 0, -Math.sin(bot.yaw));
  const muzzle = o.clone().addScaledVector(f, 0.7).addScaledVector(r, 0.18).add(new THREE.Vector3(0, -0.2, 0));
  const agg = new Map();
  dirs.forEach((dir, i) => {
    const hit = hitscan(o, dir, def.range, bot);
    const end = o.clone().addScaledVector(dir, Math.min(hit ? hit.t : 120, 150));
    if (i < 3) impacts.tracer(muzzle, end, 0xffe2a8);
    if (!hit) return;
    if (hit.kind === 'world') { if (i < 3) impacts.hole(end, hit.normal); impacts.puff(end, hit.normal, undefined, 2); return; }
    const head = hit.part === 'head';
    const a = agg.get(hit.dummy) || { dmg: 0, head: false, point: end };
    a.dmg += def.dmg * (head ? def.head : 1) * falloff(def, hit.t);
    a.head = a.head || head;
    agg.set(hit.dummy, a);
  });
  bot.shots = (bot.shots || 0) + 1; if (agg.has(player)) bot.hits = (bot.hits || 0) + 1; // stats for tuning
  for (const [t, a] of agg) dealDamage(t, a.dmg, a.head, a.point, true, bot, def);
  for (const b of bots) if (b !== bot && (match.mode.ffa || b.team !== bot.team)) b.hear(bot.pos, matchTime, settings.diff);
  const dist = bot.pos.distanceTo(me.pos);
  sfx.enemyFire(def, Math.max(0, 1 - dist / 55) * 0.8, dist);
}
function botFrag(bot, target) {
  const o = bot.eye(), d = Math.hypot(target.x - o.x, target.z - o.z), speed = 13, t = d / speed, g = 18;
  const v = new THREE.Vector3((target.x - o.x) / t, ((target.y + 0.2) - o.y + 0.5 * g * t * t) / t, (target.z - o.z) / t);
  proj.throw(WEAPONS.frag, o, v, Math.max(0.8, 2.3 - t), { owner: bot });
  sfx.toss();
}
const botCtx = {
  diff: 'normal', nav, time: 0, live: false,
  // is there ground under (x,z) close below y? only matters on maps with chasms
  get chasm() { return !!map.noGround; },
  safe: (x, y, z) => {
    if (!map.noGround) return true;
    for (const b of world.boxes) if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] <= y + 0.6 && b.max[1] >= y - 3) return true;
    return false;
  },
  enemies: (b) => match.enemiesOf(b),
  los: (a, b) => clearLine(a, b) && !proj.smokeBlocks(a, b),
  shoot: botShoot, throwFrag: botFrag,
  onDot: (b, n) => dealDamage(b, n, false, chest(b), true, player, WEAPONS.signal),
  onFell: (b) => { botCtx.falls = (botCtx.falls || 0) + 1; (botCtx.fallLog = botCtx.fallLog || []).push({ at: b.lastGround && b.lastGround.toArray().map((n) => +n.toFixed(1)), vis: b.visible, path: !!(b.path && b.path.length), dashOrKnock: b.mover.dashT > 0 }); onKilled(b, null, null, false); },
};

function respawnActor(a, sp) {
  if (a === player) {
    me.spawn(sp.x, (sp.y || 0) + 0.01, sp.z); input.yaw = sp.yaw; input.pitch = 0;
    player.hp = player.maxHp; player.alive = true; player.burnT = 0;
    ws.setLoadout(loadout); vm.hidden = false; killcam.stop(); spectate = null; hud.killcam(null);
  } else a.spawn(sp.x, sp.z, sp.yaw, sp.y || 0);
}

function clearMatch() {
  leaveOnline();
  for (const b of bots) scene.remove(b.model);
  bots = []; match = null; spectate = null; killcam.stop(); killcam.frames.length = 0; hud.killcam(null); hud.round(null);
  for (const s of [...shields]) { s.t = 0; } updateShields(0);
}

function startMatch(modeId) {
  clearMatch();
  matchXP = { kills: 0, heads: 0, rounds: 0 };
  player.kills = 0; player.deaths = 0; player.dmgDealt = 0;
  botCtx.diff = settings.diff;
  const range = !!MODES[modeId].range;
  // the range always uses Crate Yard (that's where the mannequins live); matches use the picked map
  const ids = Object.keys(MAPS);
  loadMap(range ? 'crateyard' : settings.map === 'random' ? ids[Math.floor(Math.random() * ids.length)] : settings.map);
  for (const d of dummies) { d.model.visible = range; d.alive = range; d.hp = d.maxHp; d.bar.draw(1); }
  match = new Match(modeId, {
    map, player,
    makeBot: (team, colorIdx) => { const b = new Bot(scene, world, team, { colorIdx }); bots.push(b); return b; },
    respawnActor,
    emit: onMatchEvent,
  });
  player.side = undefined;
  if (range) { player.alive = true; player.hp = player.maxHp; respawn(); ws.setLoadout(loadout); } else match.startRound();
  matchTime = 0;
  hud.feedClear();
}

function onMatchEvent(type, d) {
  if (net && net.host) {
    if (type === 'roundStart') nsend('rs', { round: d.round, sc: sideScore() });
    if (type === 'roundEnd') nsend('re', { win: sideOf(d.team), sc: sideScore(), final: d.final });
    if (type === 'matchOver') nsend('over', { win: sideOf(d.winner) });
  }
  if (type === 'roundStart') { hud.big(`ROUND ${d.round}`, match.mode.ffa ? 'First to ' + match.mode.goal : scoreLine()); sfx.countdown(false); }
  if (type === 'tick') { hud.big(String(d.n), ''); sfx.countdown(false); }
  if (type === 'go') { hud.big('FIGHT', ''); sfx.countdown(true); }
  if (type === 'roundEnd') {
    const won = d.team === player.team;
    if (won && !match.mode.ffa) matchXP.rounds++;
    if (match.mode.ffa) hud.big(d.killer === player ? 'VICTORY' : 'DEFEAT', `${d.killer ? d.killer.name : '—'} reached ${match.mode.goal}`);
    else hud.big(won ? 'ROUND WON' : d.team < 0 ? 'DRAW' : 'ROUND LOST', scoreLine());
    won ? sfx.roundWin() : sfx.roundLose();
  }
  if (type === 'matchOver') showResults(d.winner === player.team);
}
const scoreLine = () => match && match.score ? `${match.score[0]} – ${match.score[1]}` : '';

function showResults(won, note = '') {
  // XP for this match
  const X = matchXP, lines = [['Eliminations', X.kills * XP_RULES.kill], ['Headshots', X.heads * XP_RULES.headshot], ['Rounds won', X.rounds * XP_RULES.roundWin], ['Match played', XP_RULES.matchPlayed]];
  if (won) lines.push(['Victory', XP_RULES.matchWin]);
  const total = lines.reduce((a, [, v]) => a + v, 0);
  const startLevel = progress.level;
  const ups = progress.add(total);
  renderLevel();
  const unlockHtml = ups.map((u) => { const r = rewardInfo(u.reward); const nm = r.kind === 'w' ? WEAPONS[r.key].name : r.kind === 'fin' ? FINISHERS[r.key].name : r.name; return `<div class="unl"><b>LEVEL ${u.level}</b><span>Unlocked ${nm}</span></div>`; }).join('');
  if (ups.length) { setTimeout(() => sfx.levelUp(), 400); loadout = savedLoadout(); renderLobby(); }
  const rows = [...match.actors].sort((a, b) => (b.kills || 0) - (a.kills || 0));
  $('results').innerHTML = `<div class="rcard panel"><div class="rt ${won ? 'win' : 'lose'}">${won ? 'VICTORY' : 'DEFEAT'}</div><div class="rs">${match.mode.name}${match.mode.ffa ? '' : ' · ' + scoreLine()}${note ? ' · ' + note : ''}</div>
    <table><tr><th>Player</th><th>Kills</th><th>Deaths</th><th>Damage</th></tr>${rows.map((a) => `<tr class="${a === player ? 'me' : ''}"><td><i style="background:#${(a.isPlayer ? TEAM_COLORS[0] : (match.mode.ffa ? TEAM_COLORS[a.team % 8] : TEAM_COLORS[a.team])).toString(16).padStart(6, '0')}"></i>${a.name}</td><td>${a.kills || 0}</td><td>${a.deaths || 0}</td><td>${Math.round(a.dmgDealt || 0)}</td></tr>`).join('')}</table>
    <div class="xp"><div class="xl">${lines.filter(([, v]) => v).map(([n, v]) => `<div><span>${n}</span><b>+${v}</b></div>`).join('')}<div class="tot"><span>Total</span><b>+${total} XP</b></div></div>
      <div class="xbar"><small>LV ${progress.level}${progress.level > startLevel ? ` (from ${startLevel})` : ''}</small><i><u style="width:${progress.level >= MAX_LEVEL ? 100 : (progress.xp / xpToNext(progress.level)) * 100}%"></u></i></div>${unlockHtml}</div>
    <div class="rb"><button id="rAgain" class="playbtn"><span>Play again</span></button><button id="rLobby" class="ghostbtn">Lobby</button></div></div>`;
  $('results').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  $('rAgain').onclick = () => { $('results').classList.add('hidden'); if (match.mode.online) { clearMatch(); startMatch('range'); start.classList.remove('hidden'); openOnline(); return; } startMatch(match.mode.id); input.lock(); };
  $('rLobby').onclick = () => { $('results').classList.add('hidden'); clearMatch(); startMatch('range'); start.classList.remove('hidden'); };
}

// pose actor models from killcam frames (or hide your own body when back in first person)
// Third-person killcam: the camera circles slowly behind the killer's shoulder, kept out of walls.
function killcamOrbit(k) {
  const P = killcam.play, prog = (P.t - P.t0) / Math.max(0.01, P.t1 - P.t0);
  const c = new THREE.Vector3(k.x, k.y + 1.35, k.z);
  const ang = k.yaw + 0.55 - prog * 1.1, r = 3.4;
  const want = new THREE.Vector3(c.x + Math.sin(ang) * r, c.y + 0.75, c.z + Math.cos(ang) * r);
  const d = want.clone().sub(c), len = d.length(); d.normalize();
  const hit = world.raycast([c.x, c.y, c.z], [d.x, d.y, d.z], len);
  camera.position.copy(c).addScaledVector(d, hit ? Math.max(0.6, hit.t - 0.3) : len);
  const look = c.clone().add(new THREE.Vector3(-Math.sin(k.yaw) * 1.5, -0.1, -Math.cos(k.yaw) * 1.5));
  camera.lookAt(look);
}
function applyKillcamFrame(frame) {
  for (const s of frame) {
    const model = s.a === player ? playerSoldier : s.a.soldier;
    if (!model) continue;
    model.group.visible = s.alive || s.a !== player;
    if (s.w && WEAPONS[s.w]) setSoldierGun(model, WEAPONS[s.w]); // holding what they held at that moment
    poseSoldier(model, { pos: new THREE.Vector3(s.x, s.y, s.z), yaw: s.yaw, pitch: s.pitch, speed: s.sp, crouched: s.cr, t: s.t, onGround: s.g, recoil: Math.max(0, 1 - (s.t - s.f) * 8) });
    model.group.rotation.x = 0;
  }
}


// ---------- online 1v1
// Each client owns its own health: the shooter detects hits and sends them, the victim applies them
// and announces its death. The host (whoever waited longest / made the room) runs the round flow;
// the guest's Match is passive and mirrors it. Not cheat-proof; fine for friendly duels.
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sideOf = (team) => (team < 0 || team === undefined || team === null ? -1 : team === 0 ? player.side : net.remote.side);
const localTeam = (side) => (side < 0 ? -1 : side === player.side ? 0 : 1);
const sideScore = () => ({ [player.side]: match.score[0], [net.remote.side]: match.score[1] });
const localScore = (sc) => ({ 0: sc[player.side] || 0, 1: sc[net.remote.side] || 0 });
let search = null, lastKind = 'quick';

function leaveOnline() {
  if (!net) return;
  nsend('bye', {});
  if (net.ch) net.ch.leave();
  if (net.readyIv) clearInterval(net.readyIv);
  if (net.remote) net.remote.dispose(scene);
  net = null; player.side = undefined;
}

function beginOnline({ ch, host, opp }) {
  clearMatch();
  net = { ch, host, opp, remote: null, started: false, snapT: 0 };
  ch.onMsg = onNetMsg;
  ch.onPeers = (peers) => { if (net && net.ch === ch && !peers.some((p) => p.id === opp.id)) opponentLeft(); };
  onlineStatus(`Connected to ${opp.name || 'opponent'}. Starting…`);
  if (!host) { const ping = () => nsend('ready', {}); ping(); net.readyIv = setInterval(ping, 600); }
}

function startOnlineMatch(mapId) {
  const n = net;
  if (n.readyIv) { clearInterval(n.readyIv); n.readyIv = null; }
  matchXP = { kills: 0, heads: 0, rounds: 0 };
  player.kills = 0; player.deaths = 0; player.dmgDealt = 0;
  loadMap(MAPS[mapId] ? mapId : 'crateyard');
  for (const d of dummies) { d.model.visible = false; d.alive = false; }
  const r = n.remote = new RemotePlayer(scene, n.opp);
  player.side = n.host ? 0 : 1; r.side = 1 - player.side;
  // effects we cause on them are applied by their client
  r.knock = (v) => nsend('knock', v3(v)); r.launch = (vy) => nsend('launch', vy); r.burn = (dps, t) => nsend('burn', [dps, t]);
  match = new Match('online', { map, player, makeRemote: () => r, respawnActor, emit: onMatchEvent, passive: !n.host });
  n.started = true; matchTime = 0; hud.feedClear();
  closeOnline();
  $('resume').textContent = 'Enter the match'; $('resume').classList.remove('hidden');
  hud.toast(`VS ${r.name}`);
  if (n.host) match.startRound();
}

function onNetMsg(k, d) {
  const n = net; if (!n) return;
  const r = n.remote;
  switch (k) {
    case 'ready': if (n.host) { const ids = Object.keys(MAPS); const m = n.map || (n.map = settings.map === 'random' || !MAPS[settings.map] ? ids[Math.floor(Math.random() * ids.length)] : settings.map); nsend('start', { map: m }); if (!n.started) startOnlineMatch(m); } break;
    case 'start': if (!n.host && !n.started) startOnlineMatch(d.map); break;
  }
  if (!n.started) return;
  switch (k) {
    case 's': r.push(d); break;
    case 'shot': {
      const def = WEAPONS[d.w]; if (!def) break;
      r.firedT = matchTime;
      const o = V(d.o), m = r.alive ? r.muzzle() : o;
      d.d.forEach((a, i) => {
        const dir = V(a), w = world.raycast(d.o, a, def.range || 120);
        const end = o.clone().addScaledVector(dir, Math.min(w ? w.t : 120, 150));
        impacts.tracer(m, end, 0xffe2a8);
        if (w && i < 3) { impacts.hole(end, w.normal); impacts.puff(end, w.normal, undefined, 2); }
      });
      const dist = r.pos.distanceTo(me.pos);
      sfx.enemyFire(def, Math.max(0.12, 1 - dist / 55) * 0.85, dist);
      break;
    }
    case 'swing': if (r.pos.distanceTo(me.pos) < 14 && WEAPONS[d.w]) sfx.swing(WEAPONS[d.w]); break;
    case 'hit': if (player.alive && match.live) dealDamage(player, +d.dmg || 0, !!d.head, chest(player), true, r, WEAPONS[d.w] || r.def); break;
    case 'knock': if (player.alive) me.vel.add(V(d)); break;
    case 'launch': if (player.alive) me.launch(+d); break;
    case 'burn': if (player.alive) player.burn(d[0], d[1], r); break;
    case 'dead': {
      if (!r.alive) break;
      r.die();
      const mine = !!d.by;
      if (mine) {
        sfx.kill(); hud.hit(!!d.head, true); stats.kills++;
        if (match.state === 'live') { matchXP.kills++; if (d.head) matchXP.heads++; }
      }
      onKilled(r, mine ? player : null, WEAPONS[d.w] || null, !!d.head);
      break;
    }
    case 'proj': { const def = WEAPONS[d.w]; if (def) proj.shoot(def, V(d.o), V(d.d), { ...(d.x.proj ? { proj: d.x.proj } : {}), spin: d.x.spin, axe: d.x.axe || undefined, ghost: true }); break; }
    case 'nade': { const def = WEAPONS[d.w]; if (def) proj.throw(def, V(d.o), V(d.v), d.f, { ghost: true, owner: r }); break; }
    case 'fx': proj.explosion(V(d.p), d.c, d.s); break;
    case 'shield': addShield(d.min, d.max, d.dur); break;
    case 'rs': if (!n.host) match.applyRoundStart(d.round, localScore(d.sc)); break;
    case 're': if (!n.host) match.applyRoundEnd(localTeam(d.win), localScore(d.sc), d.final); break;
    case 'over': if (!n.host) match.applyOver(localTeam(d.win)); break;
    case 'bye': opponentLeft(); break;
  }
}

function netStep(dt) {
  const n = net;
  n.remote.update(dt);
  n.snapT += dt;
  if (n.snapT >= 1 / SNAP_HZ) {
    n.snapT = 0;
    nsend('s', { t: +(performance.now() / 1000).toFixed(3), p: v3(me.pos), y: +input.yaw.toFixed(3), pi: +input.pitch.toFixed(3), c: me.crouched ? 1 : 0, s: +me.hSpeed.toFixed(1), g: me.onGround ? 1 : 0, w: ws.def.id });
  }
  if (performance.now() / 1000 - n.remote.lastMsg > 10) opponentLeft();
}

function opponentLeft() {
  const n = net; if (!n || !n.ch) return;
  n.ch.leave(); n.ch = null;
  if (!n.started) { onlineStatus('Your opponent left before the match started.'); return; }
  if (match && match.state !== 'over') {
    match.winner = 0; match.state = 'over';
    hud.big('OPPONENT LEFT', 'You win by forfeit');
    setTimeout(() => { if (match && match.mode.online) showResults(true, 'opponent left'); }, 1800);
  }
}

// ---- lobby panel
function onlineStatus(t) { $('onStatus').textContent = t; }
function openOnline() {
  $('online').classList.remove('hidden');
  $('onName').value = settings.name;
  $('onBackend').textContent = backend === 'supabase' ? '' : 'Local test mode: no server keys are set, so only other tabs in this browser can find you. See README to go online.';
  showOnlineIdle();
}
function closeOnline() { $('online').classList.add('hidden'); }
function showOnlineIdle() { $('onIdle').classList.remove('hidden'); $('onBusy').classList.add('hidden'); onlineStatus(''); }
function startSearch(kind, code) {
  settings.name = ($('onName').value || '').trim().slice(0, 16) || settings.name; applySettings();
  lastKind = kind;
  if (search) search.cancel();
  $('onIdle').classList.add('hidden'); $('onBusy').classList.remove('hidden');
  $('onCode').textContent = kind === 'room' ? code : '';
  const s = search = findMatch(kind, { name: settings.name, hat: settings.hat, finisher: settings.finisher }, onlineStatus, code);
  s.promise.then((found) => { if (search !== s) { found.ch.leave(); return; } search = null; sfx.unlock(); beginOnline(found); })
    .catch((e) => { if (search !== s) return; search = null; if (e.message !== 'cancelled') { showOnlineIdle(); onlineStatus(e.message); } });
}
$('onQuick').onclick = () => { sfx.ui(); startSearch('quick'); };
$('onCreate').onclick = () => { sfx.ui(); startSearch('room', newCode()); };
$('onJoin').onclick = () => {
  const c = ($('onJoinCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) { onlineStatus('Room codes are 6 characters.'); return; }
  sfx.ui(); startSearch('room', c);
};
$('onCancel').onclick = () => { if (search) { search.cancel(); search = null; } if (net && !net.started) leaveOnline(); showOnlineIdle(); };
$('onClose').onclick = () => { if (search) { search.cancel(); search = null; } if (net && !net.started) leaveOnline(); closeOnline(); };
input.onLockChange = ((prev) => (locked) => { prev(locked); if (locked) $('resume').textContent = 'Resume'; })(input.onLockChange);


// ---------- controller: aim assist, menus, device prompts
// Slight aim assist (controller only): the look stick slows near an enemy (friction), and while you
// move or turn the aim drifts a little toward their chest (magnetism). Off for mouse; toggle in Settings.
// Aim assist levels (controller only):
//  slight: slowdown near targets + a gentle pull while you move.
//  strong: lock-on tracking inside a wide cone (follows the target even with the stick still) and
//          bullet magnetism: ~90% of shots that leave near the target are bent onto its body.
const ASSIST = {
  slight: { cone: (d) => Math.max(0.045, Math.atan(1.1 / d)), fric: 0.62, fricAds: 0.5, rate: 2.2, rateAds: 3.2, k: 0.6, needMove: true, magnet: 0 },
  strong: { cone: (d) => Math.max(0.17, Math.atan(2.6 / d)), fric: 0.45, fricAds: 0.35, rate: 9, rateAds: 13, k: 1, needMove: false, magnet: 0.85 },
};
let assistTarget = null;
function aimAssist(dt, cmd) {
  input.assistMul = 1; assistTarget = null;
  const A = ASSIST[settings.aimAssist];
  if (!A || !ws.isGun && ws.def.kind !== 'melee') return;
  const e = eyePos(new THREE.Vector3()), f = lookDir();
  let best = null, bestA = Infinity;
  for (const t of targetsFor(player)) {
    if (!t.alive) continue;
    const c = chest(t), v = c.clone().sub(e), d = v.length();
    if (d > (ws.isGun ? Math.min(ws.def.range || 80, 80) : 4.5)) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, f.dot(v.clone().normalize()))));
    const cone = A.cone(d);
    if (ang < cone && ang < bestA && clearLine(e, c) && !proj.smokeBlocks(e, c)) { best = { t, c, v, d, cone }; bestA = ang; }
  }
  if (!best) return;
  assistTarget = best;
  const ads = ws.adsT > 0.5;
  input.assistMul = ads ? A.fricAds : A.fric; // friction
  if (A.needMove && !(input.padLookMag > 0.08 || Math.hypot(cmd.fwd, cmd.side) > 0.2)) return;
  // track where they'll be a moment from now so a strafing target doesn't drag behind the crosshair
  const lead = best.t.mover && best.t.mover.vel ? best.t.mover.vel.clone().setY(0).multiplyScalar(0.06) : new THREE.Vector3();
  const v = best.v.clone().add(lead);
  const wantYaw = Math.atan2(-v.x, -v.z), wantPitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
  let dy = wantYaw - input.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const edge = A.needMove ? 1 - bestA / best.cone : 1;
  const pull = Math.min(1, (ads ? A.rateAds : A.rate) * dt) * edge * A.k;
  input.yaw += dy * pull; input.pitch += (wantPitch - input.pitch) * pull * 0.8;
}
// Bullet magnetism (strong assist): bend each shot onto the locked target's body ~90% of the time.
function magnetize(dirs, origin, def) {
  const A = ASSIST[settings.aimAssist];
  if (!A || !A.magnet || input.device !== 'pad' || !assistTarget || !assistTarget.t.alive) return dirs;
  const t = assistTarget.t, speed = def.proj ? def.proj.speed : 0;
  return dirs.map((d) => {
    if (Math.random() > A.magnet) return d;
    const p = t.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.55 + Math.random() * 0.75, (Math.random() - 0.5) * 0.3));
    if (speed && t.mover && t.mover.vel) { const tt = p.distanceTo(origin) / speed; p.addScaledVector(t.mover.vel, tt); p.y += 0.5 * (def.proj.gravity || 0) * tt * tt; }
    return p.sub(origin).normalize();
  });
}

const padnav = new PadNav(input, {
  back: () => {
    if (!$('online').classList.contains('hidden')) { $('onClose').click(); return; }
    if (listening) { captureBind('Escape'); return; }
    const t = document.querySelector('#ltabs button[data-tab=loadout]'); if (t && !t.classList.contains('on')) t.click();
  },
  tab: (d) => {
    const tabs = [...document.querySelectorAll('#ltabs button')], i = tabs.findIndex((t) => t.classList.contains('on'));
    tabs[(i + d + tabs.length) % tabs.length].click(); sfx.ui(); padnav.cur = null;
  },
  start: () => {
    if (!$('results').classList.contains('hidden')) { $('rAgain').click(); return; }
    if (!$('resume').classList.contains('hidden')) $('resume').click(); else $('play').click();
  },
  ui: () => sfx.ui(),
});

// prompts follow the device you're using
input.onDevice = (d) => {
  document.body.classList.toggle('pad', d === 'pad');
  hud.slotKey = null; hud.padMode = d === 'pad'; hud.label = (a) => input.label(a);
};
hud.label = (a) => input.label(a);

// Controller setup: learn which physical button is which (for pads that report an unusual layout)
let padSetup = null;
const SETUP_ORDER = ['GP_A', 'GP_B', 'GP_X', 'GP_Y', 'GP_LB', 'GP_RB', 'GP_LT', 'GP_RT', 'GP_SELECT', 'GP_START', 'GP_L3', 'GP_R3', 'GP_HOME'];
function startPadSetup() {
  padSetup = { i: 0, map: {}, prev: null };
  $('padSetup').classList.remove('hidden'); renderPadSetup();
}
function renderPadSetup() {
  const k = SETUP_ORDER[padSetup.i];
  $('psStep').textContent = `${padSetup.i + 1} / ${SETUP_ORDER.length}`;
  $('psBtn').textContent = PAD_NAMES[k];
  $('psHint').textContent = input.pad ? `Press ${PAD_NAMES[k]} on your controller` : 'Press any button on your controller to wake it up';
}
function padSetupFrame() {
  const pad = input.pad; input.takePadUI();
  if (!pad) return renderPadSetup();
  const now = pad.buttons.map((b) => b.pressed || b.value > 0.5);
  if (padSetup.prev) {
    const i = now.findIndex((on, j) => on && !padSetup.prev[j]);
    if (i >= 0) { padSetup.map[i] = SETUP_ORDER[padSetup.i]; sfx.ui(); padSetup.i++; if (padSetup.i >= SETUP_ORDER.length) return finishPadSetup(true); renderPadSetup(); }
  }
  padSetup.prev = now;
}
function finishPadSetup(save) {
  if (save) { PADCFG.custom = padSetup.map; savePadCfg(); sfx.unlock(); }
  padSetup = null; $('padSetup').classList.add('hidden'); renderPadCfg();
}
function renderPadCfg() {
  $('padLayout').textContent = PADCFG.custom ? 'Custom layout (from setup)' : input.pad ? (input.pad.mapping === 'standard' ? 'Standard layout' : 'Generic layout (your Pad Bench mapping)') : 'No controller detected yet';
  $('padAxes').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.ax === PADCFG.rightAxes));
}
$('psSkip').onclick = () => { padSetup.i++; if (padSetup.i >= SETUP_ORDER.length) finishPadSetup(true); else renderPadSetup(); };
$('psCancel').onclick = () => finishPadSetup(false);
$('padSetupBtn').onclick = () => startPadSetup();
$('padReset').onclick = () => { PADCFG.custom = null; savePadCfg(); renderPadCfg(); sfx.ui(); };
$('padAxes').querySelectorAll('button').forEach((b) => b.onclick = () => { PADCFG.rightAxes = b.dataset.ax; savePadCfg(); renderPadCfg(); sfx.ui(); });
addEventListener('gamepadconnected', () => { renderPadCfg(); hud.toast && hud.toast('CONTROLLER CONNECTED'); });
renderPadCfg();

startMatch('range'); // boot into the practice range behind the lobby

// ---------- loop
const LOOP = {
  hz: 120,
  step(dt) {
    if (input.consume('respawn') && isRange()) respawn();
    matchTime += dt;
    if (match && !match.mode.range) match.update(dt);
    const frozen = match && match.frozen, canAct = player.alive && !frozen && !(match && match.state === 'over');
    const cmd = input.active && canAct ? input.command() : { ...IDLE_CMD, yaw: input.yaw };
    if (canAct && input.device === 'pad') aimAssist(dt, cmd);
    if (!canAct) input.pressed.clear();
    if (debug.ads) cmd.adsHeld = true;
    if (debug.fire && canAct) { cmd.fireHeld = true; cmd.firePressed = true; }
    if (debug.strafe && canAct) { cmd.side = Math.sin(matchTime * 2.4) > 0 ? 1 : -1; cmd.fwd = 0; } // test: a player that dodges
    if (debug.hold) { ws.state = debug.hold.state; ws.stateDur = 1; ws.timer = 1 - debug.hold.p; } // freeze an animation pose
    lastCmd = cmd;
    cmd.ads = ws.adsT > 0.35;
    // bots
    botCtx.time = matchTime; botCtx.live = !!match && match.live;
    // round won: zero gravity for everyone until the next round, and the void can't kill
    const floaty = !!match && !match.mode.range && (match.state === 'roundEnd' || match.state === 'over');
    botCtx.floaty = floaty; me.gravityScale = floaty ? 0 : 1;
    for (const b of bots) b.mover.gravityScale = floaty ? 0 : 1;
    for (const b of bots) b.update(dt, botCtx);
    if (net && net.started) netStep(dt);
    if (match && !match.mode.range) killcam.record(dt, matchTime, match.actors);
    if (player.burnT > 0) { player.burnT -= dt; player.burnTick += dt; if (player.burnTick >= 0.5) { player.burnTick -= 0.5; dealDamage(player, player.burnDps * 0.5, false, chest(player), true, player.burnBy || null); } }
    if (!player.alive) { proj.update(dt); updateShields(dt); return; }
    me.step(dt, cmd);
    ws.infinite = isRange();
    ws.tick(dt, cmd, me, input);
    input.adsSensMul = 1 + (ws.def.adsSens - 1) * ws.adsT;
    if (me.stepOffset) fcam.onStep(me.stepOffset);
    // footsteps: one per stride while running on the ground (quiet when crouched, none while sliding)
    if (me.onGround && !me.sliding && me.hSpeed > 2.2) { stepT -= dt * me.hSpeed; if (stepT <= 0) { stepT = 2.6; sfx.step(me.crouched); } } else stepT = 0.4;
    fcam.onEvents(me.events);
    for (const e of me.events) { if (e.type === 'land') sfx.land(e.v); if (e.type === 'slide') sfx.slide(); }
    if (!floaty && me.events.some((e) => e.type === 'fell')) { if (isRange()) respawn(); else { player.hp = 0; player.alive = false; player.deaths++; onKilled(player, null, null, false); } }
    // scythe dash: damages everything it passes through, once each
    if (dashHits) {
      dashHits.t -= dt;
      for (const dm of targetsFor(player)) if (dm.alive && !dashHits.set.has(dm) && chest(dm).distanceTo(me.pos.clone().setY(me.pos.y + 1)) < 1.7) { dashHits.set.add(dm); dealDamage(dm, dashHits.dmg, false, chest(dm)); }
      if (dashHits.t <= 0) dashHits = null;
    }
    if (pendingSlam && me.onGround) { doSlam(pendingSlam); pendingSlam = null; }
    if (ws.axeAway > 0) ws.axeAway -= dt;
    updateShields(dt);
    const pad = proj.padAt(me.pos);
    if (pad) { me.launch(pad.launch); me.vel.x *= 1.15; me.vel.z *= 1.15; pad.cool = 0.4; sfx.pad(); fcam.shake(0.006, 0.15); }
    proj.update(dt);
    burnFires(dt);
    if (isRange()) for (const d of dummies) d.update(dt, me.pos, (dm, n) => dealDamage(dm, n, false, chest(dm), true));
  },
  render(alpha, dt) {
    input.pollPad(dt);
    if (listening && listening.pad) { const ui = input.takePadUI(); const c = [...ui][0]; if (c) captureBind(c); }
    else if (padSetup) padSetupFrame();
    else if (!input.active) padnav.frame(dt);
    else {
      input.takePadUI();
      if (input.pressed.delete('GP_START')) { input.setPadPlaying(false); if (input.locked) document.exitPointerLock(); }
    }
    const workT0 = performance.now();
    if (!document.hidden) adaptResolution(dt);
    updateFinishers(dt);
    tickCosmetics(performance.now() / 1000);
    let thirdPerson = false;
    if (killcam.active) {
      // replay from the killer's eyes
      const frame = killcam.step(dt);
      if (frame) {
        applyKillcamFrame(frame);
        const k = frame.find((s) => s.a === killcam.play.killer);
        if (k) { killcamOrbit(k); thirdPerson = true; }
      } else {
        hud.killcam(null);
        playerSoldier.group.visible = false;
        for (const b of bots) if (b.alive) b.model.visible = true;
        if (net && net.remote) net.remote.model.visible = net.remote.alive;
      }
    }
    if (!thirdPerson && !player.alive && match && !match.mode.range) {
      // spectate a living teammate (or float above your body)
      if (!spectate || !spectate.alive) spectate = match.alliesOf(player)[0] || null;
      if (spectate) { const e = spectate.eye(); camera.position.copy(e); camera.rotation.set(spectate.pitch, spectate.yaw, 0); hud.spectate(spectate.name); }
      else { camera.position.set(me.pos.x, me.pos.y + 6, me.pos.z + 6); camera.lookAt(me.pos); hud.spectate(null); }
      thirdPerson = true;
    }
    if (!thirdPerson) {
      fcam.zoom = 1 + (ws.def.adsZoom - 1) * ws.adsT;
      fcam.update(me, input, alpha, dt);
      hud.spectate(null);
    }
    vm.setWeapon(ws.def);
    vm.hidden = thirdPerson || !player.alive || (!!ws.def.scope && ws.adsT > 0.85); // scoped: the HUD scope replaces the gun
    vm.update(dt, ws, me, fcam, input.takeLook());
    impacts.update(dt);
    hud.update(dt, ws, camera);
    hud.health(player.hp, player.maxHp, player.alive);
    hud.root.classList.toggle('dead', !player.alive);
    if (match && !match.mode.range) hud.round(match, player); else hud.round(null);
    const hs = me.hSpeed;
    if (hs > peak || (peakT += dt) > 3) { peak = hs; peakT = 0; }
    hist[histI] = hs; histI = (histI + 1) % 220;
    $('spd').textContent = hs.toFixed(1);
    $('state').textContent = me.state;
    $('peak').textContent = 'peak ' + peak.toFixed(1);
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) { $('fps').textContent = Math.round(fpsN / fpsT) + ' fps · ' + (CAP.last || 0).toFixed(1) + ' ms · ' + Math.round(PR.cur * 100) + '%'; fpsN = 0; fpsT = 0; drawGraph(); }
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    if (vm.def && vm.def.glass && !vm.hidden) prepareGlass(renderer, performance.now() / 1000);
    vm.render(renderer);
    releaseGlass();
    capCheck(dt, performance.now() - workT0);
  },
};
startLoop(LOOP);

function skyTexture(cols = ['#4f86b8', '#93b6d2', '#d7e1e8']) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, cols[0]); gr.addColorStop(0.5, cols[1]); gr.addColorStop(1, cols[2]);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- debug / automation hooks
// BDN.sim(fn, seconds): runs the mover headless at 120 Hz with fn(t, mover) -> partial command,
// returns a trace. Used to verify the movement numbers.
window.BDN = { sfx, renderer, scene, sun, PR,
  me, input, MOVE, respawn, ws, dummies, WEAPONS, hitscan, debug, proj, vm, camera,
  get loadout() { return loadout; },
  get match() { return match; }, get net() { return net; }, fcam, progress, renderLevel, get bots() { return bots; }, player, startMatch, get nav() { return nav; }, killcam, settings, loadMap, get map() { return map; }, world,
  set god(v) { godMode = v; }, botCtx,
  // headless: run the full game step for `sec` seconds of game time
  run(sec) { for (let i = 0; i < sec * 120; i++) LOOP.step(1 / 120); },
  // GPU-synced cost of one full frame (world + viewmodel), in ms
  bench(n = 30) {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); vm.render(renderer); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return { msPerFrame: +((performance.now() - t0) / n).toFixed(2), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  },
  // Headless time-to-kill: stand at `dist` m from a dummy, aim at chest (or head), hold fire.
  // `w` = weapon id (or slot index). Projectiles and burn are simulated too.
  ttk(w, { dist = 10, head = false, ads = true, time = 3 } = {}) {
    const d = dummies[0], dt = 1 / 120;
    if (typeof w === 'string') { const lo = loadout.slice(); lo[SLOTS.indexOf(WEAPONS[w].slot)] = w; ws.setLoadout(lo); w = SLOTS.indexOf(WEAPONS[w].slot); }
    // open lane along the south wall (z = -18.5), clear from x = -19.5 to 19.5
    d.alive = true; d.hp = 100; d.pos.set(10, 0, -18.5); d.home.copy(d.pos); d.move = null; d.burnT = 0; d.knockV = null;
    me.spawn(10 - dist, 0, -18.5); me.onGround = true;
    ws.switchTo(w); ws.cur = w; ws.setState('ready'); ws.slot.mag = ws.def.mag; ws.slot.reserve = 99; ws.adsT = ads && ws.isGun ? 1 : 0; ws.cd = 0; ws.recoilAccum = 0; ws.shots = 0; ws.bloom = 0; ws.spinT = ws.def.spinUp || 0;
    input.yaw = -Math.PI / 2;
    input.pitch = Math.atan2((head ? 1.72 : 1.15) - fcam.eye, dist);
    const pitch0 = input.pitch;
    const fired = [];
    let t = 0, prevMag = ws.slot.mag, deadAt = null, swings = 0;
    for (; t < time && deadAt === null; t += dt) {
      if (ws.def.kind === 'melee') input.pitch = pitch0;
      const cmd = { ...IDLE_CMD, fireHeld: true, firePressed: ws.def.kind === 'semi' || ws.def.kind === 'pump' || ws.def.kind === 'burst' || ws.def.kind === 'proj', adsHeld: ads && ws.isGun, yaw: input.yaw };
      const st = ws.state;
      ws.tick(dt, cmd, me, input);
      if (ws.state === 'swing' && st !== 'swing') { swings++; fired.push(+t.toFixed(3)); }
      if (ws.isGun && ws.slot.mag < prevMag) { fired.push(+t.toFixed(3)); prevMag = ws.slot.mag; }
      if (ws.isGun) prevMag = ws.slot.mag;
      proj.update(dt);
      d.update(dt, me.pos, (dm, n) => dealDamage(dm, n, false, chest(dm), true));
      if (!d.alive) deadAt = +t.toFixed(3);
    }
    const r = { weapon: ws.def.name, killed: deadAt !== null, ttk: deadAt, shots: fired.length, hpLeft: Math.round(d.hp) };
    ws.setLoadout(loadout);
    return r;
  },
  sim(fn, seconds, opts = {}) {
    const dt = 1 / 120, out = [];
    let prev = {};
    for (let i = 0, t = 0; t < seconds; i++, t = i * dt) {
      const c = { fwd: 0, side: 0, jumpHeld: false, crouchHeld: false, yaw: input.yaw, ads: false, ...fn(t, me) };
      c.jumpPressed = c.jumpHeld && !prev.jumpHeld;
      c.crouchPressed = c.crouchHeld && !prev.crouchHeld;
      prev = c;
      me.step(dt, c);
      if (opts.every === undefined || i % opts.every === 0) out.push({ t: +t.toFixed(3), hs: +me.hSpeed.toFixed(2), y: +me.pos.y.toFixed(2), x: +me.pos.x.toFixed(2), st: me.state, ev: me.events.map((e) => e.type).join(',') });
    }
    return out;
  },
};
