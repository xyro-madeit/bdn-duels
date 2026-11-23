// Keyboard + raw mouse + game controller input. Look angles update on every mousemove (no smoothing)
// so aim never waits for the physics tick; everything else is sampled per tick via command().
// Controller buttons become virtual codes (GP_A, GP_RT, ...) in the same down/pressed sets as keys,
// so every action, rebind and save works the same for both devices. `device` says which one the
// player is using right now ('kbm' | 'pad').
export const DEFAULT_BINDS = {
  forward: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  jump: ['Space'], crouch: ['KeyC', 'ShiftLeft'],
  fire: ['Mouse0'], ads: ['Mouse2'], reload: ['KeyR'], inspect: ['KeyF'],
  util: ['KeyQ'], ability: ['KeyE'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'],
  nextWeapon: [], prevWeapon: [], lastWeapon: ['KeyX'],
  respawn: ['KeyP'],
};
// Controller binds (Xbox-style names; the layout below maps your pad's physical buttons onto them)
export const DEFAULT_PAD_BINDS = {
  forward: [], back: [], left: [], right: [], // left stick
  jump: ['GP_A'], crouch: ['GP_B'], fire: ['GP_RT'], ads: ['GP_LT'], reload: ['GP_X'], inspect: ['GP_UP'],
  util: ['GP_LB'], ability: ['GP_RB'], slot1: [], slot2: [], slot3: ['GP_R3'], slot4: ['GP_DOWN'],
  nextWeapon: ['GP_Y', 'GP_RIGHT'], prevWeapon: ['GP_LEFT'], lastWeapon: ['GP_L3'], respawn: ['GP_SELECT'],
};
export const PAD_NAMES = { GP_A: 'A', GP_B: 'B', GP_X: 'X', GP_Y: 'Y', GP_LB: 'LB', GP_RB: 'RB', GP_LT: 'LT', GP_RT: 'RT', GP_SELECT: 'Select', GP_START: 'Start',
  GP_HOME: 'Mode', GP_L3: 'L3', GP_R3: 'R3', GP_UP: 'D-pad ↑', GP_DOWN: 'D-pad ↓', GP_LEFT: 'D-pad ←', GP_RIGHT: 'D-pad →' };
// Physical button index -> logical button, per controller layout.
// 'standard' = browsers' standard mapping. 'raw' = generic HID pads like yours (from Pad Bench:
// A=1 B=2 X=3 Y=5 L1=7 R1=8 L2=9 R2=10 Select=11 Start=12 Mode=13 L3=14 R3=15, 1-based labels).
export const PAD_LAYOUTS = {
  standard: { 0: 'GP_A', 1: 'GP_B', 2: 'GP_X', 3: 'GP_Y', 4: 'GP_LB', 5: 'GP_RB', 6: 'GP_LT', 7: 'GP_RT', 8: 'GP_SELECT', 9: 'GP_START', 10: 'GP_L3', 11: 'GP_R3', 12: 'GP_UP', 13: 'GP_DOWN', 14: 'GP_LEFT', 15: 'GP_RIGHT', 16: 'GP_HOME' },
  raw: { 0: 'GP_A', 1: 'GP_B', 2: 'GP_X', 4: 'GP_Y', 6: 'GP_LB', 7: 'GP_RB', 8: 'GP_LT', 9: 'GP_RT', 10: 'GP_SELECT', 11: 'GP_START', 12: 'GP_HOME', 13: 'GP_L3', 14: 'GP_R3' },
};
const PADMAP_KEY = 'bdn_duels_padmap';
export const PADCFG = { custom: null, rightAxes: 'auto' }; // custom: { index: GP_* } learned in the setup
try { Object.assign(PADCFG, JSON.parse(localStorage.getItem(PADMAP_KEY) || '{}')); } catch (e) {}
export function savePadCfg() { try { localStorage.setItem(PADMAP_KEY, JSON.stringify(PADCFG)); } catch (e) {} }
// What each action is called in the Keybinds menu (in order).
export const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', jump: 'Jump', crouch: 'Crouch / slide',
  fire: 'Fire / swing / throw', ads: 'Aim down sights', reload: 'Reload', inspect: 'Inspect', ability: 'Weapon ability', util: 'Quick-throw utility',
  slot1: 'Primary', slot2: 'Secondary', slot3: 'Melee', slot4: 'Utility', nextWeapon: 'Next weapon', prevWeapon: 'Previous weapon', lastWeapon: 'Last weapon',
  respawn: 'Respawn (range)',
};
const BIND_KEY = 'bdn_duels_binds';
export const BINDS = JSON.parse(JSON.stringify(DEFAULT_BINDS));
export const PAD_BINDS = JSON.parse(JSON.stringify(DEFAULT_PAD_BINDS));
try { const saved = JSON.parse(localStorage.getItem(BIND_KEY) || '{}'); for (const k in saved) if (BINDS[k]) BINDS[k] = saved[k]; } catch (e) {}
try { const saved = JSON.parse(localStorage.getItem(BIND_KEY + '_pad') || '{}'); for (const k in saved) if (PAD_BINDS[k]) PAD_BINDS[k] = saved[k]; } catch (e) {}
export function saveBinds() { try { localStorage.setItem(BIND_KEY, JSON.stringify(BINDS)); localStorage.setItem(BIND_KEY + '_pad', JSON.stringify(PAD_BINDS)); } catch (e) {} }
export function resetBinds() { for (const k in DEFAULT_BINDS) BINDS[k] = [...DEFAULT_BINDS[k]]; for (const k in DEFAULT_PAD_BINDS) PAD_BINDS[k] = [...DEFAULT_PAD_BINDS[k]]; saveBinds(); }
export function setPadBind(action, code) {
  for (const k in PAD_BINDS) PAD_BINDS[k] = PAD_BINDS[k].filter((c) => c !== code);
  PAD_BINDS[action] = code ? [code] : [];
  saveBinds();
}
const codesFor = (action) => [...(BINDS[action] || []), ...(PAD_BINDS[action] || [])];
// Put `code` on action[index]; the key is taken off any other action so one key never does two things.
export function setBind(action, index, code) {
  for (const k in BINDS) BINDS[k] = BINDS[k].filter((c) => c !== code);
  const list = BINDS[action];
  if (code) list[index] = code; else list.splice(index, 1);
  BINDS[action] = list.filter(Boolean);
  saveBinds();
}
export function keyName(code) {
  if (!code) return '—';
  if (PAD_NAMES[code]) return PAD_NAMES[code];
  const M = { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', WheelUp: 'Wheel up', WheelDown: 'Wheel down' };
  if (M[code]) return M[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Arrow')) return { Up: '↑', Down: '↓', Left: '←', Right: '→' }[code.slice(5)] || code;
  return code;
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set(); // edge-triggered, cleared when consumed by a tick
    this.yaw = 0;
    this.pitch = 0;
    this.sens = 1; // multiplier on 0.0022 rad per mouse count
    this.adsSensMul = 1; // set by the weapon system while aiming
    this.lookDX = 0; this.lookDY = 0; // raw deltas since last render (for weapon sway)
    this.wheel = 0;
    this.locked = false;
    this.onLockChange = null;
    // controller state
    this.device = 'kbm';
    this.onDevice = null;
    this.padPlaying = false;  // playing with a controller (no mouse lock needed)
    this.padIndex = -1; this.padPrev = {}; this.padNow = {};
    this.lsX = 0; this.lsY = 0; this.rsX = 0; this.rsY = 0;
    this.padSens = 1; this.invertY = false; this.assistMul = 1; this.lookHold = 0;
    this.padLookMag = 0;

    const press = (code) => { this.pressed.add(code); this.down.add(code); };
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      this.setDevice('kbm');
      if (e.code === 'Escape' && this.padPlaying) { this.setPadPlaying(false); return; }
      if (!this.locked) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('mousedown', (e) => { if (this.locked) press('Mouse' + e.button); });
    addEventListener('mouseup', (e) => this.down.delete('Mouse' + e.button));
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => {
      if (!this.locked) return;
      const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
      // wheel binds to actions like a key press; unbound wheel still cycles weapons
      if (Object.values(BINDS).some((l) => l.includes(code))) this.pressed.add(code); else this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    addEventListener('mousemove', (e) => {
      // a deliberate mouse move (not a bumped desk) switches back to mouse + keyboard
      if (this.device === 'pad') { this.mouseAcc = (this.mouseAcc || 0) + Math.abs(e.movementX) + Math.abs(e.movementY); clearTimeout(this.mouseT); this.mouseT = setTimeout(() => (this.mouseAcc = 0), 250); if (this.mouseAcc > 60) { this.mouseAcc = 0; this.setDevice('kbm'); } }
      if (!this.locked) return;
      const k = 0.0022 * this.sens * this.adsSensMul;
      this.yaw -= e.movementX * k;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * k));
      this.lookDX += e.movementX; this.lookDY += e.movementY;
    });
    addEventListener('blur', () => this.down.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.down.clear();
      this.onLockChange && this.onLockChange(this.locked);
    });
  }

  get active() { return this.locked || this.padPlaying; }
  setDevice(d) { if (this.device === d) return; this.device = d; this.onDevice && this.onDevice(d); }
  setPadPlaying(on) {
    if (this.padPlaying === on) return;
    this.padPlaying = on; this.down.clear(); this.pressed.clear();
    this.onLockChange && this.onLockChange(this.active);
  }
  label(action) { const list = this.device === 'pad' ? PAD_BINDS[action] : BINDS[action]; return keyName(list && list[0]); }

  // ---- controller: call once per rendered frame
  pollPad(dt) {
    let pads = [];
    try { pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return; }
    if (!pads.length) { this.padIndex = -1; return; }
    // the pad you touched last wins
    let pad = pads.find((p) => p.index === this.padIndex) || pads[0];
    for (const p of pads) if (p !== pad && p.buttons.some((b) => b.pressed)) pad = p;
    this.padIndex = pad.index; this.pad = pad;
    const layout = PADCFG.custom || PAD_LAYOUTS[pad.mapping === 'standard' ? 'standard' : 'raw'];
    const now = {};
    pad.buttons.forEach((b, i) => { const c = layout[i]; if (c && (b.pressed || b.value > 0.5)) now[c] = true; });
    // raw pads report the d-pad as a hat axis (usually 9): -1 up, then clockwise in 1/7 steps
    if (pad.mapping !== 'standard' && pad.axes.length >= 10) {
      const v = pad.axes[9];
      if (v >= -1.05 && v <= 1.05) {
        const d = Math.round((v + 1) * 3.5);
        if (d === 7 || d === 0 || d === 1) now.GP_UP = true;
        if (d >= 1 && d <= 3) now.GP_RIGHT = true;
        if (d >= 3 && d <= 5) now.GP_DOWN = true;
        if (d >= 5 && d <= 7) now.GP_LEFT = true;
      }
    }
    // sticks (radial dead zone)
    const dz = (x, y, z = 0.14) => { const m = Math.hypot(x, y); if (m < z) return [0, 0]; const k = Math.min(1, (m - z) / (1 - z)) / m; return [x * k, y * k]; };
    const a = pad.axes;
    const raw = pad.mapping !== 'standard';
    const rAx = PADCFG.rightAxes !== 'auto' ? PADCFG.rightAxes : raw && a.length >= 6 ? '2/5' : '2/3';
    const [rx, ry] = rAx === '2/5' ? [a[2] || 0, a[5] || 0] : [a[2] || 0, a[3] || 0];
    [this.lsX, this.lsY] = dz(a[0] || 0, a[1] || 0);
    [this.rsX, this.rsY] = dz(rx, ry, 0.12);
    // device detection: any real controller input switches the prompts to controller
    if (Object.keys(now).length || Math.hypot(this.lsX, this.lsY) > 0.3 || Math.hypot(this.rsX, this.rsY) > 0.3) this.setDevice('pad');
    // edges -> the same pressed/down sets keys use
    for (const c in now) if (!this.padPrev[c]) { this.padPressedUI = this.padPressedUI || new Set(); this.padPressedUI.add(c); if (this.active) this.pressed.add(c); }
    for (const c in this.padPrev) if (!now[c]) this.down.delete(c);
    if (this.active) for (const c in now) this.down.add(c);
    this.padPrev = now;
    // look: response curve + turn acceleration when the stick is held at the edge
    if (this.active) {
      const m = Math.hypot(this.rsX, this.rsY);
      this.lookHold = m > 0.92 ? this.lookHold + dt : 0;
      const boost = 1 + Math.min(1, Math.max(0, this.lookHold - 0.22) / 0.35) * 0.7;
      const curve = m > 0 ? Math.pow(m, 1.7) / m : 0;
      const rate = 3.4 * this.padSens * this.adsSensMul * this.assistMul * boost; // rad/s at full tilt
      const dx = this.rsX * curve * rate * dt, dy = this.rsY * curve * rate * dt * (this.invertY ? -1 : 1);
      this.yaw -= dx; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy));
      this.lookDX += dx / 0.0022; this.lookDY += dy / 0.0022;
      this.padLookMag = m;
    } else this.padLookMag = 0;
  }
  // menus: buttons pressed since last call (consumed)
  takePadUI() { const s = this.padPressedUI || new Set(); this.padPressedUI = new Set(); return s; }
  rumble(strong = 0.5, weak = 0.3, ms = 80) {
    if (this.device !== 'pad' || !this.pad) return;
    const va = this.pad.vibrationActuator;
    try { va && va.playEffect && va.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) {}
  }

  lock() {
    if (this.device === 'pad') { this.setPadPlaying(true); return; }
    // Raw (unaccelerated) mouse where supported; fall back to the normal lock.
    const fallback = () => { try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) r.catch(fallback);
    } catch (e) { fallback(); }
  }

  held(action) { return codesFor(action).some((c) => this.down.has(c)); }
  consume(action) {
    let hit = false;
    for (const c of codesFor(action)) if (this.pressed.delete(c)) hit = true;
    return hit;
  }
  takeLook() { const d = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return d; }

  // One command per physics tick.
  command() {
    let slot = null;
    for (let i = 1; i <= 4; i++) if (this.consume('slot' + i)) slot = i - 1;
    let wheel = this.wheel; this.wheel = 0;
    if (this.consume('nextWeapon')) wheel = 1;
    if (this.consume('prevWeapon')) wheel = -1;
    const last = this.consume('lastWeapon');
    return {
      fwd: (this.held('forward') ? 1 : 0) - (this.held('back') ? 1 : 0) - (this.device === 'pad' ? this.lsY : 0),
      side: (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0) + (this.device === 'pad' ? this.lsX : 0),
      jumpHeld: this.held('jump'),
      jumpPressed: this.consume('jump'),
      crouchHeld: this.held('crouch'),
      crouchPressed: this.consume('crouch'),
      fireHeld: this.held('fire'),
      firePressed: this.consume('fire'),
      adsHeld: this.held('ads'),
      reloadPressed: this.consume('reload'),
      inspectPressed: this.consume('inspect'),
      utilPressed: this.consume('util'),
      abilityPressed: this.consume('ability'),
      slot, wheel, lastPressed: last,
      yaw: this.yaw,
      ads: false,
    };
  }
}

export const IDLE_CMD = { fwd: 0, side: 0, jumpHeld: false, jumpPressed: false, crouchHeld: false, crouchPressed: false, fireHeld: false, firePressed: false, adsHeld: false, reloadPressed: false, inspectPressed: false, utilPressed: false, abilityPressed: false, slot: null, wheel: 0, lastPressed: false, ads: false };
