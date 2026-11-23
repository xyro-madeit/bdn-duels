# Sound credits

The interface and feedback sounds in this folder come from **uisfx** (https://uisfx.com,
https://github.com/romainsimon/uisfx) by Yuki Capital, dedicated to the public domain under
CC0 1.0. No attribution is required; credited here with thanks.

| File | uisfx source |
|---|---|
| hit.mp3 | mechanical/snap |
| head.mp3 | studio/notification |
| kill.mp3 | rubber/success |
| mag-in.mp3 | mechanical/press |
| mag-out.mp3 | mechanical/release |
| equip.mp3 | mechanical/drop |
| ability.mp3 | dreamy/wake |
| level-up.mp3 | soft/achievement |
| round-win.mp3 | glass/achievement |
| round-lose.mp3 | zen/error |
| countdown.mp3 | zen/hover |
| go.mp3 | studio/start |
| ui.mp3 | minimal/select |
| deflect.mp3 | mechanical/blocked |
| unlock.mp3 | arcade/unlock |

Gunshots, explosions and impacts are still synthesized in `src/audio/sfx.js` until a licensed
weapons sound library is added.

## Combat and movement sounds
`gun_*`, `swing_*`, `mhit_*`, `boom_*`, `flashbang`, `smoke`, `dash`, `slide`, `throw`, `bounce`, `pin`, `pump`,
`bolt`, `dry`, `land`, `step`, `impact`: made for this game by `tools/build_sfx.py`. Firearms come from a
procedural gunshot model whose settings were tuned against earshot's listening model (`tools/gun_search.py`,
`tools/gun_tune.py`); the rest layer renders from earshot's built-in sound bank (`tools/render_ingredients.py`).
