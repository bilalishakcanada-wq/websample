// "Zadatak radi": tradespeople at work and a client paying through the app, drawn for the balance card.
// One wide SVG string (1200 × 220, bottom-anchored), in the site's navy palette with warm light.
// The middle of the scene (client → coin on the way → worker) is what a phone shows; the sides add the rest of the street.
const W = 1200
const H = 220
const GROUND = 196
const SKIN = ['#f3c9a4', '#d9a07a', '#a8714d']
const INK = '#0a1640'

const eyes = (cx, cy) => `<circle cx="${cx - 5}" cy="${cy}" r="1.9" fill="${INK}"/><circle cx="${cx + 5}" cy="${cy}" r="1.9" fill="${INK}"/><path d="M${cx - 4} ${cy + 6} q4 3.5 8 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`

/** A standing person, feet at (x, y). `arms` are two path strings relative to the shoulders; `top` draws hair or a hat. */
function person({ x, y = GROUND, skin, shirt, pants, shoes = INK, top = '', arms = ['M-13 -76 q-8 16 -6 30', 'M13 -76 q8 16 6 30'], hands = [[-19, -46], [19, -46]], extra = '', back = '', front = '', flip = false }) {
  return `<g transform="translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}">
    ${back}
    <rect x="-11" y="-42" width="9" height="40" rx="4" fill="${pants}"/><rect x="2" y="-42" width="9" height="40" rx="4" fill="${pants}"/>
    <ellipse cx="-7" cy="-1" rx="8" ry="4" fill="${shoes}"/><ellipse cx="7" cy="-1" rx="8" ry="4" fill="${shoes}"/>
    <rect x="-17" y="-84" width="34" height="48" rx="12" fill="${shirt}"/>
    ${extra}
    <path d="${arms[0]}" stroke="${shirt}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="${arms[1]}" stroke="${shirt}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="${hands[0][0]}" cy="${hands[0][1]}" r="5" fill="${skin}"/><circle cx="${hands[1][0]}" cy="${hands[1][1]}" r="5" fill="${skin}"/>
    <rect x="-4" y="-92" width="8" height="10" rx="3" fill="${skin}"/>
    <circle cx="0" cy="-102" r="15" fill="${skin}"/>
    ${eyes(2, -103)}
    ${top}
    ${front}
  </g>`
}

const helmet = (color) => `<path d="M-16 -104 a16 15 0 0 1 32 0 z" fill="${color}"/><rect x="-19" y="-106" width="38" height="5" rx="2.5" fill="${color}"/><rect x="-2" y="-120" width="4" height="10" rx="2" fill="rgba(255,255,255,.45)"/>`
const cap = (color) => `<path d="M-15 -106 a15 13 0 0 1 30 0 z" fill="${color}"/><path d="M8 -107 h16 a3 3 0 0 1 0 5 h-16 z" fill="${color}"/>`
const hairShort = (color) => `<path d="M-15 -104 q0 -16 15 -16 q16 0 15 16 q-6 -8 -15 -8 q-9 0 -15 8 z" fill="${color}"/>`
const hairLong = (color) => `<path d="M-16 -100 q-2 -21 16 -21 q18 0 16 21 l3 26 q-6 4 -10 -2 l-2 -22 q-7 -6 -14 -6 q-8 0 -12 8 l-1 20 q-5 4 -9 0 z" fill="${color}"/>`

function background() {
  let stars = ''
  let s = 7
  for (let i = 0; i < 34; i++) {
    s = (s * 16807) % 2147483647
    const sx = (s % W)
    s = (s * 16807) % 2147483647
    const sy = 8 + (s % 70)
    stars += `<circle class="ws-tw" style="animation-delay:${(i % 7) * 0.5}s" cx="${sx}" cy="${sy}" r="${1 + (i % 3) * 0.5}" fill="#fff" opacity=".8"/>`
  }
  return `<defs>
    <linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14287a"/><stop offset="1" stop-color="#223c9c"/></linearGradient>
    <linearGradient id="ws-street" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a4bb8"/><stop offset="1" stop-color="#0b1f66"/></linearGradient>
    <radialGradient id="ws-lamp"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>
    <radialGradient id="ws-coin-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ws-sky)"/>
  ${stars}
  <path d="M0 150 q120 -40 260 -10 t300 -6 t320 4 t320 -12 V${H} H0 z" fill="#1c3590" opacity=".8"/>
  <rect y="${GROUND - 4}" width="${W}" height="${H - GROUND + 4}" fill="url(#ws-street)"/>
  <rect y="${GROUND - 4}" width="${W}" height="3" fill="#4a6ee0" opacity=".7"/>`
}

/* left: a painter rolling fresh colour onto a wall */
function painter() {
  const wall = `<rect x="40" y="70" width="170" height="${GROUND - 74}" rx="6" fill="#2b45a8"/>
    <rect x="40" y="70" width="142" height="${GROUND - 74}" rx="6" fill="#ffd27a"/>
    <rect x="172" y="70" width="10" height="${GROUND - 74}" fill="#ffc35a"/>
    <rect x="58" y="88" width="40" height="30" rx="3" fill="#ffe7a8" opacity=".7"/>`
  const roller = `<path d="M17 -78 L40 -110" stroke="#c9d6ff" stroke-width="4" stroke-linecap="round"/><path d="M40 -110 h6" stroke="#c9d6ff" stroke-width="4" stroke-linecap="round"/><rect x="44" y="-126" width="10" height="34" rx="4" fill="#ffd27a" stroke="#e9a93b" stroke-width="2"/>`
  return wall + person({ x: 236, skin: SKIN[0], shirt: '#ffffff', pants: '#3c5ccf', top: cap('#ff8a5b'),
    arms: ['M-13 -76 q-10 14 -8 30', 'M13 -76 q10 -2 18 -18'], hands: [[-21, -46], [33, -95]], flip: true, front: '', back: '', extra: '' })
    .replace('</g>', `${roller}</g>`)
}

/* an electrician on a ladder, putting a light back on */
function electrician() {
  const x = 400
  const lamp = `<rect x="${x + 54}" y="40" width="6" height="${GROUND - 40}" rx="3" fill="#3954b8"/>
    <path d="M${x + 57} 44 q0 -14 -22 -14" stroke="#3954b8" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="${x + 30}" cy="40" r="46" fill="url(#ws-lamp)" class="ws-glow"/>
    <path d="M${x + 20} 32 h22 l-4 12 h-14 z" fill="#ffe7a8"/>`
  const ladder = `<g stroke="#9fb4ff" stroke-width="5" stroke-linecap="round"><path d="M${x - 30} ${GROUND} L${x - 6} 70"/><path d="M${x + 4} ${GROUND} L${x + 24} 70"/>
    ${[0, 1, 2, 3, 4].map((i) => { const t = 0.14 + i * 0.19; const y = GROUND - (GROUND - 70) * t; return `<path d="M${x - 30 + 24 * t} ${y} L${x + 4 + 20 * t} ${y}"/>` }).join('')}</g>`
  const worker = person({ x: x + 2, y: 132, skin: SKIN[1], shirt: '#ff8a5b', pants: '#1d2f7a', top: helmet('#ffd27a'),
    arms: ['M-13 -76 q-6 12 -4 26', 'M13 -76 q12 -14 16 -30'], hands: [[-17, -50], [29, -106]],
    extra: '<rect x="-17" y="-52" width="34" height="6" rx="3" fill="#1d2f7a"/><rect x="6" y="-50" width="8" height="10" rx="2" fill="#ffd27a"/>' })
  return lamp + ladder + worker
}

/* the middle: a client pays from the phone, the money travels to the worker */
function payment() {
  const client = person({ x: 560, skin: SKIN[0], shirt: '#7fb0ff', pants: '#24346f', top: hairLong('#5a3418'),
    arms: ['M-13 -76 q-8 16 -6 30', 'M13 -76 q12 6 16 -6'], hands: [[-19, -46], [30, -84]],
    front: '<rect x="26" y="-104" width="14" height="24" rx="3" fill="#0a1640"/><rect x="28" y="-101" width="10" height="17" rx="2" fill="#19b37b"/><path d="M30 -93 l2.5 3 l4 -5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' })
  const path = 'M600 92 C 650 20, 720 20, 770 84'
  const coin = `<g class="ws-coin"><circle r="22" fill="url(#ws-coin-glow)"/><circle r="12" fill="#ffd27a" stroke="#e9a93b" stroke-width="2.5"/><text y="4" text-anchor="middle" font-family="Figtree, sans-serif" font-size="10" font-weight="800" fill="#8a5a00">KM</text>
    <animateMotion dur="3.6s" repeatCount="indefinite" path="${path}" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear"/></g>`
  const arc = `<path d="${path}" stroke="#ffd27a" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round" fill="none" opacity=".8"/>`
  const worker = person({ x: 800, skin: SKIN[2], shirt: '#19b37b', pants: '#1d2f7a', top: cap('#0a1f63'),
    arms: ['M-13 -76 q-14 -6 -20 -26', 'M13 -76 q6 16 10 30'], hands: [[-33, -102], [23, -46]], flip: true,
    extra: '<path d="M-17 -60 h34" stroke="#0f8a5c" stroke-width="3"/><rect x="-9" y="-80" width="18" height="12" rx="3" fill="#0f8a5c"/>' })
  const toolbox = `<g transform="translate(826 ${GROUND})"><rect x="0" y="-22" width="40" height="22" rx="4" fill="#ff8a5b"/><rect x="0" y="-22" width="40" height="7" rx="3" fill="#e86d3e"/><path d="M12 -22 v-6 h16 v6" stroke="#0a1640" stroke-width="3" fill="none"/><path d="M44 -6 l16 -18" stroke="#c9d6ff" stroke-width="5" stroke-linecap="round"/><circle cx="61" cy="-25" r="5" fill="none" stroke="#c9d6ff" stroke-width="4"/></g>`
  return arc + client + worker + toolbox + coin
}

/* right: a mover carrying a box to the van */
function mover() {
  const van = `<g transform="translate(1040 ${GROUND})"><rect x="0" y="-74" width="120" height="62" rx="10" fill="#ffffff"/><path d="M120 -60 h26 q14 0 18 16 l4 14 v18 h-48 z" fill="#ffffff"/><rect x="128" y="-54" width="24" height="18" rx="3" fill="#7fb0ff"/>
    <rect x="12" y="-62" width="70" height="20" rx="4" fill="#1f5fff"/><text x="47" y="-48" text-anchor="middle" font-family="Figtree, sans-serif" font-size="12" font-weight="800" fill="#fff">ZADATAK</text>
    <circle cx="30" cy="-10" r="13" fill="#0a1640"/><circle cx="30" cy="-10" r="5" fill="#9fb4ff"/><circle cx="136" cy="-10" r="13" fill="#0a1640"/><circle cx="136" cy="-10" r="5" fill="#9fb4ff"/></g>`
  const box = '<rect x="-24" y="-96" width="48" height="36" rx="4" fill="#d9a26b"/><path d="M-24 -84 h48" stroke="#b9814b" stroke-width="3"/><rect x="-6" y="-96" width="12" height="12" fill="#efc48f"/>'
  const worker = person({ x: 980, skin: SKIN[1], shirt: '#1f5fff', pants: '#0a1640', top: hairShort('#2a1a10'),
    arms: ['M-13 -76 q-14 4 -18 -14', 'M13 -76 q14 4 18 -14'], hands: [[-31, -88], [31, -88]], front: box })
  return van + worker
}

export function workScene() {
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${background()}${painter()}${electrician()}${payment()}${mover()}</svg>`
}
