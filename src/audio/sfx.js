// Game sounds, all samples in public/sfx:
//  - UI/feedback cues: CC0 uisfx sounds, picked with earshot.
//  - Combat/movement: built by tools/build_sfx.py from earshot's sound bank plus a gunshot model whose
//    settings earshot tuned (tools/gun_search.py, gun_tune.py). Each gun has its own file.
// Every cue falls back to the old synth if its sample hasn't loaded yet.
let ctx = null, master = null;
// name -> [file, gain]. Gains level the files to the same peak (~-8 dBFS).
const SAMPLES = {
  hit: ['hit.mp3', 1], head: ['head.mp3', 1], kill: ['kill.mp3', 1], magIn: ['mag-in.mp3', 1], magOut: ['mag-out.mp3', 1],
  equip: ['equip.mp3', 0.8], ability: ['ability.mp3', 1], levelUp: ['level-up.mp3', 1], roundWin: ['round-win.mp3', 0.9],
  roundLose: ['round-lose.mp3', 1.5], countdown: ['countdown.mp3', 2.8], go: ['go.mp3', 1], ui: ['ui.mp3', 0.7],
  deflect: ['deflect.mp3', 1], unlock: ['unlock.mp3', 0.9],
};
// combat sounds; gains level them by loudest-50 ms RMS (guns -15, booms -13, hits -17, swings -19 dBFS)
const GAINS = 'bolt:0.76 boom_frag:0.57 boom_slam:0.41 boom_small:0.53 bounce:0.36 dash:0.48 dry:0.42 flashbang:0.33 gun_boomer:0.23 gun_breacher:0.23 gun_buzzsaw:0.28 gun_hornet:0.25 gun_judge:0.23 gun_longshot:0.23 gun_quill:0.29 gun_sidekick:0.25 gun_signal:0.52 gun_striker:0.23 gun_triburst:0.23 gun_twinfang:0.23 gun_wasp:0.25 impact:0.25 land:0.15 mhit_blade:0.30 mhit_blunt:0.35 mhit_heavy:0.32 pin:0.63 pump:0.37 slide:0.16 smoke:0.23 swing_blade:0.30 swing_fist:0.56 swing_heavy:0.35 swing_light:0.28 throw:0.26 shell:0.82 pad:0.19 burn:0.59 ignite:0.63 fire:0.14 ghost:0.46 zap:0.29 pop:0.43 shatter:0.18 hurt:0.23 inspect:0.14 land_soft:0.12 step:0.05 step2:0.10 pixel:0.41 spotlight:0.28 balloon:0.15';
for (const kv of GAINS.split(' ')) { const [k, g] = kv.split(':'); SAMPLES[k] = [k + '.mp3', +g]; }
const SWING = { fists: 'swing_fist', knife: 'swing_light', katana: 'swing_blade', doubleedge: 'swing_blade', scythe: 'swing_heavy', hammer: 'swing_heavy', axe: 'swing_heavy' };
const MHIT = { fists: 'mhit_blunt', hammer: 'mhit_heavy', axe: 'mhit_heavy' }; // the rest are blades
const jit = (a = 0.06) => 1 - a + Math.random() * a * 2;
const buffers = {};
function init() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); } catch (e) { return; }
  for (const [name, [file]] of Object.entries(SAMPLES)) {
    fetch((window.__BDN_SFX && window.__BDN_SFX[file]) || `${import.meta.env.BASE_URL}sfx/${file}`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => { buffers[name] = buf; }).catch(() => {});
  }
}
// play a sample; returns false if it isn't loaded (caller falls back to synthesis)
// lp: low-pass cutoff (Hz) for distant sounds
function sample(name, vol = 1, rate = 1, lp = 0) {
  const buf = ctx && buffers[name];
  if (!buf) return false;
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol * SAMPLES[name][1];
  let out = src;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; src.connect(f); out = f; }
  out.connect(g); g.connect(master); src.start();
  return true;
}
let lastImpact = 0, stepAlt = false;
addEventListener('pointerdown', init, { once: true });

function noise(dur, freq, q, vol, type = 'bandpass', delay = 0) {
  if (!ctx) return;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(ctx.currentTime + delay);
}
function tone(freq, dur, vol, type = 'sine', slide = 1, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  init,
  fire(def, vol = 1, lp = 0) {
    if (sample('gun_' + def.id, vol, jit(def.id === 'buzzsaw' ? 0.08 : 0.04), lp)) return;
    if (vol < 1) return; // no synth fallback for distant shots
    switch (def.id) {
      case 'striker': case 'triburst': noise(0.07, 2600, 0.7, 0.5); noise(0.18, 260, 0.8, 0.7, 'lowpass'); tone(120, 0.07, 0.3, 'square', 0.45); break;
      case 'wasp': case 'hornet': noise(0.045, 3400, 0.8, 0.4); noise(0.1, 380, 0.8, 0.45, 'lowpass'); tone(200, 0.04, 0.2, 'square', 0.5); break;
      case 'breacher': case 'twinfang': noise(0.3, 900, 0.6, 0.9, 'lowpass'); noise(0.12, 2200, 0.6, 0.5); tone(70, 0.2, 0.45, 'square', 0.4); break;
      case 'longshot': noise(0.5, 1200, 0.6, 0.9, 'lowpass'); noise(0.08, 3800, 1, 0.5); tone(80, 0.3, 0.45, 'sawtooth', 0.35); break;
      case 'buzzsaw': noise(0.035, 2800, 0.8, 0.32); tone(150, 0.03, 0.15, 'square', 0.6); break;
      case 'quill': tone(220, 0.12, 0.25, 'triangle', 0.5); noise(0.08, 1500, 3, 0.3); break;
      case 'boomer': noise(0.4, 300, 0.7, 0.9, 'lowpass'); tone(60, 0.3, 0.5, 'sine', 0.5); break;
      case 'signal': noise(0.25, 1800, 0.5, 0.5); tone(500, 0.2, 0.15, 'sawtooth', 2); break;
      case 'judge': noise(0.25, 900, 0.6, 0.7, 'lowpass'); noise(0.06, 3000, 0.8, 0.5); tone(110, 0.15, 0.35, 'square', 0.4); break;
      default: noise(0.05, 3200, 0.8, 0.45); noise(0.12, 420, 0.8, 0.55, 'lowpass'); tone(180, 0.05, 0.25, 'square', 0.5);
    }
  },
  pump() { if (sample('pump', 1, jit(0.03))) return; noise(0.06, 900, 2, 0.4, 'bandpass', 0.18); noise(0.06, 1400, 2, 0.4, 'bandpass', 0.32); },
  shell() { if (sample('shell', 1, jit(0.05))) return; noise(0.04, 2000, 3, 0.3); tone(700, 0.03, 0.08, 'square', 0.8); },
  swing(def) { if (sample(SWING[def.id] || 'swing_blade', 1, jit())) return; const heavy = def.id === 'hammer' || def.id === 'axe' || def.id === 'scythe'; noise(heavy ? 0.28 : 0.16, heavy ? 700 : 1600, 0.8, 0.35, 'bandpass'); },
  meleeHit(def) { if (sample(MHIT[def.id] || 'mhit_blade', 1, jit())) return; noise(0.12, def.id === 'fists' || def.id === 'hammer' ? 400 : 2500, 0.8, 0.6, def.id === 'fists' || def.id === 'hammer' ? 'lowpass' : 'bandpass'); tone(def.id === 'hammer' ? 90 : 300, 0.1, 0.3, 'square', 0.6); },
  dash() { if (sample('dash', 1, jit(0.04))) return; noise(0.25, 1200, 0.6, 0.45, 'bandpass'); tone(300, 0.2, 0.12, 'sine', 3); },
  pin() { if (sample('pin', 1)) return; tone(2600, 0.04, 0.12, 'triangle'); noise(0.04, 4000, 3, 0.2, 'highpass', 0.04); },
  toss() { if (sample('throw', 1, jit())) return; noise(0.12, 1800, 0.8, 0.25); },
  bounce() { if (sample('bounce', 0.8, jit(0.12))) return; tone(500 + Math.random() * 200, 0.04, 0.1, 'triangle'); },
  boom(big = 1) { if (sample(big >= 1 ? 'boom_frag' : 'boom_small', Math.min(1, 0.5 + big * 0.5), big >= 1 ? 1 : jit(0.05))) return; noise(0.9, 180, 0.6, 1.0 * big, 'lowpass'); noise(0.3, 1400, 0.6, 0.5 * big); tone(50, 0.5, 0.5 * big, 'sine', 0.5); },
  flashbang() { if (sample('flashbang', 1)) return; noise(0.2, 3000, 0.5, 0.8); tone(3800, 2.2, 0.08, 'sine'); },
  smoke() { if (sample('smoke', 1)) return; noise(1.6, 2500, 0.3, 0.35, 'highpass'); },
  pad() { if (sample('pad', 1)) return; tone(180, 0.35, 0.3, 'sine', 3.2); noise(0.15, 900, 1, 0.3); },
  burn() { if (sample('burn', 1, jit(0.1))) return; noise(0.12, 900, 0.7, 0.15); },
  ghost() { if (sample('ghost', 1)) return; tone(380, 1.4, 0.12, 'sine', 2.3); tone(570, 1.3, 0.06, 'sine', 1.8, 0.12); },
  thud() { if (sample('boom_slam', 0.8)) return; noise(0.3, 180, 0.7, 0.8, 'lowpass'); tone(60, 0.25, 0.3, 'sine', 0.6); },
  zap() { if (sample('zap', 1)) return; noise(0.6, 3000, 0.5, 0.8, 'highpass'); noise(0.9, 120, 0.5, 0.9, 'lowpass'); },
  pop() { if (sample('pop', 1, jit(0.08))) return; tone(500, 0.08, 0.2, 'square', 2); noise(0.15, 2500, 1, 0.3); },
  shatter() { if (sample('shatter', 1, jit(0.05))) return; noise(0.4, 3500, 0.6, 0.5, 'highpass'); },
  hurt() { if (sample('hurt', 1, jit(0.06))) return; noise(0.12, 600, 0.8, 0.45, 'lowpass'); tone(160, 0.12, 0.2, 'sawtooth', 0.6); },
  // enemy shots: quieter and duller with distance (d in metres)
  enemyFire(def, vol, d = 10) { if (!master || vol < 0.03) return; sfx.fire(def, vol, Math.max(1200, 16000 - d * 320)); },
  ignite() { sample('ignite', 1); setTimeout(() => sample('fire', 0.8), 250); },
  pixel() { sample('pixel', 1); }, spotlight() { sample('spotlight', 1); }, balloon() { sample('balloon', 1, jit(0.05)); },
  // footsteps: alternate two takes, quieter when crouched
  step(soft) { stepAlt = !stepAlt; sample(stepAlt ? 'step' : 'step2', soft ? 0.5 : 1, jit(0.08)); },
  slam() { if (!sample('boom_slam', 1)) sfx.boom(0.8); },
  bolt() { sample('bolt', 1, jit(0.03)); },
  impact() { const t = ctx ? ctx.currentTime : 0; if (t - lastImpact < 0.05) return; lastImpact = t; sample('impact', 0.6, jit(0.15)); },
  countdown(last) { if (sample(last ? 'go' : 'countdown', 1)) return; tone(last ? 1320 : 880, last ? 0.35 : 0.12, 0.2, 'square'); },
  roundWin() { if (sample('roundWin', 1)) return; [660, 880, 1320].forEach((f, i) => tone(f, 0.22, 0.18, 'triangle', 1, i * 0.09)); },
  roundLose() { if (sample('roundLose', 1)) return; [440, 330, 220].forEach((f, i) => tone(f, 0.25, 0.18, 'triangle', 1, i * 0.1)); },
  ability() { if (!sample('ability', 0.9)) tone(500, 0.3, 0.15, 'sine', 2.4); },
  levelUp() { if (!sample('levelUp', 1)) this.roundWin(); },
  ui() { if (!sample('ui', 1, 0.95 + Math.random() * 0.1)) tone(700, 0.04, 0.08, 'sine', 1.2); },
  unlock() { if (!sample('unlock', 1)) tone(880, 0.2, 0.15, 'triangle', 1.5); },
  deflect() { if (!sample('deflect', 1)) noise(0.12, 2500, 0.8, 0.5); },
  inspect() { if (sample('inspect', 1, jit(0.05))) return; noise(0.1, 2600, 2, 0.18, 'highpass'); },
  dry() { if (sample('dry', 1, jit(0.03))) return; tone(2200, 0.025, 0.12, 'square'); },
  magOut() { if (sample('magOut', 0.9, 0.95 + Math.random() * 0.1)) return; noise(0.05, 1800, 3, 0.35); tone(640, 0.04, 0.08, 'square', 0.7); },
  magIn() { if (sample('magIn', 1, 0.95 + Math.random() * 0.1)) return; noise(0.04, 2400, 4, 0.4); tone(900, 0.03, 0.1, 'square', 0.8, 0.02); },
  equip() { if (sample('equip', 0.8, 0.95 + Math.random() * 0.1)) return; noise(0.09, 3000, 2, 0.22, 'highpass'); },
  hit() { if (sample('hit', 0.9, 1.05 + Math.random() * 0.1)) return; tone(1250, 0.05, 0.16, 'sine'); },
  head() { if (sample('head', 0.9, 1.15)) return; tone(2150, 0.09, 0.22, 'triangle', 1.15); tone(3300, 0.06, 0.08, 'sine', 1, 0.012); },
  kill() { if (sample('kill', 1)) return; tone(520, 0.09, 0.24, 'square', 1.5); tone(820, 0.16, 0.2, 'square', 1.25, 0.06); },
  land(v) { if (v <= 4) { sample('land_soft', Math.min(1, 0.4 + v * 0.12), jit()); return; } if (sample('land', Math.min(1, v * 0.07), jit())) return; if (v > 4) noise(0.08, 300, 0.6, Math.min(0.35, v * 0.025), 'lowpass'); },
  slide() { if (sample('slide', 1, jit())) return; noise(0.35, 1400, 0.5, 0.18, 'bandpass'); },
};
