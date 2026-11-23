// Match rules for offline modes. Owns state (countdown -> live -> roundEnd -> ... -> over),
// scores, spawns and respawns. The game supplies the actors and reacts to events.
export const MODES = {
  range: { id: 'range', name: 'Practice Range', desc: 'Dummies and free time to test weapons.', range: true },
  duel: { id: 'duel', name: 'Duel 1v1', desc: 'You vs one bot. First to 5 rounds.', teams: [1, 1], goal: 5, rounds: true },
  '2v2': { id: '2v2', name: '2v2', desc: 'You + a bot vs two bots. First to 5 rounds.', teams: [2, 2], goal: 5, rounds: true },
  '3v3': { id: '3v3', name: '3v3', desc: 'Your squad vs theirs. First to 5 rounds.', teams: [3, 3], goal: 5, rounds: true },
  online: { id: 'online', name: 'Online 1v1', desc: 'A real opponent over the internet. First to 5 rounds.', teams: [1, 1], goal: 5, rounds: true, online: true },
  ffa: { id: 'ffa', name: 'Free-for-All', desc: '6 players, respawns. First to 15 eliminations.', ffa: 6, goal: 15, respawn: 3 },
};

const COUNTDOWN = 3, ROUND_END = 4;

export class Match {
  // ctx: { map, player, makeBot(team, colorIdx), makeRemote(), respawnActor(actor, spawn), emit(type, data), passive }
  // passive (online guest): round flow comes from the host via applyRoundStart/applyRoundEnd/applyOver.
  constructor(modeId, ctx) {
    this.mode = MODES[modeId];
    this.ctx = ctx;
    this.actors = [ctx.player];
    this.score = {};
    this.round = 0;
    this.time = 0;
    this.winner = null;
    ctx.player.team = 0;
    if (this.mode.online) {
      this.actors.push(ctx.makeRemote());
      this.score = { 0: 0, 1: 0 };
    } else if (this.mode.teams) {
      const [a, b] = this.mode.teams;
      for (let i = 1; i < a; i++) this.actors.push(ctx.makeBot(0, 0));
      for (let i = 0; i < b; i++) this.actors.push(ctx.makeBot(1, 1));
      this.score = { 0: 0, 1: 0 };
    } else if (this.mode.ffa) {
      for (let i = 1; i < this.mode.ffa; i++) this.actors.push(ctx.makeBot(i, i));
      for (const a of this.actors) a.kills = 0;
    }
    this.state = this.mode.range ? 'live' : 'idle'; // call startRound() once the game holds a reference
  }

  get live() { return this.state === 'live'; }
  get frozen() { return this.state === 'countdown'; }
  enemiesOf(a) { return this.actors.filter((b) => b !== a && b.alive && (this.mode.ffa || b.team !== a.team)); }
  alliesOf(a) { return this.actors.filter((b) => b !== a && b.alive && !this.mode.ffa && b.team === a.team); }

  spawnsFor(team, i) {
    const S = this.ctx.map.teamSpawns;
    const side = S[team % 2];
    return side[i % side.length];
  }

  startRound() {
    this.round++;
    const counts = {};
    for (const a of this.actors) {
      const t = this.mode.ffa ? 0 : a.team;
      const i = counts[t] = (counts[t] || 0) + 1;
      const sp = this.mode.ffa ? this.ctx.map.ffaSpawns[this.actors.indexOf(a) % this.ctx.map.ffaSpawns.length] : this.spawnsFor(a.side ?? a.team, i - 1);
      this.ctx.respawnActor(a, sp);
    }
    this.state = 'countdown';
    this.timer = COUNTDOWN;
    this.ctx.emit('roundStart', { round: this.round });
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.timer);
      this.timer -= dt;
      if (Math.ceil(this.timer) !== before && this.timer > 0) this.ctx.emit('tick', { n: Math.ceil(this.timer) });
      if (this.timer <= 0) { this.state = 'live'; this.ctx.emit('go', {}); }
    } else if (this.state === 'roundEnd') {
      this.timer -= dt;
      if (this.timer <= 0 && !this.ctx.passive) { if (this.winner !== null) { this.state = 'over'; this.ctx.emit('matchOver', { winner: this.winner }); } else this.startRound(); }
    } else if (this.state === 'live' && this.mode.respawn) {
      for (const a of this.actors) if (!a.alive) {
        a.respawnT = (a.respawnT ?? this.mode.respawn) - dt;
        if (a.respawnT <= 0) { a.respawnT = undefined; this.ctx.respawnActor(a, this.farthestSpawn(a)); }
      }
    }
  }

  farthestSpawn(a) {
    let best = null, bd = -1;
    for (const s of this.ctx.map.ffaSpawns) {
      let md = 1e9;
      for (const e of this.enemiesOf(a)) md = Math.min(md, Math.hypot(e.pos.x - s.x, e.pos.z - s.z));
      if (md > bd) { bd = md; best = s; }
    }
    return best;
  }

  onKill(victim, killer) {
    if (this.mode.range || this.state !== 'live') return;
    if (killer && killer !== victim) killer.kills = (killer.kills || 0) + 1;
    if (this.ctx.passive) return;
    if (this.mode.ffa) {
      if (killer && killer.kills >= this.mode.goal) this.endRound(killer.team, victim, killer, true);
      return;
    }
    // rounds: a team with nobody standing loses the round
    const aliveTeams = new Set(this.actors.filter((a) => a.alive).map((a) => a.team));
    if (aliveTeams.size <= 1) this.endRound(aliveTeams.size ? [...aliveTeams][0] : -1, victim, killer);
  }

  endRound(team, victim, killer, final = false) {
    if (team >= 0 && !this.mode.ffa) this.score[team]++;
    if (final || (team >= 0 && this.score[team] >= this.mode.goal)) this.winner = team;
    this.state = 'roundEnd';
    this.timer = ROUND_END;
    this.ctx.emit('roundEnd', { team, victim, killer, final: this.winner !== null });
  }

  // online guest: mirror the host's decisions
  applyRoundStart(round, score) { this.score = score; this.round = round - 1; this.winner = null; this.startRound(); }
  applyRoundEnd(team, score, final) {
    this.score = score; if (final) this.winner = team;
    this.state = 'roundEnd'; this.timer = 4;
    this.ctx.emit('roundEnd', { team, final });
  }
  applyOver(team) { this.winner = team; this.state = 'over'; this.ctx.emit('matchOver', { winner: team }); }
}
