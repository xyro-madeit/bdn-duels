import * as THREE from 'three';
import { WEAPONS } from './defs.js';

const D2R = Math.PI / 180;
// global feel knobs: how hard guns climb and how wide shots scatter (tuned for hittable fights)
const RECOIL = 0.5, SPREAD = 0.6, BLOOM = 0.5;
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();

// Owns the 4-slot loadout (primary, secondary, melee, utility): ammo, fire cadence, ADS,
// spread, recoil, reload/equip/inspect, melee swings + specials, utility charges/cooking.
// Ticks at the physics rate and reports actions through hooks; the game resolves them.
export class WeaponSystem {
  constructor(loadout, hooks = {}) {
    this.hooks = hooks;
    this.setLoadout(loadout);
  }

  setLoadout(loadout) {
    this.slots = loadout.map((id) => {
      const d = WEAPONS[id];
      return { def: d, mag: d.mag, reserve: d.reserve, charges: d.charges || 0, recharge: 0, abilityCd: 0 };
    });
    this.cur = 0; this.prevGun = 0;
    this.cd = 0; this.adsT = 0; this.shots = 0; this.sinceShot = 9;
    this.recoilAccum = 0; this.bloom = 0; this.semiBuf = 0; this.spread = 0;
    this.burstLeft = 0; this.spinT = 0; this.swingN = 0;
    this.cookT = 0; this.quick = false; this.magPhase = 0; this.autoReloadT = -1;
    // ability state: timed buffs + one-shot modifiers
    this.buffs = { overclock: 0, steady: 0, noAmmo: 0, dmg: 0, deflect: 0 };
    this.nextSlug = false; this.nextMark = false; this.fanLeft = 0;
    this.setState('equip', this.def.equip);
  }

  get slot() { return this.slots[this.cur]; }
  get def() { return this.slot.def; }
  get progress() { return this.stateDur ? 1 - Math.max(0, this.timer) / this.stateDur : 1; }
  get isGun() { const k = this.def.kind; return k !== 'melee' && k !== 'util'; }
  utilSlot() { return this.slots.findIndex((s) => s.def.kind === 'util'); }

  setState(s, dur = 0) { this.state = s; this.timer = this.stateDur = dur; }

  // first usable slot, preferring the last gun you held
  firstAvail() { const p = this.slots[this.prevGun]; if (p && !p.gone && this.prevGun !== this.cur) return this.prevGun; return this.slots.findIndex((x, i) => !x.gone && i !== this.cur); }

  switchTo(i, fast = false) {
    if (i === this.cur || !this.slots[i] || this.slots[i].gone) return;
    if (this.slots[i].def.kind === 'util' && this.slots[i].charges <= 0) { this.hooks.onDry && this.hooks.onDry(this.slots[i].def); return; }
    if (this.isGun || this.def.kind === 'melee') this.prevGun = this.cur;
    this.cur = i;
    this.shots = 0; this.bloom = 0; this.semiBuf = 0; this.burstLeft = 0; this.spinT = 0; this.cookT = 0;
    this.cd = Math.max(this.cd, 0); this.autoReloadT = -1;
    this.setState('equip', fast ? 0.12 : this.def.equip);
    this.hooks.onEquip && this.hooks.onEquip(this.def);
  }

  get dmgMul() { return this.buffs.dmg > 0 ? 1.2 : 1; }

  tryAbility() {
    const d = this.def, s = this.slot, a = d.ability;
    if (!a || a.passive) return false;
    if (s.abilityCd > 0 || !(this.state === 'ready' || this.state === 'inspect' || (this.isGun && this.state === 'reload'))) {
      this.hooks.onAbilityDenied && this.hooks.onAbilityDenied(d); return false;
    }
    s.abilityCd = a.cd;
    const B = this.buffs;
    switch (a.key) {
      case 'overclock': B.overclock = a.dur; break;
      case 'steady': B.steady = a.dur; break;
      case 'drum': B.noAmmo = a.dur; break;
      case 'deflect': B.deflect = a.dur; break;
      case 'mark': this.nextMark = true; break;
      case 'slug': this.nextSlug = true; break;
      case 'hotmag': { const n = Math.min(d.mag - s.mag, s.reserve); s.mag += n; s.reserve -= n; B.dmg = a.dur; this.setState('ready'); break; }
      case 'fan': this.fanLeft = s.mag; this.setState('ready'); break;
      case 'blastjump': s.mag = Math.max(0, s.mag - 2); this.hooks.onFireFx && this.hooks.onFireFx(d); break;
    }
    if (d.kind === 'melee') {
      const dur = { lunge: 0.22, reaper: 0.32, uppercut: 0.42, whirl: 0.5, slam: 0.45, axethrow: 0.35, deflect: 0.8, homerun: 0.55 }[a.key] || 0.4;
      this.setState('ability', dur);
    }
    this.hooks.onAbility && this.hooks.onAbility({ def: d, a });
    return true;
  }

  startReload() {
    const s = this.slot, d = this.def;
    if (!this.isGun || s.mag >= d.mag || s.reserve <= 0) return false;
    this.setState('reload', d.kind === 'pump' ? d.shellTime : s.mag === 0 ? d.reloadEmpty : d.reload);
    this.magPhase = 0;
    return true;
  }

  tick(dt, c, mover, look) {
    const d0 = this.def;
    this.cd = Math.max(0, this.cd - dt);
    this.sinceShot += dt;
    this.semiBuf = c.firePressed ? 0.12 : Math.max(0, this.semiBuf - dt);
    for (const s of this.slots) s.abilityCd = Math.max(0, s.abilityCd - dt);
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    if (c.abilityPressed) this.tryAbility();

    // utility recharge happens in the background for every utility slot
    for (const s of this.slots) if (s.def.kind === 'util' && !s.gone && s.charges < s.def.charges) {
      s.recharge += dt;
      if (s.recharge >= s.def.recharge) { s.recharge = 0; s.charges++; }
    }

    // switching
    if (c.utilPressed) { const u = this.utilSlot(); if (u >= 0 && u !== this.cur && this.slots[u].charges > 0) { this.quick = true; this.switchTo(u, true); this.semiBuf = 0.3; } }
    if (c.lastPressed && this.slots[this.prevGun] && !this.slots[this.prevGun].gone) { this.quick = false; this.switchTo(this.prevGun); }
    // number keys pick the n-th item you still have (items that ran out are skipped, the rest move up)
    if (c.slot !== null && c.slot !== undefined) { this.quick = false; const vis = this.slots.map((x, i) => i).filter((i) => !this.slots[i].gone); if (vis[c.slot] !== undefined) this.switchTo(vis[c.slot]); }
    else if (c.wheel) {
      this.quick = false; const n = this.slots.length;
      for (let k = 1, i = this.cur; k < n; k++) { i = (i + (c.wheel > 0 ? 1 : n - 1)) % n; if (!this.slots[i].gone) { this.switchTo(i); break; } }
    }
    // out of ammo (or charges): the item leaves your inventory until you respawn
    const cs = this.slot;
    const dry = this.isGun ? cs.mag <= 0 && cs.reserve <= 0 && this.buffs.noAmmo <= 0 && this.state !== 'reload' && this.fanLeft <= 0
      : this.def.kind === 'util' && cs.charges <= 0 && this.state !== 'throw' && this.state !== 'cook';
    if (dry && !cs.gone) {
      cs.gone = true;
      const nxt = this.firstAvail();
      this.hooks.onItemGone && this.hooks.onItemGone(cs.def);
      if (nxt >= 0) this.switchTo(nxt, true);
    }

    const d = this.def;
    // ---- generic states
    if (this.state === 'equip') { this.timer -= dt; if (this.timer <= 0) this.setState('ready'); }
    else if (this.state === 'inspect') { this.timer -= dt; if (this.timer <= 0 || c.firePressed || c.adsHeld) this.setState('ready'); }
    else if (this.state === 'reload') this.tickReload(dt, c);

    if (c.inspectPressed && this.state === 'ready' && this.adsT < 0.05 && this.cookT === 0) { this.setState('inspect', d.inspect && d.inspect.dur ? d.inspect.dur : d.id === 'fists' ? 1.2 : 1.6); this.hooks.onInspect && this.hooks.onInspect(d); }

    // weight: every weapon carries a move speed + jump multiplier (melee = full speed)
    mover.speedMul = d.moveMul ?? 1;
    mover.jumpMul = d.jumpMul ?? 1;
    mover.extraJumps = d.doubleJump ? 1 : 0;

    if (d.kind === 'melee') this.tickMelee(dt, c, mover);
    else if (d.kind === 'util') this.tickUtil(dt, c, mover);
    else this.tickGun(dt, c, mover, look);

    // recoil recovery: pull the aim back down once the spray stops
    const rate = d.rate || 0.2;
    if (this.sinceShot > rate * 1.6 && this.recoilAccum > 0) {
      const r = Math.min(this.recoilAccum, (d.recoil ? d.recoil.recover : 10) * D2R * dt * (1 + this.recoilAccum * 10));
      look.pitch -= r; this.recoilAccum -= r;
    }
    if (this.sinceShot > rate * 2.5 && this.burstLeft === 0) this.shots = 0;
    this.bloom = Math.max(0, this.bloom - dt * (this.sinceShot > rate * 1.5 ? 4 : 0));
    if (d0 !== this.def) this.adsT = 0;
  }

  tickReload(dt, c) {
    const d = this.def, s = this.slot;
    this.timer -= dt;
    const p = this.progress;
    if (d.kind === 'pump') {
      if (this.timer <= 0) {
        s.mag++; s.reserve--; this.hooks.onReloadStep && this.hooks.onReloadStep('shell', d);
        if (s.mag < d.mag && s.reserve > 0 && !c.fireHeld) this.setState('reload', d.shellTime);
        else this.setState('ready');
      } else if (c.firePressed && s.mag > 0) this.setState('ready');
      return;
    }
    if (this.magPhase === 0 && p >= d.magOutAt) { this.magPhase = 1; this.hooks.onReloadStep && this.hooks.onReloadStep('out', d); }
    if (this.magPhase === 1 && p >= d.magInAt) { this.magPhase = 2; this.hooks.onReloadStep && this.hooks.onReloadStep('in', d); }
    if (this.timer <= 0) {
      const n = Math.min(d.mag - s.mag, s.reserve);
      s.mag += n; s.reserve -= n;
      this.setState('ready');
    } else if ((c.firePressed || c.fireHeld) && s.mag > 0 && p < d.magOutAt) this.setState('ready');
  }

  tickGun(dt, c, mover, look) {
    const d = this.def, s = this.slot;
    if (c.reloadPressed && (this.state === 'ready' || this.state === 'inspect')) this.startReload();

    // ADS
    const wantAds = c.adsHeld && this.state === 'ready';
    this.adsT = Math.max(0, Math.min(1, this.adsT + (wantAds ? 1 : -1.4) * dt / d.adsTime));

    // minigun spin-up (fire or aim spins the barrels)
    if (d.kind === 'spin') this.spinT = Math.max(0, Math.min(d.spinUp, this.spinT + ((c.fireHeld || c.adsHeld) && this.state === 'ready' ? dt : -dt * 0.8)));

    // auto-reload for single-shot projectile weapons
    if (this.autoReloadT >= 0) { this.autoReloadT -= dt; if (this.autoReloadT < 0 && this.state === 'ready') this.startReload(); }

    // Fan the Hammer: dump the cylinder fast with extra spread
    if (this.fanLeft > 0 && this.state === 'ready' && this.cd <= 1e-4) {
      if (s.mag > 0) { this.fire(mover, look, { fan: true }); this.cd = 0.075; this.fanLeft--; } else this.fanLeft = 0;
    }

    if (this.state === 'ready' && this.fanLeft === 0) {
      let want = false;
      if (d.kind === 'auto') want = c.fireHeld;
      else if (d.kind === 'spin') want = c.fireHeld && this.spinT >= d.spinUp;
      else if (d.kind === 'burst') { if (this.burstLeft === 0 && this.semiBuf > 0 && this.cd <= 1e-4) this.burstLeft = Math.min(d.burst, s.mag); want = this.burstLeft > 0; }
      else want = this.semiBuf > 0;
      if (want && this.cd <= 1e-4) {
        if (s.mag > 0) this.fire(mover, look);
        else if (c.firePressed) { this.hooks.onDry && this.hooks.onDry(d); this.startReload(); }
      }
    }

    // current spread (degrees)
    const hs = mover.hSpeed;
    let sp = (d.spreadHip + (d.spreadAds - d.spreadHip) * this.adsT) * SPREAD;
    sp += this.bloom * BLOOM * (1 - 0.75 * this.adsT);
    if (this.buffs.steady <= 0) {
      if (hs > 1) sp += d.spreadMove * SPREAD * 0.7 * Math.min(1, hs / 7.4) * (1 - 0.5 * this.adsT);
      if (!mover.onGround) sp += d.spreadAir * SPREAD;
      // first shot after a pause is dead-on when standing still or aiming
      if (this.sinceShot > 0.35 && d.pellets === 1 && (this.adsT > 0.8 || (hs < 1 && mover.onGround))) sp = 0;
    }
    this.spread = sp;
  }

  aimDir(look, spreadDeg) {
    const cp = Math.cos(look.pitch);
    _f.set(-Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp);
    _r.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
    _u.crossVectors(_r, _f);
    const a = spreadDeg * D2R * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    return _f.clone().addScaledVector(_r, Math.tan(a) * Math.cos(th)).addScaledVector(_u, Math.tan(a) * Math.sin(th)).normalize();
  }

  fire(mover, look, opts = {}) {
    const d = this.def, s = this.slot;
    if (this.buffs.noAmmo <= 0 && !this.infinite) s.mag--; // practice range: infinite ammo
    this.shots++;
    this.sinceShot = 0;
    this.semiBuf = 0;
    const rateMul = this.buffs.overclock > 0 ? 1 / 1.35 : 1;
    if (d.kind === 'burst') {
      this.burstLeft--;
      this.cd += (this.burstLeft > 0 && s.mag > 0 ? d.rate : d.burstDelay) * rateMul;
      if (s.mag === 0) this.burstLeft = 0;
    } else this.cd += d.rate * rateMul;

    const mark = this.nextMark && (d.kind !== 'burst' || this.burstLeft === 0);
    const spread = opts.fan ? this.spread + 2.5 : this.spread;
    if (d.kind === 'proj') {
      this.hooks.onProjectile && this.hooks.onProjectile({ def: d, dir: this.aimDir(look, spread) });
      if (d.autoReload && s.mag === 0) this.autoReloadT = 0.12;
    } else if (this.nextSlug) {
      this.nextSlug = false;
      this.hooks.onShot && this.hooks.onShot({ def: d, dirs: [this.aimDir(look, 0)], slug: true, dmgMul: this.dmgMul });
    } else {
      // shotguns: a fixed-size pellet cone; ADS tightens it a little
      const dirs = [];
      for (let i = 0; i < d.pellets; i++) dirs.push(this.aimDir(look, spread));
      this.hooks.onShot && this.hooks.onShot({ def: d, dirs, adsT: this.adsT, mark: this.nextMark, dmgMul: this.dmgMul });
    }
    if (mark) this.nextMark = false;
    if (d.kind === 'pump') this.hooks.onPump && this.hooks.onPump(d);

    // recoil: climbs by pattern, sideways drift grows after the 3rd bullet
    const up = d.recoil.up[Math.min(this.shots - 1, d.recoil.up.length - 1)] * (1 - 0.3 * this.adsT) * RECOIL;
    const side = (Math.random() * 2 - 1) * d.recoil.side * RECOIL * (this.shots > 3 ? 1 : 0.35);
    look.pitch = Math.min(1.55, look.pitch + up * D2R);
    look.yaw += side * D2R;
    this.recoilAccum += up * D2R;
    this.bloom = Math.min(d.bloomMax, this.bloom + d.bloomPer);
  }

  tickMelee(dt, c, mover) {
    const d = this.def;
    this.adsT = 0; this.spread = 0;
    if (this.state === 'swing' || this.state === 'ability') {
      const before = this.progress;
      this.timer -= dt;
      const p = this.progress;
      if (this.state === 'swing' && before < d.hitAt && p >= d.hitAt) this.hooks.onMelee && this.hooks.onMelee({ def: d, n: this.swingN });
      if (this.state === 'ability' && before < 0.5 && p >= 0.5) this.hooks.onAbilityHit && this.hooks.onAbilityHit({ def: d, a: d.ability });
      if (this.timer <= 0) {
        if (this.state === 'ability' && d.ability.key === 'lunge') { this.swingN++; this.setState('swing', d.swing * 0.7); this.hooks.onMelee && this.hooks.onMelee({ def: d, n: this.swingN, dmg: d.ability.dmg, reach: 0.8 }); }
        else this.setState('ready');
      }
      return;
    }
    if (this.state !== 'ready') return;
    if ((c.fireHeld || this.semiBuf > 0) && this.cd <= 1e-4) {
      this.swingN++;
      this.semiBuf = 0;
      this.cd = d.swing;
      this.setState('swing', d.swing);
      this.hooks.onSwing && this.hooks.onSwing(d);
    }
  }

  tickUtil(dt, c, mover) {
    const d = this.def, s = this.slot;
    this.adsT = 0; this.spread = 0;
    if (this.state === 'cook') {
      this.cookT += dt;
      if (!c.fireHeld || this.cookT >= d.fuse) this.release(d.fuse - this.cookT);
      return;
    }
    if (this.state === 'throw') {
      const before = this.progress;
      this.timer -= dt;
      if (before < 0.35 && this.progress >= 0.35) {
        if (!this.infinite) s.charges--;
        if (d.instant) this.hooks.onDash && this.hooks.onDash({ def: d });
        else this.hooks.onThrow && this.hooks.onThrow({ def: d, fuseLeft: this.fuseLeft });
      }
      if (this.timer <= 0) {
        this.cookT = 0;
        this.setState('ready');
        if (s.charges <= 0) { s.gone = true; this.hooks.onItemGone && this.hooks.onItemGone(d); }
        if (s.charges <= 0 || this.quick) { this.quick = false; this.switchTo(this.firstAvail(), true); }
      }
      return;
    }
    if (this.state !== 'ready' || s.charges <= 0) return;
    if (this.semiBuf > 0 || (this.quick && this.state === 'ready')) {
      this.semiBuf = 0;
      if (d.id === 'frag') { this.cookT = 0; this.setState('cook'); this.hooks.onPin && this.hooks.onPin(d); }
      else this.release(d.fuse || 0);
    }
  }

  release(fuseLeft) {
    this.fuseLeft = Math.max(0, fuseLeft);
    this.setState('throw', this.def.instant ? 0.18 : 0.34);
  }
}
