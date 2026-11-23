// Illustrated previews for every finisher (kill effect), drawn as inline SVG.
// A blocky soldier silhouette in the middle of each scene shows what happens to the defeated player.
const W = 200, H = 120;
const bg = (a, b) => `<defs><radialGradient id="bg" cx="50%" cy="60%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><rect width="${W}" height="${H}" rx="10" fill="url(#bg)"/>`;
// blocky soldier: head, torso, arms, legs (x,y = feet center)
const soldier = (x, y, fill = '#2b2e33', op = 1, extra = '') => `<g transform="translate(${x} ${y})" opacity="${op}" ${extra}>
  <rect x="-9" y="-30" width="7" height="30" rx="1.5" fill="${fill}"/><rect x="2" y="-30" width="7" height="30" rx="1.5" fill="${fill}"/>
  <rect x="-12" y="-58" width="24" height="30" rx="3" fill="${fill}"/><rect x="-19" y="-56" width="7" height="22" rx="2" fill="${fill}"/><rect x="12" y="-56" width="7" height="22" rx="2" fill="${fill}"/>
  <rect x="-8" y="-74" width="16" height="16" rx="3" fill="${fill}"/><rect x="-9" y="-77" width="18" height="7" rx="2" fill="${fill}"/>
  <rect x="-6" y="-68" width="12" height="3" fill="#ff3d7f"/></g>`;
const ground = (c = '#00000040') => `<ellipse cx="100" cy="104" rx="60" ry="7" fill="${c}"/>`;

export const FIN_SVG = {
  ghost: `${bg('#3b4660', '#151a26')}${ground()}
    <g transform="translate(100 104)"><path d="M-16 0L-22 -50L-12 -66H12L22 -50L16 0Z" fill="#5a3a26" stroke="#2a1a10" stroke-width="2"/><path d="M-4 -52H4M0 -58V-40" stroke="#c9a96a" stroke-width="3"/></g>
    <g opacity="0.9"><path d="M100 22c-14 0-22 10-22 22v26l6-5 6 5 5-5 5 5 6-5 6 5V44c0-12-8-22-22-22z" fill="#e8f1ff"/><circle cx="93" cy="42" r="3" fill="#151a26"/><circle cx="107" cy="42" r="3" fill="#151a26"/><ellipse cx="100" cy="52" rx="4" ry="3" fill="#151a26"/></g>
    <g fill="#e8f1ff" opacity="0.5"><circle cx="70" cy="30" r="2"/><circle cx="135" cy="24" r="1.5"/><circle cx="150" cy="50" r="2"/></g>`,
  lightning: `${bg('#2a3150', '#0c0f1c')}${ground('#7fd8ff40')}${soldier(100, 104, '#1b1e24')}
    <path d="M108 0L88 48H102L84 100L124 38H108L122 0Z" fill="#fff6a8" stroke="#ffe14d" stroke-width="2"/>
    <circle cx="100" cy="98" r="22" fill="#9fdcff" opacity="0.35"/><g stroke="#bfe8ff" stroke-width="2"><path d="M70 90l-12-8M130 90l12-8M66 104h-14M134 104h14"/></g>`,
  confetti: `${bg('#4a3c6a', '#1a1428')}${ground()}${soldier(100, 104, '#2b2e33', 0.25)}
    ${Array.from({ length: 34 }, (_, i) => { const a = i * 2.39, r = 14 + (i * 37 % 46), x = 100 + Math.cos(a) * r * 1.5, y = 58 + Math.sin(a) * r * 0.9; const c = ['#ff3d7f', '#2ee6c5', '#ffd166', '#7fb2ff', '#ff8a3d'][i % 5]; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="7" height="4" fill="${c}" transform="rotate(${(i * 47) % 180} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('')}`,
  shatter: `${bg('#2c4a5a', '#0e1a22')}${ground()}
    <g fill="#bfe9ff" stroke="#e8f8ff" stroke-width="1" opacity="0.95">
      <path d="M90 30L104 26L108 42L94 46Z"/><path d="M86 50L112 48L116 70L92 76Z"/><path d="M78 52L86 50L88 70L76 72Z"/><path d="M114 50L124 54L120 74L116 70Z"/>
      <path d="M90 80L100 78L98 100L88 102Z" transform="rotate(-8 94 90)"/><path d="M104 80L114 80L116 102L106 100Z" transform="rotate(10 110 90)"/>
      <path d="M60 36L68 32L70 40Z"/><path d="M140 30L150 34L144 42Z"/><path d="M132 84L142 82L140 92Z"/><path d="M56 80L64 76L66 86Z"/></g>`,
  ember: `${bg('#5a2a14', '#1a0a05')}${ground('#ff6a1a40')}${soldier(100, 104, '#3a1a0c', 0.7)}
    <path d="M100 104c-30 0-34-22-22-40 2 10 8 12 10 4 2-14 10-22 14-36 4 14 18 24 18 42 4-6 6-10 6-16 10 18 6 46-26 46z" fill="#ff7a1a" opacity="0.85"/>
    <path d="M100 104c-16 0-18-12-12-22 2 6 6 6 6 0 0-8 4-12 6-20 4 10 12 14 12 26 2-2 4-6 4-8 6 12 0 24-16 24z" fill="#ffd166"/>
    <g fill="#ffb347">${Array.from({ length: 12 }, (_, i) => `<circle cx="${60 + (i * 53) % 80}" cy="${14 + (i * 29) % 40}" r="${1 + (i % 3)}"/>`).join('')}</g>`,
  pixel: `${bg('#1f3a3a', '#0a1414')}${ground()}
    <g>${Array.from({ length: 60 }, (_, i) => { const col = i % 6, row = (i / 6) | 0; const x = 88 + col * 4 + (row < 4 ? (row * 9 + col * 5) % 40 : 0), y = 30 + row * 7 - (row < 4 ? (4 - row) * 4 : 0); const c = row < 2 ? '#2ee6c5' : row < 5 ? '#2b2e33' : '#3b4048'; return `<rect x="${x}" y="${y}" width="${row < 4 ? 4 : 4}" height="4" fill="${c}" opacity="${row < 4 ? 0.5 + row * 0.12 : 1}"/>`; }).join('')}</g>
    <rect x="88" y="80" width="24" height="24" fill="#2b2e33"/>`,
  balloon: `${bg('#5aa6e0', '#2a5f94')}
    <g stroke="#ffffff" stroke-width="1" opacity="0.9"><path d="M100 70L80 30M100 70L100 24M100 70L120 32"/></g>
    <ellipse cx="80" cy="22" rx="11" ry="13" fill="#ff3d7f"/><ellipse cx="100" cy="16" rx="11" ry="13" fill="#ffd166"/><ellipse cx="120" cy="24" rx="11" ry="13" fill="#2ee6c5"/>
    <g fill="#fff" opacity="0.6"><ellipse cx="76" cy="17" rx="3" ry="4"/><ellipse cx="96" cy="11" rx="3" ry="4"/><ellipse cx="116" cy="19" rx="3" ry="4"/></g>
    ${soldier(100, 112, '#2b2e33', 1, 'transform-origin="0 0"').replace('translate(100 112)', 'translate(100 112) scale(0.6)')}`,
  spotlight: `${bg('#2a2236', '#0a0810')}
    <path d="M100 0L60 104H140Z" fill="#fff4c8" opacity="0.28"/><path d="M100 0L76 104H124Z" fill="#fff4c8" opacity="0.25"/>
    <ellipse cx="100" cy="104" rx="34" ry="7" fill="#fff4c8" opacity="0.5"/>
    <g transform="translate(100 104) rotate(0)">${soldier(0, 0, '#2b2e33').replace('translate(0 0)', 'translate(0 0) rotate(-14) translate(0 0)')}</g>
    <g fill="#ffd166"><path d="M60 40l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"/><path d="M140 34l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"/></g>`,
};
export const finImg = (id) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${FIN_SVG[id] || FIN_SVG.shatter}</svg>`)}`;
