// Network channels with presence + broadcast. Two backends, same API:
//  - Supabase Realtime (when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, or Vercel's NEXT_PUBLIC_SUPABASE_* names, are set): works across the internet.
//  - Local (BroadcastChannel): tabs of the same browser on this machine. Used for testing without keys,
//    or forced with ?net=local.
// API: const ch = await joinChannel(name, meta); ch.send(type, data); ch.onMsg = (type, data, from) => {};
//      ch.onPeers = (peers) => {};  peers = [{ id, ...meta }] (includes you); ch.leave();
// No database tables: broadcast + presence only.

export const myId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const forceLocal = new URLSearchParams(location.search).get('net') === 'local';
export const backend = URL && KEY && !forceLocal ? 'supabase' : 'local';

let supa = null;
async function client() {
  if (!supa) { const { createClient } = await import('@supabase/supabase-js'); supa = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 60 } } }); }
  return supa;
}

export async function joinChannel(name, meta = {}) {
  return backend === 'supabase' ? joinSupabase(name, meta) : joinLocal(name, meta);
}

async function joinSupabase(name, meta) {
  const sb = await client();
  const ch = { onMsg: null, onPeers: null, peers: [] };
  const c = sb.channel('bdn:' + name, { config: { broadcast: { self: false, ack: false }, presence: { key: myId } } });
  c.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload.f !== myId && ch.onMsg) ch.onMsg(payload.k, payload.d, payload.f); });
  c.on('presence', { event: 'sync' }, () => {
    const st = c.presenceState();
    ch.peers = Object.entries(st).map(([id, metas]) => ({ id, ...metas[0] }));
    ch.onPeers && ch.onPeers(ch.peers);
  });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('Could not reach the server')), 10000);
    c.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(to); await c.track({ ...meta }); res(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(to); rej(new Error('Connection failed: ' + status)); }
    });
  });
  ch.send = (k, d) => c.send({ type: 'broadcast', event: 'm', payload: { k, d, f: myId } });
  ch.leave = () => { try { c.untrack(); sb.removeChannel(c); } catch (e) {} };
  return ch;
}

// Local backend: presence = heartbeats every 0.5 s, peers expire after 2 s.
function joinLocal(name, meta) {
  const bc = new BroadcastChannel('bdn:' + name);
  const ch = { onMsg: null, onPeers: null, peers: [] };
  const seen = new Map([[myId, { id: myId, ...meta, at: Infinity }]]);
  const sync = () => {
    const now = performance.now(); let changed = false;
    for (const [id, p] of seen) if (p.at < now - 2000) { seen.delete(id); changed = true; }
    const list = [...seen.values()].map(({ at, ...p }) => p);
    if (changed || list.length !== ch.peers.length) { ch.peers = list; ch.onPeers && ch.onPeers(list); }
  };
  bc.onmessage = ({ data }) => {
    if (data.f === myId) return;
    if (data.k === '_p') { const had = seen.has(data.f); seen.set(data.f, { id: data.f, ...data.d, at: performance.now() }); if (!had) { beat(); ch.peers = []; } sync(); return; }
    if (data.k === '_bye') { seen.delete(data.f); ch.peers = []; sync(); return; }
    ch.onMsg && ch.onMsg(data.k, data.d, data.f);
  };
  const beat = () => bc.postMessage({ k: '_p', d: meta, f: myId });
  const iv = setInterval(() => { beat(); sync(); }, 500);
  const bye = () => { try { bc.postMessage({ k: '_bye', f: myId }); } catch (e) {} };
  addEventListener('pagehide', bye);
  beat(); setTimeout(sync, 0);
  ch.send = (k, d) => bc.postMessage({ k, d, f: myId });
  ch.leave = () => { bye(); clearInterval(iv); removeEventListener('pagehide', bye); bc.close(); };
  return Promise.resolve(ch);
}
