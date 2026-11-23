// Level-up track: XP from matches, 50 levels, one unlock at every level from 2 to 50.
// Saved in this browser (localStorage). Online matches will feed the same award() calls.
const KEY = 'bdn_duels_progress';

export const XP_RULES = { kill: 100, headshot: 25, roundWin: 150, matchWin: 500, matchPlayed: 150 };
export const MAX_LEVEL = 50;
export const xpToNext = (level) => 500 + 75 * (level - 1);

// What you start with
export const STARTER = new Set(['w:striker', 'w:sidekick', 'w:fists', 'w:frag', 'wrap:none', 'skin:none', 'fin:shatter', 'color:teal', 'color:graphite', 'hat:none']);

// level -> reward id. Prefixes: w: weapon, wrap: gun wrap, skin: melee skin, fin: finisher, color: avatar color, hat: hat
export const UNLOCKS = {
  2: 'w:wasp', 3: 'w:knife', 4: 'w:flash', 5: 'w:judge', 6: 'w:breacher', 7: 'wrap:neon', 8: 'w:smoke', 9: 'w:katana',
  10: 'wrap:arctic', 11: 'w:triburst', 12: 'skin:obsidian', 13: 'w:hornet', 14: 'wrap:jungle', 15: 'w:longshot', 16: 'fin:ghost',
  17: 'w:axe', 18: 'wrap:carbon', 19: 'w:twinfang', 20: 'skin:ruby', 21: 'w:doubleedge', 22: 'wrap:candy', 23: 'w:boomer',
  24: 'fin:confetti', 25: 'w:quill', 26: 'wrap:chrome', 27: 'w:scythe', 28: 'fin:lightning', 29: 'w:signal', 30: 'wrap:galaxy',
  31: 'w:hammer', 32: 'fin:ember', 33: 'w:buzzsaw', 34: 'skin:plasma', 35: 'color:crimson', 36: 'fin:pixel', 37: 'hat:beanie',
  38: 'color:violet', 39: 'hat:cap', 40: 'wrap:lava', 41: 'hat:headset', 42: 'fin:balloon', 43: 'hat:bucket', 44: 'color:sunset',
  45: 'skin:gold', 46: 'hat:crown', 47: 'color:ghost', 48: 'fin:spotlight', 49: 'hat:halo', 50: 'wrap:gold',
};
// Second reward on some levels (newer items)
export const BONUS = { 4: 'w:molotov', 6: 'w:bat', 12: 'wrap:cheetah', 16: 'w:karambit', 20: 'w:glasscannon', 24: 'w:rapier', 32: 'wrap:lilac', 36: 'w:shard' };
export const LEVEL_OF = Object.fromEntries([...Object.entries(UNLOCKS), ...Object.entries(BONUS)].map(([l, id]) => [id, +l]));

export class Progress {
  constructor() {
    this.level = 1; this.xp = 0; this.total = 0; this.unlockAll = false;
    this.listeners = [];
    try { Object.assign(this, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
    this.listeners = [];
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ level: this.level, xp: this.xp, total: this.total, unlockAll: this.unlockAll })); } catch (e) {} }

  has(id) { return this.unlockAll || STARTER.has(id) || (LEVEL_OF[id] !== undefined && LEVEL_OF[id] <= this.level); }
  levelFor(id) { return STARTER.has(id) ? 1 : LEVEL_OF[id] ?? 99; }

  // Adds XP; returns [{ level, reward }] for every level gained.
  add(amount) {
    const ups = [];
    this.total += amount;
    if (this.level >= MAX_LEVEL) { this.save(); return ups; }
    this.xp += amount;
    while (this.level < MAX_LEVEL && this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      ups.push({ level: this.level, reward: UNLOCKS[this.level] });
      if (BONUS[this.level]) ups.push({ level: this.level, reward: BONUS[this.level] });
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
    this.save();
    return ups;
  }
}
