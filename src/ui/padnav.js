// Controller navigation for every menu: the d-pad / left stick moves a focus ring between the
// visible buttons (picks the nearest one in that direction), A presses, B goes back, LB/RB switch
// lobby tabs, Start plays or resumes. Sliders move with left/right; checkboxes toggle with A.
const SEL = 'button:not([disabled]), input[type=range], input[type=checkbox], input[type=text], input:not([type])';

export class PadNav {
  constructor(input, hooks) { this.input = input; this.hooks = hooks; this.cur = null; this.rep = 0; this.dirPrev = null; }

  roots() {
    const vis = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; // overlays are position:fixed (no offsetParent)
    for (const id of ['online', 'results']) { const el = document.getElementById(id); if (vis(el)) return [el]; }
    const start = document.getElementById('start');
    return vis(start) ? [start] : [];
  }
  items() {
    const out = [];
    for (const r of this.roots()) for (const el of r.querySelectorAll(SEL)) {
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2 || el.closest('.hidden') || getComputedStyle(el).visibility === 'hidden') continue;
      if (b.bottom < 0 || b.top > innerHeight * 2.5) continue;
      out.push(el);
    }
    return out;
  }
  focus(el) {
    if (this.cur) this.cur.classList.remove('padfocus');
    this.cur = el;
    if (!el) return;
    el.classList.add('padfocus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.dispatchEvent(new MouseEvent('mouseenter')); // loadout cards preview on hover
    this.hooks.ui && this.hooks.ui();
  }
  move(dx, dy) {
    const list = this.items();
    if (!list.length) return;
    if (!this.cur || !list.includes(this.cur)) { this.focus(list.find((e) => e.id === 'play' || e.id === 'resume' && !e.classList.contains('hidden')) || list[0]); return; }
    const a = this.cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === this.cur) continue;
      const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const vx = bx - ax, vy = by - ay, along = vx * dx + vy * dy;
      const across = Math.abs(vx * dy - vy * dx);
      if (along <= 4 || across > along * 1.8) continue; // only things roughly in that direction
      const sc = along + across * 2.2;
      if (sc < bs) { bs = sc; best = el; }
    }
    if (best) this.focus(best);
  }

  // call every frame while the menus are up
  frame(dt) {
    const I = this.input;
    if (I.device !== 'pad') { if (this.cur) { this.cur.classList.remove('padfocus'); this.cur = null; } I.takePadUI(); return; }
    const ui = I.takePadUI();
    // direction from d-pad or left stick, with auto-repeat
    const down = I.padPrev || {};
    let dx = (down.GP_RIGHT ? 1 : 0) - (down.GP_LEFT ? 1 : 0), dy = (down.GP_DOWN ? 1 : 0) - (down.GP_UP ? 1 : 0);
    if (!dx && !dy) { if (Math.abs(I.lsX) > 0.55) dx = Math.sign(I.lsX); else if (Math.abs(I.lsY) > 0.55) dy = Math.sign(I.lsY); }
    const key = dx + ',' + dy;
    if (dx || dy) {
      if (key !== this.dirPrev) { this.rep = 0.38; this.step(dx, dy); } else if ((this.rep -= dt) <= 0) { this.rep = 0.12; this.step(dx, dy); }
    }
    this.dirPrev = dx || dy ? key : null;
    const fresh = !this.cur;
    if (!this.cur && this.items().length) this.move(0, 0);
    if (ui.has('GP_A') && this.cur && !fresh) this.press(this.cur); // the first press only shows the focus ring
    if (ui.has('GP_B')) this.hooks.back && this.hooks.back();
    if (ui.has('GP_LB')) this.hooks.tab && this.hooks.tab(-1);
    if (ui.has('GP_RB')) this.hooks.tab && this.hooks.tab(1);
    if (ui.has('GP_START')) this.hooks.start && this.hooks.start();
  }
  step(dx, dy) {
    const el = this.cur;
    if (el && el.type === 'range' && dx) { // sliders: left/right adjusts the value
      const st = +el.step || 0.1; el.value = Math.min(+el.max, Math.max(+el.min, +el.value + dx * st)); el.dispatchEvent(new Event('input')); return;
    }
    this.move(dx, dy);
  }
  press(el) {
    if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change')); return; }
    if (el.tagName === 'INPUT') { el.focus(); return; }
    el.click();
    setTimeout(() => { if (this.cur && !this.cur.isConnected) { this.cur = null; this.move(0, 0); } }, 30); // menu re-rendered
  }
}
