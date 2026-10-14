// Footer panoramas of Bosnian cities, drawn as SVG strings at dusk, in the site's navy palette with warm light.
// Each scene fades from transparent at the top into the footer's navy, so it sits on the footer without a seam.
// Moving parts carry cs-* classes; the motion itself lives in cityScenes.css.
const W = 1600
const H = 300
const NAVY = '#071647'
const LIT = '#ffd27a'
const DARK_WIN = '#24346f'
const GOLD = '#f2c14e'
const r1 = (n) => Math.round(n * 10) / 10

/** small deterministic random numbers, so a scene looks the same on every visit */
function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function sky(id, horizon, mid) {
  return `<defs>
  <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}" stop-opacity="0"/><stop offset=".3" stop-color="${mid}" stop-opacity=".45"/><stop offset=".62" stop-color="${horizon}" stop-opacity=".85"/><stop offset="1" stop-color="${horizon}" stop-opacity=".9"/></linearGradient>
  <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY}" stop-opacity="0"/><stop offset="1" stop-color="${NAVY}"/></linearGradient>
  <radialGradient id="${id}-glow"><stop offset="0" stop-color="#fff3d0" stop-opacity=".9"/><stop offset=".35" stop-color="#ffd9a0" stop-opacity=".35"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
  </defs><rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`
}
const fade = (id) => `<rect y="${H - 40}" width="${W}" height="40" fill="url(#${id}-fade)"/>`

function stars(seed, n, maxY = 110) {
  const rand = rng(seed)
  let out = ''
  for (let i = 0; i < n; i++) {
    out += `<circle class="cs-tw" style="animation-delay:${r1(rand() * 4)}s" cx="${r1(rand() * W)}" cy="${r1(6 + rand() * maxY)}" r="${r1(0.8 + rand() * 1.5)}" fill="#fff"/>`
  }
  return out
}

const sun = (id, x, y, rad, fill = '#ffd38a') => `<circle cx="${x}" cy="${y}" r="${rad * 3.2}" fill="url(#${id}-glow)"/><circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}"/>`

const moon = (id, x, y, rad, crescent = false) => crescent
  ? `<mask id="${id}-moon"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${x + rad * 0.45}" cy="${y - rad * 0.25}" r="${rad * 0.9}" fill="#000"/></mask><circle cx="${x}" cy="${y}" r="${rad * 3}" fill="url(#${id}-glow)" opacity=".6"/><circle cx="${x}" cy="${y}" r="${rad}" fill="#fff3d0" mask="url(#${id}-moon)"/>`
  : `<circle cx="${x}" cy="${y}" r="${rad * 3.2}" fill="url(#${id}-glow)" opacity=".7"/><circle cx="${x}" cy="${y}" r="${rad}" fill="#fff6dc"/><circle cx="${x - rad * 0.3}" cy="${y - rad * 0.2}" r="${rad * 0.22}" fill="#efe0b8"/><circle cx="${x + rad * 0.35}" cy="${y + rad * 0.3}" r="${rad * 0.15}" fill="#efe0b8"/>`

/** a soft mountain ridge across the whole width; `shape` lifts parts of it */
function ridge(seed, y, amp, fill, step = 90, shape = () => 0) {
  const rand = rng(seed)
  const pts = []
  for (let x = -60; x <= W + 60 + step; x += step) pts.push([x, y - rand() * amp - shape(x)])
  let d = `M-60 ${H}L${pts[0][0]} ${r1(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) d += `Q${pts[i][0]} ${r1(pts[i][1])} ${r1((pts[i][0] + pts[i + 1][0]) / 2)} ${r1((pts[i][1] + pts[i + 1][1]) / 2)}`
  return `<path d="${d}L${W + 60} ${H}Z" fill="${fill}"/>`
}

/** a row of old houses standing on `base(x)`: pale walls, hipped roofs, some windows lit */
function houses(seed, x0, x1, base, o = {}) {
  const rand = rng(seed)
  const s = o.scale ?? 1
  const walls = o.walls ?? ['#f4ecdf', '#e9dfcf', '#dfe6f5', '#f1e2c8', '#e8d6c0']
  const roofs = o.roofs ?? ['#6f7aa6', '#5d6894', '#7c86ad']
  const lit = o.lit ?? 0.45
  let out = ''
  let x = x0
  while (x < x1) {
    const w = (24 + rand() * 22) * s
    const h = (20 + rand() * 20) * s
    const rh = (10 + rand() * 8) * s
    const y = base(x + w / 2) - h
    const wall = walls[Math.floor(rand() * walls.length)]
    const roof = roofs[Math.floor(rand() * roofs.length)]
    out += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h + 8)}" fill="${wall}"/>`
    out += `<rect x="${r1(x + w * 0.64)}" y="${r1(y)}" width="${r1(w * 0.36)}" height="${r1(h + 8)}" fill="${NAVY}" opacity=".2"/>`
    out += `<path d="M${r1(x - 3 * s)} ${r1(y)}L${r1(x + w * 0.25)} ${r1(y - rh)}L${r1(x + w * 0.75)} ${r1(y - rh)}L${r1(x + w + 3 * s)} ${r1(y)}Z" fill="${roof}"/>`
    const cols = w > 34 * s ? 3 : 2
    const rows = h > 30 * s ? 2 : 1
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < rows; k++) {
        const on = rand() < lit
        const flick = on && rand() < 0.25 ? ` class="cs-flick" style="animation-delay:${r1(rand() * 5)}s"` : ''
        out += `<rect${flick} x="${r1(x + ((j + 0.5) * w) / cols - 2.5 * s)}" y="${r1(y + 6 * s + k * 12 * s)}" width="${r1(5 * s)}" height="${r1(7 * s)}" fill="${on ? LIT : DARK_WIN}"/>`
      }
    }
    x += w + (rand() * 7 - 1) * s
  }
  return out
}

function minaret(x, b, h, col = '#f3f1ea', cap = '#5d6894') {
  const t = b - h
  return `<path d="M${x - 9} ${b}V${r1(b - h * 0.22)}H${x + 9}V${b}Z" fill="${col}"/>
  <rect x="${x - 6}" y="${t + 30}" width="12" height="${h - 30}" fill="${col}"/>
  <rect x="${x + 1}" y="${t + 30}" width="5" height="${h - 30}" fill="${NAVY}" opacity=".16"/>
  <path d="M${x - 11} ${r1(t + h * 0.3)}h22l-4 7h-14z" fill="${col}"/><rect x="${x - 11}" y="${r1(t + h * 0.3 - 3)}" width="22" height="3" fill="${cap}"/>
  <rect x="${x - 2}" y="${r1(t + h * 0.3 + 10)}" width="4" height="7" rx="2" fill="${LIT}" class="cs-flick"/>
  <path d="M${x - 7} ${t + 31}L${x} ${t}L${x + 7} ${t + 31}Z" fill="${cap}"/>
  <path d="M${x} ${t}v-10" stroke="${GOLD}" stroke-width="1.6"/><circle cx="${x}" cy="${t - 12}" r="2.2" fill="${GOLD}"/>`
}

const dome = (cx, b, rx, col, ry = rx * 0.9) => `<path d="M${cx - rx} ${b}A${rx} ${r1(ry)} 0 0 1 ${cx + rx} ${b}Z" fill="${col}"/><path d="M${cx} ${r1(b - ry)}v-9" stroke="${GOLD}" stroke-width="1.6"/><circle cx="${cx}" cy="${r1(b - ry - 10)}" r="2" fill="${GOLD}"/>`

function mosque(x, b, w, col, domeCol) {
  const cx = x + w / 2
  let arches = ''
  for (let i = 0; i < 3; i++) {
    const ax = x + 8 + i * ((w - 16) / 3)
    arches += `<path d="M${r1(ax + 3)} ${b}V${b - 14}a${r1((w - 16) / 6 - 3)} 8 0 0 1 ${r1((w - 16) / 3 - 6)} 0V${b}Z" fill="${NAVY}" opacity=".45"/>`
  }
  return `<rect x="${x}" y="${b - 38}" width="${w}" height="38" fill="${col}"/><rect x="${x + w * 0.66}" y="${b - 38}" width="${r1(w * 0.34)}" height="38" fill="${NAVY}" opacity=".14"/>${arches}${dome(cx, b - 38, w * 0.36, domeCol)}`
}

const tree = (x, b, s, col = '#1f6b63') => `<rect x="${r1(x - 1.5 * s)}" y="${r1(b - 8 * s)}" width="${r1(3 * s)}" height="${r1(8 * s)}" fill="#3a2e4f"/><circle cx="${x}" cy="${r1(b - 16 * s)}" r="${r1(10 * s)}" fill="${col}"/><circle cx="${r1(x - 7 * s)}" cy="${r1(b - 11 * s)}" r="${r1(7 * s)}" fill="${col}"/><circle cx="${r1(x + 7 * s)}" cy="${r1(b - 11 * s)}" r="${r1(7 * s)}" fill="${col}"/><circle cx="${r1(x - 3 * s)}" cy="${r1(b - 20 * s)}" r="${r1(4 * s)}" fill="#fff" opacity=".1"/>`
const cypress = (x, b, h, col = '#174f4f') => `<ellipse cx="${x}" cy="${r1(b - h / 2)}" rx="${r1(h * 0.16)}" ry="${r1(h / 2)}" fill="${col}"/>`

function trees(seed, x0, x1, base, s = 1, cols = ['#1f6b63', '#24806b', '#1a5a5c']) {
  const rand = rng(seed)
  let out = ''
  for (let x = x0; x < x1; x += (14 + rand() * 18) * s) out += tree(r1(x), base(x), s * (0.8 + rand() * 0.5), cols[Math.floor(rand() * cols.length)])
  return out
}

function water(id, y0, top, bottom, seed, x0 = 0, x1 = W, n = 28) {
  const rand = rng(seed)
  let lines = ''
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0)
    const y = y0 + 6 + rand() * (H - y0 - 16)
    lines += `<path class="cs-shim" style="animation-delay:${r1(rand() * 3.6)}s" d="M${r1(x)} ${r1(y)}h${r1(12 + rand() * 40)}" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`
  }
  return `<linearGradient id="${id}-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${H - y0}" fill="url(#${id}-w)"/>${lines}`
}

/** warm light lying on the water below the sun or moon */
function glint(seed, x, y0, col = LIT) {
  const rand = rng(seed)
  let out = ''
  for (let y = y0 + 6; y < H - 6; y += 7) {
    const w = 10 + rand() * 30 + (y - y0) * 0.5
    out += `<path class="cs-shim" style="animation-delay:${r1(rand() * 3)}s" d="M${r1(x - w / 2)} ${y}h${r1(w)}" stroke="${col}" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>`
  }
  return out
}

const flock = (y, dur, delay, col = '#1a2563') => `<g transform="translate(0 ${y})"><g class="cs-fly" style="animation-duration:${dur}s;animation-delay:-${delay}s">${[[0, 0], [24, 9], [44, -5], [62, 6]].map(([dx, dy]) => `<path class="cs-flap" d="M${dx - 7} ${dy}q4-5 7 0q3-5 7 0" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`).join('')}</g></g>`

const svg = (body) => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

/* ------------------------------------------------------------------ MOSTAR */
function mostar() {
  const id = 'mo'
  const front = (x) => 205 + (x / 640) * 46
  const frontR = (x) => 252 - ((x - 960) / 640) * 58
  const bridge = 'M646 258L670 170Q800 100 930 170L954 258H912Q800 56 688 258Z'
  return svg(`${sky(id, '#ff8a6b', '#6b5bd6')}${stars(3, 26, 90)}${sun(id, 1080, 128, 30)}
  ${ridge(7, 150, 60, '#3d3f93')}${ridge(9, 186, 40, '#2c3082', 110)}
  ${flock(110, 52, 8)}${flock(140, 64, 30)}
  <path d="M0 ${H}V196Q160 184 300 202T640 250V${H}Z" fill="#1f2b70"/>
  <path d="M960 ${H}V250Q1150 224 1300 208T1600 190V${H}Z" fill="#1f2b70"/>
  ${houses(11, 0, 600, (x) => front(x) - 26, { scale: 0.8, lit: 0.35 })}
  ${houses(12, 1000, 1600, (x) => frontR(x) - 26, { scale: 0.8, lit: 0.35 })}
  ${cypress(380, 228, 48)}${cypress(400, 230, 38)}${cypress(1110, 236, 46)}
  ${mosque(430, 240, 84, '#f1ebdf', '#7c86ad')}${minaret(532, 242, 132)}
  ${minaret(1210, 236, 112)}
  <rect x="1418" y="80" width="18" height="130" fill="#ece3d3"/><rect x="1428" y="80" width="8" height="130" fill="${NAVY}" opacity=".16"/><path d="M1414 80L1427 32L1440 80Z" fill="#5d6894"/><rect x="1423" y="96" width="8" height="12" rx="4" fill="${LIT}"/>
  ${houses(13, 10, 610, front, { lit: 0.45 })}
  ${houses(14, 1010, 1600, frontR, { lit: 0.45 })}
  ${trees(15, 560, 640, (x) => front(x) + 2, 0.9)}${trees(16, 1010, 1080, (x) => frontR(x) + 2, 0.9)}
  ${water(id, 250, '#22b8a4', '#12608c', 17)}
  ${glint(18, 1080, 250)}
  <g transform="translate(0 516) scale(1 -1)" opacity=".22"><path d="${bridge}" fill="#ead9bd"/></g>
  <path d="M590 262Q610 236 650 240T700 262Z" fill="#8f8aa6"/><path d="M900 262Q930 232 980 238T1030 262Z" fill="#8f8aa6"/>
  <rect x="596" y="150" width="64" height="108" fill="#e3d2b4"/><rect x="636" y="150" width="24" height="108" fill="${NAVY}" opacity=".15"/>
  <path d="M590 150L628 116L666 150Z" fill="#5d6894"/><path d="M612 196v-8a5 5 0 0 1 10 0v8Z" fill="${LIT}"/><path d="M612 226v-8a5 5 0 0 1 10 0v8Z" fill="${DARK_WIN}"/>
  <rect x="940" y="136" width="70" height="122" fill="#dccaa9"/><rect x="984" y="136" width="26" height="122" fill="${NAVY}" opacity=".15"/>
  <path d="M934 136Q975 98 1016 136Z" fill="#5d6894"/><path d="M962 180v-9a6 6 0 0 1 12 0v9Z" fill="${LIT}" class="cs-flick"/><path d="M962 214v-9a6 6 0 0 1 12 0v9Z" fill="${DARK_WIN}"/>
  <path d="${bridge}" fill="#ead9bd"/>
  <path d="M694 258Q800 66 906 258" fill="none" stroke="#bfa57c" stroke-width="5" stroke-dasharray="3 9"/>
  <path d="M670 166Q800 96 930 166" fill="none" stroke="#f7eedd" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(800 132)"><g class="cs-bob"><circle cx="0" cy="-17" r="3.2" fill="#0b1a4f"/><path d="M0-13V-3M0-3l-3 7M0-3l3 7M0-11l-5-8M0-11l5-8" stroke="#0b1a4f" stroke-width="2.2" stroke-linecap="round"/></g></g>
  ${fade(id)}`)
}

/* ------------------------------------------------------------------ SARAJEVO */
function sarajevo() {
  const id = 'sa'
  const left = (x) => Math.min(262, 150 + (x / 600) * 86)
  const right = (x) => Math.min(262, 236 - ((x - 1000) / 600) * 86)
  let stripes = ''
  for (let y = 170; y < 262; y += 11) stripes += `<rect x="670" y="${y}" width="260" height="5" fill="#c8553d"/>`
  let drum = ''
  for (let y = 128; y < 166; y += 9) drum += `<rect x="762" y="${y}" width="76" height="4" fill="#c8553d"/>`
  let merlons = ''
  for (let x = 672; x < 928; x += 14) merlons += `<rect x="${x}" y="158" width="8" height="8" fill="#f0c27a"/>`
  let wins = ''
  for (const [y, n] of [[184, 9], [222, 9]]) {
    for (let i = 0; i < n; i++) {
      const x = 684 + i * 27
      if (y === 222 && i === 4) continue
      wins += `<path d="M${x} ${y + 20}V${y + 8}a6 7 0 0 1 12 0V${y + 20}Z" fill="${(i * 7 + y) % 3 ? LIT : DARK_WIN}"${i % 4 === 1 ? ' class="cs-flick"' : ''}/>`
    }
  }
  let avaz = ''
  for (let i = 0; i < 9; i++) avaz += `<path d="M1482 ${236 - i * 19}L1520 ${226 - i * 19}" stroke="${LIT}" stroke-width="2" opacity="${i % 3 ? 0.45 : 0.85}"/>`
  return svg(`${sky(id, '#ff9fb0', '#7a6cf0')}${stars(21, 34, 100)}${moon(id, 1330, 58, 18, true)}
  ${ridge(23, 130, 70, '#34408f', 100)}${ridge(25, 170, 40, '#28337f', 120)}
  ${flock(120, 58, 12)}
  <path d="M0 ${H}V150Q300 170 600 236L620 ${H}Z" fill="#1f2b70"/><path d="M1600 ${H}V150Q1300 170 1000 236L980 ${H}Z" fill="#1f2b70"/>
  ${houses(31, 0, 560, (x) => left(x) - 4, { scale: 0.7, lit: 0.4 })}
  ${houses(32, 1040, 1600, (x) => right(x) - 4, { scale: 0.7, lit: 0.4 })}
  ${houses(33, 0, 600, (x) => Math.min(262, left(x) + 30), { scale: 0.85, lit: 0.45 })}
  ${houses(34, 1000, 1600, (x) => Math.min(262, right(x) + 30), { scale: 0.85, lit: 0.45 })}
  <rect x="1478" y="66" width="46" height="196" fill="#4f86ff"/><path d="M1478 66L1500 52L1524 66Z" fill="#9fc0ff"/><rect x="1501" y="66" width="23" height="196" fill="#9fc0ff" opacity=".35"/>${avaz}
  <rect x="398" y="186" width="76" height="76" fill="#e8dccb"/><circle cx="436" cy="212" r="11" fill="${LIT}"/><circle cx="436" cy="212" r="11" fill="none" stroke="#c8553d" stroke-width="3"/>
  <rect x="392" y="140" width="22" height="122" fill="#e8dccb"/><rect x="458" y="140" width="22" height="122" fill="#e8dccb"/><rect x="406" y="140" width="8" height="122" fill="${NAVY}" opacity=".14"/><rect x="472" y="140" width="8" height="122" fill="${NAVY}" opacity=".14"/>
  <path d="M390 140L403 104L416 140Z" fill="#5d6894"/><path d="M456 140L469 104L482 140Z" fill="#5d6894"/><path d="M400 160v-8a3 3 0 0 1 6 0v8Z" fill="${LIT}"/><path d="M466 160v-8a3 3 0 0 1 6 0v8Z" fill="${LIT}"/>
  <rect x="670" y="166" width="260" height="96" fill="#f0c27a"/>${stripes}${merlons}
  <rect x="662" y="146" width="22" height="116" fill="#f0c27a"/><rect x="916" y="146" width="22" height="116" fill="#f0c27a"/>
  <path d="M662 146h22v-7h-5v4h-4v-4h-4v4h-4v-4h-5Z" fill="#f0c27a"/><path d="M916 146h22v-7h-5v4h-4v-4h-4v4h-4v-4h-5Z" fill="#f0c27a"/>
  <rect x="762" y="124" width="76" height="42" fill="#f0c27a"/>${drum}${dome(800, 124, 30, '#5fa79a', 26)}
  <rect x="860" y="146" width="78" height="116" fill="${NAVY}" opacity=".12"/>
  ${wins}<path d="M786 262V236a14 14 0 0 1 28 0V262Z" fill="${LIT}"/>
  ${mosque(1100, 262, 110, '#efe8da', '#7c86ad')}${dome(1112, 224, 12, '#7c86ad')}${minaret(1236, 262, 160)}
  <rect x="972" y="254" width="76" height="8" fill="#cfc3b0"/>
  <rect x="984" y="214" width="52" height="40" fill="#9a6232"/>
  <path d="M990 254v-24a6 6 0 0 1 12 0v24Zm14 0v-24a6 6 0 0 1 12 0v24Zm14 0v-24a6 6 0 0 1 12 0v24Z" fill="#5a3a24"/>
  <path d="M968 214L1052 214L1042 202L978 202Z" fill="#6e4426"/>${dome(1010, 202, 25, '#3f8f78', 28)}
  <circle cx="964" cy="259" r="3" fill="#b9bfd6"/><circle cx="1058" cy="258" r="3" fill="#b9bfd6"/><circle cx="1066" cy="260" r="2.5" fill="#b9bfd6"/>
  <rect y="262" width="${W}" height="8" fill="#1a2566"/>
  ${water(id, 270, '#3a7fd0', '#1d3f8f', 35, 0, W, 18)}
  <path d="M250 270Q280 258 310 270M300 270Q330 258 360 270" fill="none" stroke="#e3d3b5" stroke-width="5"/><rect x="246" y="262" width="118" height="5" fill="#e3d3b5"/>
  <g transform="translate(0 232)"><g class="cs-tram"><rect x="0" y="0" width="120" height="28" rx="6" fill="#f4e9d0"/><rect x="0" y="18" width="120" height="6" fill="#c8553d"/>${[10, 32, 54, 76, 98].map((x) => `<rect x="${x}" y="5" width="14" height="10" rx="2" fill="${LIT}"/>`).join('')}<path d="M50 0l10-10l10 10" fill="none" stroke="#b9bfd6" stroke-width="2"/><circle cx="22" cy="30" r="4" fill="#0b1a4f"/><circle cx="98" cy="30" r="4" fill="#0b1a4f"/></g></g>
  ${fade(id)}`)
}

/* ------------------------------------------------------------------ BANJA LUKA */
function banjaLuka() {
  const id = 'bl'
  let st = ''
  for (let y = 192; y < 262; y += 9) st += `<rect x="500" y="${y}" width="120" height="4" fill="#b9473a"/>`
  for (let y = 162; y < 192; y += 9) st += `<rect x="534" y="${y}" width="52" height="4" fill="#b9473a"/>`
  for (let y = 112; y < 262; y += 9) st += `<rect x="640" y="${y}" width="32" height="4" fill="#b9473a"/>`
  let merlons = ''
  for (let x = 60; x < 460; x += 16) merlons += `<rect x="${x}" y="222" width="9" height="8" fill="#b7ab98"/>`
  let blocks = ''
  const rand = rng(41)
  for (let x = 1090; x < 1580; x += 70) {
    const h = 60 + rand() * 70
    blocks += `<rect x="${x}" y="${r1(262 - h)}" width="58" height="${r1(h)}" fill="${rand() < 0.5 ? '#3b4aa0' : '#46559f'}"/>`
    for (let wy = 262 - h + 8; wy < 252; wy += 13) {
      for (let wx = x + 7; wx < x + 52; wx += 12) {
        const on = rand() < 0.5
        blocks += `<rect${on && rand() < 0.2 ? ' class="cs-flick"' : ''} x="${wx}" y="${r1(wy)}" width="6" height="7" fill="${on ? LIT : DARK_WIN}"/>`
      }
    }
  }
  const cross = (x, y) => `<path d="M${x} ${y}v-14M${x - 4} ${y - 10}h8M${x - 3} ${y - 5}l6 -2" stroke="${GOLD}" stroke-width="1.8"/>`
  return svg(`${sky(id, '#ffb86b', '#5f8cff')}${stars(43, 40, 120)}${moon(id, 1240, 64, 22)}
  ${ridge(45, 196, 34, '#2e3a8f', 120)}${ridge(47, 220, 22, '#24307f', 140)}
  ${flock(130, 60, 18)}
  ${trees(49, 0, W, () => 250, 1.2, ['#1d5a5c', '#1f6b63', '#24806b'])}
  ${blocks}
  <rect x="500" y="190" width="120" height="72" fill="#e7b56a"/>
  <rect x="534" y="160" width="52" height="32" fill="#e7b56a"/>
  <rect x="640" y="110" width="32" height="152" fill="#e7b56a"/>
  ${st}
  <rect x="590" y="160" width="30" height="102" fill="${NAVY}" opacity=".12"/><rect x="660" y="110" width="12" height="152" fill="${NAVY}" opacity=".14"/>
  <path d="M532 160A28 34 0 0 1 588 160Z" fill="${GOLD}"/><path d="M548 140a10 18 0 0 1 10-14" fill="none" stroke="#fff6cf" stroke-width="3" opacity=".7"/>${cross(560, 126)}
  <path d="M640 110A16 20 0 0 1 672 110Z" fill="${GOLD}"/>${cross(656, 90)}
  ${dome(510, 190, 10, GOLD)}${dome(610, 190, 10, GOLD)}
  <path d="M552 262v-26a8 8 0 0 1 16 0v26Z" fill="${LIT}"/><path d="M650 150v-10a6 6 0 0 1 12 0v10Z" fill="${LIT}" class="cs-flick"/>
  ${mosque(856, 262, 108, '#f6f3ea', '#8a94bb')}${dome(872, 224, 11, '#8a94bb')}${dome(948, 224, 11, '#8a94bb')}${minaret(990, 262, 176)}
  <rect x="60" y="228" width="400" height="34" fill="#b7ab98"/>${merlons}
  <rect x="96" y="200" width="54" height="62" fill="#c4b8a4"/><path d="M96 200h54v-8h-8v5h-8v-5h-7v5h-8v-5h-8v5h-7v-5h-8Z" fill="#c4b8a4"/>
  <rect x="132" y="200" width="18" height="62" fill="${NAVY}" opacity=".14"/><path d="M286 262v-20a12 12 0 0 1 24 0v20Z" fill="#3b3550"/>
  ${trees(51, 180, 440, () => 232, 0.8, ['#1f6b63', '#24806b'])}
  ${water(id, 262, '#2f8fbf', '#163f84', 53)}
  ${glint(54, 1240, 262, '#fff3d0')}
  <g transform="translate(700 278)"><g class="cs-boat"><g class="cs-bob"><path d="M-70 0Q0 12 70 0L62 6Q0 14 -62 6Z" fill="#c98b4e"/><circle cx="-24" cy="-14" r="4" fill="#0b1a4f"/><path d="M-24-10v10" stroke="#0b1a4f" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="-14" r="4" fill="#0b1a4f"/><path d="M24-10v10M14-4l26 18" stroke="#0b1a4f" stroke-width="3" stroke-linecap="round"/><path d="M-34-4l-26 18" stroke="#0b1a4f" stroke-width="3" stroke-linecap="round"/></g></g></g>
  ${fade(id)}`)
}

/* ------------------------------------------------------------------ JAJCE */
function jajce() {
  const id = 'ja'
  const leftSlope = (x) => 240 - ((x - 80) / 330) * 104
  const rightSlope = (x) => 132 + ((x - 620) / 290) * 96
  let merlons = ''
  for (let x = 420; x < 600; x += 14) merlons += `<rect x="${x}" y="86" width="8" height="8" fill="#c9bba3"/>`
  let falls = ''
  for (let x = 1046; x < 1108; x += 8) falls += `<path class="cs-fall" style="animation-delay:-${r1(((x * 7) % 9) / 10)}s" d="M${x} 176V262" stroke="#fff" stroke-width="3" stroke-dasharray="14 6" opacity=".85"/>`
  let mills = ''
  for (const [i, x] of [1180, 1240, 1300, 1370, 1430, 1500, 1560].entries()) {
    const y = 162 - (i % 2) * 4
    mills += `<path d="M${x + 3} ${y + 14}v14M${x + 21} ${y + 14}v14" stroke="#5a3a24" stroke-width="2.5"/><rect x="${x}" y="${y - 2}" width="24" height="16" fill="#8a5a34"/><rect x="${x + 14}" y="${y - 2}" width="10" height="16" fill="${NAVY}" opacity=".2"/><path d="M${x - 4} ${y - 2}L${x + 12} ${y - 22}L${x + 28} ${y - 2}Z" fill="#5a3a24"/>${i % 3 === 0 ? `<rect x="${x + 8}" y="${y + 3}" width="5" height="6" fill="${LIT}" class="cs-flick"/>` : ''}`
  }
  return svg(`${sky(id, '#ffcf7a', '#2fb8c0')}${stars(61, 30, 90)}${sun(id, 1360, 150, 20, '#ffe0a0')}
  ${ridge(63, 130, 60, '#2a3a8c', 100)}${ridge(65, 166, 36, '#21317d', 120)}
  ${flock(100, 56, 4)}${flock(126, 70, 40)}
  <path d="M60 ${H}V244Q240 210 380 132Q510 88 640 128Q780 176 920 230V${H}Z" fill="#20306f"/>
  <rect x="418" y="94" width="186" height="40" fill="#c9bba3"/>${merlons}<rect x="560" y="94" width="44" height="40" fill="${NAVY}" opacity=".14"/>
  <rect x="588" y="66" width="38" height="68" fill="#c9bba3"/><path d="M588 66h38v-8h-6v4h-7v-4h-6v4h-7v-4h-6v4h-6Z" fill="#c9bba3"/><path d="M500 134v-16a9 9 0 0 1 18 0v16Z" fill="#3b3550"/>
  ${houses(67, 120, 410, (x) => leftSlope(x) + 4, { scale: 0.75 })}${houses(68, 640, 900, (x) => rightSlope(x) + 4, { scale: 0.75 })}
  <rect x="322" y="70" width="22" height="98" fill="#d8c9ac"/><rect x="335" y="70" width="9" height="98" fill="${NAVY}" opacity=".15"/><path d="M318 70L333 34L348 70Z" fill="#5d6894"/><path d="M329 90v-8a4 4 0 0 1 8 0v8Z" fill="${LIT}"/>
  <rect x="690" y="100" width="20" height="56" fill="#e8dccb"/><path d="M686 100L700 78L714 100Z" fill="#5d6894"/><circle cx="700" cy="114" r="6" fill="#fff6dc"/><path d="M700 110v4h3" stroke="${NAVY}" stroke-width="1.4" fill="none"/>
  ${houses(69, 90, 420, (x) => Math.min(262, leftSlope(x) + 44), { scale: 0.9 })}${houses(70, 630, 920, (x) => Math.min(262, rightSlope(x) + 40), { scale: 0.9 })}
  <path d="M1110 ${H}V176H1600V${H}Z" fill="#1d2d72"/>
  ${ridge(71, 160, 22, '#24357f', 80, (x) => (x < 1100 ? -200 : 0))}
  <rect x="1110" y="174" width="490" height="16" fill="#49c3cf"/><path d="M1130 180h40M1260 184h50M1420 179h60" stroke="#fff" stroke-opacity=".6" stroke-width="2" class="cs-shim"/>
  ${mills}
  ${trees(72, 1130, 1600, () => 240, 1.1)}
  <path d="M940 ${H}V214Q980 176 1040 176H1112Q1150 186 1170 ${H}Z" fill="#555c8a"/><path d="M948 210Q985 178 1040 176H1112Q1140 180 1150 196L1132 190Q1100 182 1040 184Q990 186 948 214Z" fill="#2f8a6a"/>
  <path d="M970 240l20-12M1130 220l14 10M990 270l18-6" stroke="#3f4470" stroke-width="3"/>
  <linearGradient id="${id}-fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bff3f6"/><stop offset="1" stop-color="#fff"/></linearGradient>
  <path d="M1040 176H1112L1116 262H1036Z" fill="url(#${id}-fall)" opacity=".9"/>${falls}
  ${water(id, 258, '#2bb3c0', '#16588f', 73)}
  <ellipse class="cs-mist" cx="1054" cy="262" rx="24" ry="10" fill="#fff" opacity=".35"/><ellipse class="cs-mist" style="animation-delay:-1s" cx="1078" cy="258" rx="30" ry="12" fill="#fff" opacity=".3"/><ellipse class="cs-mist" style="animation-delay:-2s" cx="1104" cy="263" rx="22" ry="9" fill="#fff" opacity=".35"/>
  ${fade(id)}`)
}

/* ------------------------------------------------------------------ VIŠEGRAD */
function visegrad() {
  const id = 'vi'
  const x0 = 110
  const x1 = 1490
  const spans = [70, 82, 94, 106, 116, 122, 116, 106, 94, 82, 70]
  const pier = (x1 - x0 - spans.reduce((a, b) => a + b, 0)) / (spans.length + 1)
  const deck = (x) => 190 - 8 * Math.sin((Math.PI * (x - x0)) / (x1 - x0))
  let top = `M${x0} 262V${r1(deck(x0))}`
  for (let x = x0 + 40; x <= x1; x += 40) top += `L${x} ${r1(deck(x))}`
  top += `L${x1} ${r1(deck(x1))}V262Z`
  let holes = ''
  let cutwaters = ''
  let a = x0 + pier
  for (const w of spans) {
    const apex = 252 - w * 0.46
    holes += `M${r1(a)} 262V252Q${r1(a + w / 2)} ${r1(2 * apex - 252)} ${r1(a + w)} 252V262Z`
    a += w + pier
  }
  a = x0
  for (let i = 0; i <= spans.length; i++) {
    cutwaters += `<path d="M${r1(a)} 262V240L${r1(a + pier / 2)} 228L${r1(a + pier)} 240V262Z" fill="#cdb894"/>`
    a += pier + (spans[i] ?? 0)
  }
  const bridge = `${top}${holes}`
  return svg(`${sky(id, '#ffb347', '#8a63d8')}${stars(81, 24, 80)}${sun(id, 800, 176, 40, '#ffd27a')}
  ${ridge(83, 186, 26, '#3b3f95', 110)}
  <path d="M0 ${H}V56Q130 64 270 118Q430 178 640 236V${H}Z" fill="#2a2f80"/><path d="M1600 ${H}V66Q1470 74 1330 128Q1160 188 960 236V${H}Z" fill="#2a2f80"/>
  ${trees(85, 10, 600, (x) => Math.min(250, 70 + x * 0.28 + 30), 1, ['#1f5d5a', '#1a4f58', '#236a62'])}
  ${trees(86, 1010, 1590, (x) => Math.min(250, 236 - (x - 960) * 0.27 + 30), 1, ['#1f5d5a', '#1a4f58', '#236a62'])}
  ${houses(87, 1040, 1380, (x) => Math.min(244, 236 - (x - 960) * 0.27 + 46), { scale: 0.75 })}${minaret(1290, 222, 104)}
  ${houses(88, 230, 560, (x) => Math.min(244, 70 + x * 0.28 + 44), { scale: 0.75 })}
  ${flock(110, 60, 20)}${flock(146, 72, 48)}
  ${water(id, 248, '#28b39a', '#0f5f7f', 89)}
  ${glint(90, 800, 248)}
  <g transform="translate(0 504) scale(1 -1)" opacity=".2"><path d="${bridge}" fill="#e3d3b5" fill-rule="evenodd"/></g>
  <path d="${bridge}" fill="#e3d3b5" fill-rule="evenodd"/>
  ${cutwaters}
  <path d="${top.split('V262Z')[0].replace(`M${x0} 262V`, `M${x0} `)}" fill="none" stroke="#f7eedd" stroke-width="5" stroke-linecap="round" transform="translate(0 -2)"/>
  <rect x="770" y="170" width="60" height="12" fill="#e3d3b5"/><rect x="770" y="168" width="60" height="4" fill="#f7eedd"/>
  <circle cx="788" cy="162" r="3" fill="#0b1a4f"/><path d="M788 165v7" stroke="#0b1a4f" stroke-width="3" stroke-linecap="round"/>
  ${fade(id)}`)
}

/* ------------------------------------------------------------------ the set */
export const CITY_SCENES = [
  { key: 'mostar', name: 'Mostar', svg: mostar() },
  { key: 'sarajevo', name: 'Sarajevo', svg: sarajevo() },
  { key: 'banja-luka', name: 'Banja Luka', svg: banjaLuka() },
  { key: 'jajce', name: 'Jajce', svg: jajce() },
  { key: 'visegrad', name: 'Višegrad', svg: visegrad() },
]
