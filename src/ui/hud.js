import * as THREE from 'three';

// Combat HUD: dynamic crosshair (gap = real spread), hitmarker, kill X, damage numbers,
// ammo + weapon slots. Sticker-style panels from the art direction.
export class Hud {
  constructor(root) {
    this.root = root;
    root.insertAdjacentHTML('afterbegin', `<div id="scopeOv"><i></i></div><div id="flashOv"></div>`);
    root.insertAdjacentHTML('beforeend', `
      <div id="hm"><i></i><i></i><i></i><i></i></div>
      <div id="killx"><i></i><i></i></div>
      <div id="dmgs"></div>
      <div id="ammoBox" class="sticker"><div id="wname"></div><div id="ammo"><b id="mag">30</b><span id="res">/ 120</span></div><div id="rbar"><i></i></div><div id="abil"><span class="n"></span><span class="cd"></span></div></div>
      <div id="slots"></div>
      <div id="toast"></div>
      <div id="hp" class="panel"><div class="hpn"><b>100</b><small>HP</small></div><div class="hpbar"><i></i><u></u></div></div>
      <div id="feed"></div>
      <div id="roundBar"></div>
      <div id="bigMsg"><b></b><small></small></div>
      <div id="hurtRing"></div>
      <div id="vignette"></div>
      <div id="kcLabel"></div>`);
    this.bigT = 0; this.hurtT = 0; this.lastHp = 100; this.roundKey = '';
    this.xh = root.querySelector('#xh');
    this.hm = root.querySelector('#hm');
    this.killx = root.querySelector('#killx');
    this.dmgs = root.querySelector('#dmgs');
    this.nums = [];
    this.hmT = 0; this.killT = 0; this.toastT = 0;
    this.slotKey = '';
    this.v = new THREE.Vector3();
  }

  hit(head, kill) {
    this.hm.className = kill ? 'kill' : head ? 'head' : '';
    this.hm.style.opacity = 1; this.hm.style.transform = 'scale(1.25)';
    this.hmT = 0.16;
    if (kill) { this.killx.style.opacity = 1; this.killx.style.transform = 'translate(-50%,-50%) scale(1.25)'; this.killT = 0.5; }
  }

  number(worldPos, n, head) {
    const el = document.createElement('div');
    el.className = 'dn' + (head ? ' h' : '');
    el.textContent = Math.round(n);
    this.dmgs.appendChild(el);
    this.nums.push({ el, p: worldPos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 });
  }

  // full white-out that holds, then fades (k = 0..1 strength)
  flash(k, dur) { this.flashK = Math.max(this.flashK || 0, k); this.flashT = Math.max(this.flashT || 0, dur); this.flashDur = this.flashT; }

  // ---- match HUD
  health(hp, max, alive) {
    const r = this.root.querySelector('#hp');
    r.style.opacity = alive ? 1 : 0.35;
    this.maxHpV = max;
    r.querySelector('b').textContent = Math.ceil(hp);
    r.querySelector('i').style.width = (hp / max) * 100 + '%';
    r.classList.toggle("low", hp <= max * 0.3);
    if (hp < this.lastHp) { r.querySelector('u').style.width = (this.lastHp / max) * 100 + '%'; this.trailT = 0.6; }
    this.lastHp = hp;
    const v = this.root.querySelector('#vignette');
    v.style.opacity = alive ? Math.max(0, (max * 0.4 - hp) / (max * 0.4)) * 0.8 : 0;
  }

  // red arc on the ring pointing toward whoever hit you
  hurt(from, me, yaw) {
    const a = Math.atan2(-(from.x - me.x), -(from.z - me.z)) - yaw; // 0 = in front
    const el = this.root.querySelector('#hurtRing');
    el.style.setProperty('--a', (-a) + 'rad');
    el.style.opacity = 1; this.hurtT = 0.9;
  }

  feed(killer, victim, weapon, head) {
    const f = this.root.querySelector('#feed');
    const nm = (a) => !a ? '' : `<span class="${a.isPlayer ? 'me' : a.team === 0 ? 'ally' : 'enemy'}">${a.name}</span>`;
    const d = document.createElement('div');
    d.className = 'fi' + (killer && killer.isPlayer ? ' mine' : '') + (victim.isPlayer ? ' dead' : '');
    d.innerHTML = killer ? `${nm(killer)}<em>${weapon ? weapon.name : ''}${head ? ' · HEAD' : ''}</em>${nm(victim)}` : `${nm(victim)}<em>fell</em>`;
    f.prepend(d);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }
  feedClear() { this.root.querySelector('#feed').innerHTML = ''; }

  big(text, sub) {
    const b = this.root.querySelector('#bigMsg');
    b.querySelector('b').textContent = text; b.querySelector('small').textContent = sub || '';
    b.style.opacity = 1; b.style.transform = 'translate(-50%,-50%) scale(1.06)';
    this.bigT = 1.1;
  }

  killcam(killer, weapon) {
    const el = this.root.querySelector('#kcLabel');
    if (!killer) { if (el.dataset.mode === 'kc') { el.style.opacity = 0; el.dataset.mode = ''; } return; }
    el.dataset.mode = 'kc';
    el.innerHTML = `<small>KILLCAM</small><b>Eliminated by <span class="enemy">${killer.name}</span></b><small>${weapon ? weapon.name : ''} · ${Math.max(0, Math.ceil(killer.hp))} HP left</small>`;
    el.style.opacity = 1;
  }
  spectate(name) {
    const el = this.root.querySelector('#kcLabel');
    if (el.dataset.mode === 'kc') return;
    if (!name) { if (el.dataset.mode === 'sp') { el.style.opacity = 0; el.dataset.mode = ''; } return; }
    el.dataset.mode = 'sp';
    el.innerHTML = `<small>SPECTATING</small><b>${name}</b>`;
    el.style.opacity = 1;
  }

  // team score + pips for who's alive (or FFA leader)
  round(match, player) {
    const el = this.root.querySelector('#roundBar');
    if (!match) { if (this.roundKey) { el.innerHTML = ''; this.roundKey = ''; } return; }
    let html;
    if (match.mode.ffa) {
      const top = [...match.actors].sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
      html = `<div class="ffa"><span>${match.mode.name}</span><b>${player.kills || 0}</b><small>/ ${match.mode.goal} · leader ${top.name} ${top.kills || 0}</small></div>`;
    } else {
      const pips = (t) => match.actors.filter((a) => a.team === t).map((a) => `<i class="${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''}"></i>`).join('');
      html = `<div class="tm ally">${pips(0)}</div><div class="sc"><b class="ally">${match.score[0]}</b><small>ROUND ${match.round} · FIRST TO ${match.mode.goal}</small><b class="enemy">${match.score[1]}</b></div><div class="tm enemy">${pips(1)}</div>`;
    }
    if (html !== this.roundKey) { el.innerHTML = html; this.roundKey = html; }
  }

  toast(text) { const t = this.root.querySelector('#toast'); t.textContent = text; t.style.opacity = 1; this.toastT = 1.4; }

  update(dt, ws, camera) {
    // crosshair: arms sit at the actual spread radius in pixels
    const d = ws.def;
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const px = (Math.tan(THREE.MathUtils.degToRad(ws.spread)) / Math.tan(vf)) * (innerHeight / 2);
    // bloom is shown, but compressed: the crosshair grows at most a little past its resting size
    const style = this.xhStyle || 'cross';
    const gap = style === 'static' ? 5 : Math.max(4, Math.min(22, 4 + px * 0.45));
    this.xh.style.setProperty('--gap', gap + 'px');
    const isGun = ws.isGun;
    this.xh.style.opacity = (isGun && ws.adsT > 0.5) || ws.state === 'inspect' ? 0 : 1;
    if (!isGun) this.xh.style.setProperty('--gap', '4px');
    this.root.querySelector('#scopeOv').style.opacity = d.scope && ws.adsT > 0.85 ? 1 : 0;
    const fo = this.root.querySelector('#flashOv');
    if (this.flashT > 0) {
      this.flashT -= dt;
      const r = this.flashT / this.flashDur; // hold full white for the first 60%, then fade
      fo.style.opacity = this.flashK * (r > 0.4 ? 1 : r / 0.4);
      if (this.flashT <= 0) { this.flashK = 0; fo.style.opacity = 0; }
    }

    if (this.hmT > 0) { this.hmT -= dt; this.hm.style.transform = 'scale(1)'; if (this.hmT <= 0) this.hm.style.opacity = 0; }
    if (this.killT > 0) { this.killT -= dt; this.killx.style.transform = 'translate(-50%,-50%) scale(1)'; if (this.killT <= 0) this.killx.style.opacity = 0; }
    if (this.bigT > 0) { this.bigT -= dt; const b = this.root.querySelector('#bigMsg'); b.style.transform = 'translate(-50%,-50%) scale(1)'; if (this.bigT <= 0) b.style.opacity = 0; }
    if (this.hurtT > 0) { this.hurtT -= dt; if (this.hurtT <= 0) this.root.querySelector('#hurtRing').style.opacity = 0; }
    if (this.trailT > 0) { this.trailT -= dt; if (this.trailT <= 0) this.root.querySelector('#hp u').style.width = (this.lastHp / (this.maxHpV || 150)) * 100 + '%'; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.root.querySelector('#toast').style.opacity = 0; }

    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt;
      const v = this.v.copy(n.p).project(camera);
      if (v.z > 1 || n.t > 0.8) { n.el.remove(); this.nums.splice(i, 1); continue; }
      const k = n.t / 0.8;
      n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth + n.dx * k}px, ${(-v.y * 0.5 + 0.5) * innerHeight - 40 * k}px) translate(-50%,-50%) scale(${k < 0.12 ? 1.4 - k * 3 : 1})`;
      n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }

    // ammo
    const s = ws.slot;
    this.root.querySelector('#wname').textContent = d.name.toUpperCase();
    const magEl = this.root.querySelector('#mag'), resEl = this.root.querySelector('#res');
    const rb = this.root.querySelector('#rbar');
    if (isGun) {
      magEl.textContent = s.mag;
      magEl.className = s.mag === 0 ? 'empty' : s.mag <= d.mag * 0.25 ? 'low' : '';
      resEl.textContent = '/ ' + s.reserve;
      rb.style.opacity = ws.state === 'reload' ? 1 : 0;
      rb.firstElementChild.style.width = (ws.state === 'reload' ? ws.progress * 100 : 0) + '%';
    } else if (d.kind === 'melee') {
      magEl.textContent = '∞'; magEl.className = ''; resEl.textContent = '';
      rb.style.opacity = 0;
    } else {
      magEl.textContent = '×' + s.charges; magEl.className = s.charges === 0 ? 'empty' : '';
      resEl.textContent = ws.state === 'cook' ? `fuse ${Math.max(0, d.fuse - ws.cookT).toFixed(1)}s` : '';
      rb.style.opacity = s.charges < d.charges ? 1 : 0;
      rb.firstElementChild.style.width = (s.recharge / d.recharge) * 100 + '%';
    }

    // ability (E) readout
    const ab = this.root.querySelector('#abil');
    if (d.ability) {
      ab.style.display = '';
      ab.querySelector('.n').textContent = d.ability.name;
      const cd = s.abilityCd;
      ab.querySelector('.cd').textContent = cd > 0 ? Math.ceil(cd) + 's' : d.ability.passive ? '—' : (this.label ? this.label('ability') : 'E');
      ab.classList.toggle('wait', cd > 0);
    } else ab.style.display = 'none';

    const key = ws.cur + ':' + ws.slots.map((x) => x.def.id + x.charges + (x.gone ? 'x' : '')).join(',');
    if (key !== this.slotKey) {
      this.slotKey = key;
      const T = this.thumbs || {};
      this.root.querySelector('#slots').innerHTML = ws.slots.filter((x) => !x.gone).map((x, vi) => { const i = ws.slots.indexOf(x); return `<div class="slot ${i === ws.cur ? 'on' : ''}"><kbd>${this.padMode ? (x.def.kind === 'melee' ? 'R3' : x.def.kind === 'util' ? 'LB' : 'Y') : vi + 1}</kbd>${T[x.def.id] ? `<img src="${T[x.def.id]}" alt="">` : ''}<span>${x.def.name}</span>${x.def.kind === 'util' ? `<span class="ch">×${x.charges}</span>` : ''}</div>`; }).join('');
    }
  }
}
