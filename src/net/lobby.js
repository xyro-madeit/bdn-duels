// Matchmaking. Quick Match: everyone waiting sits in one presence channel; the two who have waited
// longest pair up (every client computes the same pairs). Rooms: a 6-letter code is a channel; the
// first two in it play. Resolves with { ch, host, opp } once both players are in the match channel.
import { joinChannel, myId } from './net.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const byWait = (a, b) => a.t - b.t || (a.id < b.id ? -1 : 1);

// meta: { name, color, hat } · onStatus(text) · returns { promise, cancel }
export function findMatch(kind, meta, onStatus, code) {
  let cancelled = false, open = [];
  const cancel = () => { cancelled = true; for (const c of open) c.leave(); open = []; };
  const join = async (name, m) => { const c = await joinChannel(name, m); if (cancelled) { c.leave(); throw new Error('cancelled'); } open.push(c); return c; };
  const drop = (c) => { c.leave(); open = open.filter((x) => x !== c); };

  // wait until exactly us + the expected opponent are present in a channel
  const meet = (ch, oppId, ms) => new Promise((res, rej) => {
    const check = (peers) => { const o = peers.find((p) => p.id === oppId); if (o) { clearTimeout(to); ch.onPeers = null; res(o); } };
    const to = setTimeout(() => { ch.onPeers = null; rej(new Error('timeout')); }, ms);
    ch.onPeers = check; check(ch.peers);
  });

  const promise = (async () => {
    const t = Date.now();
    if (kind === 'room') {
      onStatus(`Room ${code}: waiting for your opponent…`);
      const ch = await join('room:' + code, { ...meta, t });
      const opp = await new Promise((res, rej) => {
        ch.onPeers = (peers) => {
          if (peers.length < 2) return;
          const two = [...peers].sort(byWait).slice(0, 2);
          if (!two.some((p) => p.id === myId)) { ch.onPeers = null; rej(new Error('That room is full.')); return; }
          ch.onPeers = null; res(two.find((p) => p.id !== myId));
        };
        ch.onPeers(ch.peers);
      });
      const host = byWait({ id: myId, t }, opp) < 0;
      return { ch, host, opp };
    }
    // quick match
    for (;;) {
      onStatus('Searching for an opponent…');
      const q = await join('queue', { ...meta, t }); // same t every lap, so you keep your place in line
      // If nobody shows up within a few seconds, re-enter the queue: a fresh join re-syncs presence,
      // so a missed "player joined" event can't leave you waiting forever. Your place (t) is kept.
      const opp = await new Promise((res) => {
        const to = setTimeout(() => { q.onPeers = null; res(null); }, 6000);
        q.onPeers = (peers) => {
          const list = [...peers].sort(byWait), i = list.findIndex((p) => p.id === myId);
          const j = i % 2 === 0 ? i + 1 : i - 1;
          if (i >= 0 && list[j]) { clearTimeout(to); q.onPeers = null; res(list[j]); }
        };
        q.onPeers(q.peers);
      });
      if (!opp) { drop(q); if (cancelled) throw new Error('cancelled'); continue; }
      onStatus(`Found ${opp.name || 'an opponent'}. Connecting…`);
      const id = [myId, opp.id].sort().join('-');
      const ch = await join('m:' + id, { ...meta, t });
      drop(q);
      try { await meet(ch, opp.id, 8000); } catch (e) { drop(ch); if (cancelled) throw e; continue; } // they paired with someone else: requeue
      return { ch, host: myId < opp.id, opp };
    }
  })();
  return { promise, cancel };
}
