# BDN Duels

A fast, round-based arena shooter that runs in the browser. Duel a real opponent online, or play 1v1, 2v2,
3v3 and Free-for-All against bots, with 20 weapons (each with its own ability on **E**), frag/flash/smoke
utilities, slide-jumps and bhops, killcams, finishers and a 50-level unlock track.

Built with Three.js and Vite. Online play uses Supabase Realtime (broadcast + presence only, no database).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Everything except online play works with no setup.

**Online without keys:** with no Supabase keys set, the Online mode runs in *local test mode*: two tabs of
the same browser can match each other (open the game in two tabs, pick Online 1v1, Quick match in both).
`/tools/nettest.html` opens two clients side by side for testing.

## Go online (free)

1. **Create a Supabase project:** sign in at https://supabase.com, click *New project*, pick any name and
   region, and wait about a minute for it to start. The free plan is enough.
2. **Copy the two keys:** in the project, open *Project Settings → API*. You need the *Project URL* and the
   *anon public* key. (The anon key is designed to be public in browser apps.)
3. **Local test (optional):** copy `.env.example` to `.env.local`, paste the two values, restart `npm run dev`.
   Two different browsers or computers can now find each other.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. At https://vercel.com click *Add New → Project* and import the repository. Vercel detects Vite; keep the
   defaults (build `npm run build`, output `dist`).
3. Before deploying, open *Environment Variables* and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click *Deploy*. Share the URL: players choose **Online 1v1**, then **Quick match**, or **Create room** and
   send the 6-letter code to a friend.

If you add the variables after the first deploy, redeploy (Vite bakes them in at build time).

## How online play works

- **Matchmaking:** Quick match puts everyone searching in one presence channel; the two who have waited the
  longest pair up. Rooms are channels named by a 6-character code; the first two people in a room play.
- **Sync:** each client sends its position and aim 20 times a second; the opponent is drawn about 110 ms in
  the past and interpolated, so movement looks smooth even with jittery connections.
- **Hits:** the shooter detects hits on their screen and sends them; each client owns its own health and
  announces its own death. The host (who created the room, or the first to queue) runs the rounds.
- This is built for friendly duels and is **not cheat-proof**: a modified client could send fake hits.
- Usage: about 50 messages per second per match, comfortably inside Supabase's free Realtime limits for
  casual play.

## Controls

WASD move · Space jump · Shift/C/Ctrl crouch and slide · Mouse aim and fire · Right mouse aim down sights ·
R reload · E weapon ability · Q utility · F inspect · 1–4 or wheel switch · Esc menu.

**Controller:** plug in or pair any game controller and press a button. The game switches its prompts
to controller automatically (and back to keyboard when you move the mouse). Left stick move · right stick
look · A jump · B crouch/slide · X reload · Y next weapon · RT fire · LT aim · RB ability · LB utility ·
R3 melee · L3 last weapon · D-pad ↑ inspect / ↓ utility / ←→ switch weapon · Start pause · Select respawn
(range). Menus: D-pad/stick to move, A select, B back, LB/RB tabs, Start play. Slight aim assist for
controllers (toggle in Settings). If a button is wrong on your pad, use Keybinds → Set up buttons.

## Sounds

UI sounds are CC0 (see `public/sfx/CREDITS.md`). Combat and movement sounds are built by
`tools/build_sfx.py` from earshot's sound bank and a gunshot model tuned with earshot's listening model.
