// Bosnian-themed illustrations, drawn as SVG strings (blue-white palette, ink outlines).
export const C = {
  ink: '#08164a',
  navy: '#0a1f63',
  blue: '#1f5fff',
  blue2: '#4f86ff',
  sky: '#a9c6ff',
  pale: '#e8f0ff',
  white: '#ffffff',
  bright: '#3d74f5',
  water: '#2c74ff',
  coral: '#ff7a8a',
  mint: '#7fe0b4',
  wood: '#c98b4e',
  bread: '#e8c7a6',
  meat: '#8a4a22',
}
const I = C.ink
const STAR = 'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z'
// animated parts sit in an inner group: the outer one carries the place in the drawing (transform attribute),
// the inner one the CSS motion, so the two never fight over the same transform
export const star = (x, y, s, fill = '#fff', cls = 'tw') => `<g transform="translate(${x} ${y}) scale(${s / 10})"><path class="${cls}" d="${STAR}" fill="${fill}"/></g>`
const r = (n) => Math.round(n * 10) / 10

// quadratic point/normal
const q = (p0, p1, p2, t) => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
]
const qn = (p0, p1, p2, t) => {
  const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
  const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
  const l = Math.hypot(dx, dy)
  return [dy / l, -dx / l]
}

// friendly eyes + smile
export function face(x, y, s = 1, mood = 'smile') {
  const e = (dx) => `<circle cx="${r(x + dx * s)}" cy="${y}" r="${r(9 * s)}" fill="#fff" stroke="${I}" stroke-width="${r(3.5 * s)}"/><circle cx="${r(x + dx * s + 2.5 * s)}" cy="${r(y + 1.5 * s)}" r="${r(4 * s)}" fill="${I}"/><circle cx="${r(x + dx * s + 4 * s)}" cy="${r(y - 1 * s)}" r="${r(1.4 * s)}" fill="#fff"/>`
  const mouth = mood === 'open'
    ? `<path d="M${r(x - 9 * s)} ${r(y + 16 * s)}Q${x} ${r(y + 32 * s)} ${r(x + 9 * s)} ${r(y + 16 * s)}Z" fill="${I}"/><path d="M${r(x - 5 * s)} ${r(y + 23 * s)}Q${x} ${r(y + 29 * s)} ${r(x + 5 * s)} ${r(y + 23 * s)}" fill="${C.coral}"/>`
    : `<path d="M${r(x - 9 * s)} ${r(y + 17 * s)}Q${x} ${r(y + 27 * s)} ${r(x + 9 * s)} ${r(y + 17 * s)}" fill="none" stroke="${I}" stroke-width="${r(4 * s)}" stroke-linecap="round"/>`
  return `${e(-14)}${e(14)}${mouth}<circle cx="${r(x - 26 * s)}" cy="${r(y + 16 * s)}" r="${r(6 * s)}" fill="${C.coral}" opacity=".55"/><circle cx="${r(x + 26 * s)}" cy="${r(y + 16 * s)}" r="${r(6 * s)}" fill="${C.coral}" opacity=".55"/>`
}
// noodle limb: ink outline + colour core
export const limb = (d, col, w = 14) => `<path d="${d}" fill="none" stroke="${I}" stroke-width="${w + 8}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
export const glove = (x, y, s = 1) => `<circle cx="${x}" cy="${y}" r="${r(13 * s)}" fill="#fff" stroke="${I}" stroke-width="4.5"/><path d="M${r(x - 5 * s)} ${r(y - 4 * s)}l${r(4 * s)} ${r(6 * s)}" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`
export const shoe = (x, y, flip = false) => `<g transform="translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}"><path d="M-22 0C-22-14-4-16 8-12C20-9 26-4 26 4C26 10 20 12 0 12C-16 12-22 9-22 0Z" fill="#fff" stroke="${I}" stroke-width="4.5"/><path d="M-20 7H24" stroke="${C.blue}" stroke-width="5"/><circle cx="-6" cy="-6" r="2.5" fill="${I}"/><circle cx="3" cy="-7" r="2.5" fill="${I}"/></g>`

/* ------------------------------------------------------------------ A: STARI MOST */
export function stariMost() {
  const A0 = [150, 612], A1 = [330, 62], A2 = [510, 612]
  // voussoir ring
  let ring = '', outer = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const [x, y] = q(A0, A1, A2, t)
    const [nx, ny] = qn(A0, A1, A2, t)
    const L = 30
    outer.push([x - nx * L, y - ny * L])
    if (i > 0 && i < 40) ring += `<line x1="${r(x)}" y1="${r(y)}" x2="${r(x - nx * L)}" y2="${r(y - ny * L)}" stroke="${I}" stroke-width="2.4" opacity=".8"/>`
  }
  const outerPath = 'M' + outer.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')
  // stone courses in the spandrels
  let courses = ''
  for (let row = 0, y = 300; y < 612; y += 20, row++) {
    courses += `<line x1="100" y1="${y}" x2="560" y2="${y}" stroke="#b9cdf7" stroke-width="2"/>`
    for (let x = 96 + (row % 2) * 22; x < 560; x += 44) courses += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 20}" stroke="#b9cdf7" stroke-width="2"/>`
  }
  // tower stones
  let tower = ''
  for (let row = 0, y = 252; y < 600; y += 22, row++) {
    tower += `<line x1="14" y1="${y}" x2="112" y2="${y}" stroke="#b9cdf7" stroke-width="2"/>`
    for (let x = 20 + (row % 2) * 18; x < 112; x += 36) tower += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 22}" stroke="#b9cdf7" stroke-width="2"/>`
  }
  const waves = [618, 640, 664, 688].map((y, i) => `<path class="wave" style="animation-delay:${i * .4}s" d="M${-20 + i * 14} ${y}q14-8 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="${.55 - i * .1}"/>`).join('')
  // majstor on the crown, waving, toolbox in hand
  const cx = 316, base = 290
  const majstor = `<g class="bob">
    ${limb(`M${cx + 22} ${base - 62}C${cx + 52} ${base - 80} ${cx + 58} ${base - 104} ${cx + 52} ${base - 122}`, C.blue)}
    ${glove(cx + 52, base - 128)}
    ${limb(`M${cx - 24} ${base - 54}C${cx - 44} ${base - 44} ${cx - 50} ${base - 30} ${cx - 50} ${base - 18}`, C.blue)}
    <rect x="${cx - 78}" y="${base - 26}" width="52" height="34" rx="6" fill="${C.bright}" stroke="${I}" stroke-width="4.5"/>
    <path d="M${cx - 64} ${base - 26}v-8h24v8" fill="none" stroke="${I}" stroke-width="4.5"/>
    <line x1="${cx - 78}" y1="${base - 12}" x2="${cx - 26}" y2="${base - 12}" stroke="${I}" stroke-width="3"/>
    ${glove(cx - 50, base - 22, .9)}
    ${limb(`M${cx - 10} ${base - 8}V${base + 4}`, C.blue, 12)}${limb(`M${cx + 12} ${base - 8}V${base + 4}`, C.blue, 12)}
    <path d="M${cx - 34} ${base - 10}C${cx - 40} ${base - 70} ${cx - 30} ${base - 112} ${cx} ${base - 112}C${cx + 30} ${base - 112} ${cx + 40} ${base - 70} ${cx + 34} ${base - 10}Z" fill="${C.blue}" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M${cx - 24} ${base - 40}h48" stroke="#fff" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round" opacity=".7"/>
    ${face(cx, base - 82, .9)}
    <path d="M${cx - 30} ${base - 112}C${cx - 30} ${base - 142} ${cx + 30} ${base - 142} ${cx + 30} ${base - 112}Z" fill="#fff" stroke="${I}" stroke-width="4.5"/>
    <rect x="${cx - 38}" y="${base - 116}" width="76" height="10" rx="5" fill="#fff" stroke="${I}" stroke-width="4.5"/>
    <path d="M${cx} ${base - 138}v20" stroke="${C.blue}" stroke-width="5"/>
    ${shoe(cx - 12, base + 6, true)}${shoe(cx + 14, base + 6)}
  </g>`
  // pomegranate branch (šipak, Herzegovina)
  const sipak = `<g transform="translate(470 520)">
    <path d="M90 -10C60 0 40 20 10 40" fill="none" stroke="${I}" stroke-width="6" stroke-linecap="round"/>
    ${[[60, 0, -30], [36, 22, 20], [74, 18, 60]].map(([x, y, a]) => `<path d="M${x} ${y}c-14-6-24-20-22-34c14 2 26 16 22 34Z" fill="${C.mint}" stroke="${I}" stroke-width="3.5" transform="rotate(${a} ${x} ${y})"/>`).join('')}
    <g class="swing-soft"><line x1="22" y1="30" x2="22" y2="46" stroke="${I}" stroke-width="4"/><circle cx="22" cy="62" r="17" fill="${C.coral}" stroke="${I}" stroke-width="4.5"/><path d="M16 46l6 6 6-6" fill="${C.coral}" stroke="${I}" stroke-width="3.5" stroke-linejoin="round"/><path d="M12 58q4-6 10-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/></g>
  </g>`
  return `<svg viewBox="0 0 560 700" xmlns="http://www.w3.org/2000/svg" class="art">
  <defs><clipPath id="towerclip"><rect x="12" y="246" width="102" height="230"/></clipPath><clipPath id="spandrel"><path d="M110 452Q330 128 552 452L552 612L510 612Q330 62 150 612L110 612Z"/></clipPath></defs>
  <!-- river Neretva -->
  <path d="M-20 600H520Q556 640 548 720H-20Z" fill="${C.water}"/>
  ${waves}
  <!-- banks -->
  <path d="M-10 430L70 440L128 496L150 612L170 720H-10Z" fill="#cfdcff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M30 520l30 14M60 580l40 6M14 640l50-10" stroke="${I}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
  <path d="M500 612L516 540L548 556L556 720H490Z" fill="#cfdcff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <!-- Tara tower -->
  <rect x="12" y="246" width="102" height="230" fill="#f4f7ff" stroke="${I}" stroke-width="5"/>
  <g clip-path="url(#towerclip)">${tower}</g>
  <path d="M0 250L63 168L126 250Z" fill="${C.blue}" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M30 230L63 188L96 230M44 248L63 222L82 248" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>
  <path d="M63 168v-22" stroke="${I}" stroke-width="5" stroke-linecap="round"/><circle cx="63" cy="142" r="6" fill="${C.bright}" stroke="${I}" stroke-width="4"/>
  <path d="M48 330v-18a15 15 0 0 1 30 0v18Z" fill="${C.navy}" stroke="${I}" stroke-width="4.5"/>
  <path d="M48 410v-18a15 15 0 0 1 30 0v18Z" fill="${C.navy}" stroke="${I}" stroke-width="4.5"/>
  <path d="M54 322v-8a9 9 0 0 1 9-8" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
  <!-- the bridge -->
  <path d="M110 452Q330 128 552 452L552 612L510 612Q330 62 150 612L110 612Z" fill="#f4f7ff"/>
  <g clip-path="url(#spandrel)">${courses}</g>
  <path d="${outerPath}" fill="none" stroke="${I}" stroke-width="3.5"/>
  ${ring}
  <path d="M110 452Q330 128 552 452L552 612L510 612Q330 62 150 612L110 612Z" fill="none" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <!-- parapet -->
  <path d="M104 446Q330 116 556 446" fill="none" stroke="${I}" stroke-width="24" stroke-linecap="round"/>
  <path d="M104 446Q330 116 556 446" fill="none" stroke="#dbe7ff" stroke-width="14" stroke-linecap="round"/>
  <path d="M104 440Q330 110 556 440" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
  ${majstor}
  ${sipak}
  ${star(250, 150, 12)}${star(420, 220, 9)}${star(200, 230, 7)}${star(470, 120, 14)}
</svg>`
}

// the Mostar diver: head-first, arms together, scarf of blue and white
export function diver() {
  const body = `<g class="dive"><g transform="translate(200 330) rotate(160)">
    ${limb('M-14 70C-18 110-16 140-20 168', C.blue, 15)}${limb('M14 70C18 110 16 140 20 168', C.blue, 15)}
    ${shoe(-22, 176, true).replace('translate(-22 176)', 'translate(-22 176) rotate(90)')}${shoe(22, 176).replace('translate(22 176)', 'translate(22 176) rotate(90)')}
    <path d="M-40 0C-44 -50 -26 -84 0 -84C26 -84 44 -50 40 0C38 40 26 76 0 76C-26 76-38 40-40 0Z" fill="${C.blue}" stroke="${I}" stroke-width="5"/>
    <path d="M-38 30C-30 46 30 46 38 30L36 52C26 74-26 74-36 52Z" fill="#fff" stroke="${I}" stroke-width="4.5"/>
    <path d="M-34 44h68" stroke="${C.blue}" stroke-width="5"/>
    <g transform="rotate(180)">${face(0, 26, .95, 'open')}</g>
    ${limb('M-30 -56C-38 -96 -20 -130 -6 -150', C.blue, 14)}${limb('M30 -56C38 -96 20 -130 6 -150', C.blue, 14)}
    ${glove(-4, -158)}${glove(6, -160)}
  </g></g>`
  const speed = [[120, 120, 90], [160, 90, 120], [200, 70, 100], [240, 110, 80]].map(([x, y, l], i) => `<path class="speed" style="animation-delay:${i * .15}s" d="M${x} ${y}v${-l}" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`).join('')
  const splash = `<g transform="translate(240 640)">
    <ellipse cx="0" cy="40" rx="150" ry="26" fill="${C.water}" stroke="${I}" stroke-width="5"/>
    <path d="M-110 36q20-10 40 0t40 0t40 0t40 0t40 0" fill="none" stroke="#fff" stroke-width="3.5" opacity=".7"/>
    <path class="splash" d="M-60 30C-70 0-60-30-44-50C-40-24-30-6-24 12C-20-20-8-50 0-70C10-44 16-14 18 10C28-14 40-30 54-40C58-10 52 14 56 30Z" fill="#fff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
    ${[[-84, -40, 9], [84, -60, 7], [-30, -96, 6], [40, -100, 8], [110, -10, 6], [-118, 0, 7]].map(([x, y, s]) => `<circle class="drop" cx="${x}" cy="${y}" r="${s}" fill="#fff" stroke="${I}" stroke-width="3.5"/>`).join('')}
  </g>`
  return `<svg viewBox="0 0 400 720" xmlns="http://www.w3.org/2000/svg" class="art">
  ${speed}${body}${splash}
  ${star(80, 240, 14)}${star(330, 200, 10)}${star(60, 420, 9)}${star(340, 470, 16)}${star(300, 330, 7)}
</svg>`
}

/* ------------------------------------------------------------------ B: BAŠČARŠIJA */
const pigeon = (x, y, s = 1, flip = false, fly = false) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><g class="${fly ? 'flap' : 'peck'}">
  ${fly ? `<path d="M-6 -6C-30 -46 -50 -40 -60 -30C-44 -24 -30 -14 -16 0Z" fill="#dbe6ff" stroke="${I}" stroke-width="4" stroke-linejoin="round"/>` : ''}
  <path d="M-34 4L-54 -4L-50 12Z" fill="#9db6ee" stroke="${I}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M-36 4C-36 -16-14-24 6-20C16-34 34-34 38-20C40-10 34 0 30 6C26 22 6 28-14 24C-28 22-36 14-36 4Z" fill="#f4f7ff" stroke="${I}" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M14 -6C12 4 6 10-2 12" fill="none" stroke="#7fd0c8" stroke-width="5" stroke-linecap="round"/>
  ${fly ? '' : `<path d="M-24 2C-14-12 4-10 10 2C0 12-14 12-24 2Z" fill="#c4d4f6" stroke="${I}" stroke-width="3.5"/><path d="M-16 4h12M-12 9h10" stroke="${I}" stroke-width="2" opacity=".6"/>`}
  <circle cx="26" cy="-20" r="3.6" fill="${I}"/><path d="M38 -18L48 -14L38 -12Z" fill="${C.bright}" stroke="${I}" stroke-width="3" stroke-linejoin="round"/>
  ${fly ? '' : `<path d="M-4 24v10M8 22v12" stroke="${C.coral}" stroke-width="4" stroke-linecap="round"/>`}
</g></g>`

export function sebilj() {
  let kaldrma = ''
  for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
    const x = i * 52 + (row % 2) * 26 - 10, y = 608 + row * 18
    kaldrma += `<ellipse cx="${x}" cy="${y}" rx="${22 - row}" ry="${8 + row * .4}" fill="${(i + row) % 3 ? '#e2ebff' : '#cfdcff'}" stroke="${I}" stroke-width="2.4"/>`
  }
  const lattice = (x, y, w, h, id) => {
    let l = ''
    for (let k = -h; k < w + h; k += 12) l += `<line x1="${x + k}" y1="${y}" x2="${x + k + h}" y2="${y + h}" stroke="#fff" stroke-width="2.2"/><line x1="${x + k + h}" y1="${y}" x2="${x + k}" y2="${y + h}" stroke="#fff" stroke-width="2.2"/>`
    return `<clipPath id="${id}"><path d="M${x} ${y + h}V${y + 24}a${w / 2} 24 0 0 1 ${w} 0V${y + h}Z"/></clipPath><path d="M${x} ${y + h}V${y + 24}a${w / 2} 24 0 0 1 ${w} 0V${y + h}Z" fill="${C.navy}"/><g clip-path="url(#${id})" opacity=".85">${l}</g><path d="M${x} ${y + h}V${y + 24}a${w / 2} 24 0 0 1 ${w} 0V${y + h}Z" fill="none" stroke="${I}" stroke-width="4"/>`
  }
  const tap = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-6" y="0" width="12" height="10" rx="3" fill="${C.bright}" stroke="${I}" stroke-width="3.5"/><path d="M0 10v6" stroke="${I}" stroke-width="4"/><path class="pour" d="M0 18v38" stroke="#8fd0ff" stroke-width="5" stroke-linecap="round"/></g>`
  // the burek mascot: rolled spiral pie with a wrench
  let swirl = 'M0 0'
  for (let a = 0; a < Math.PI * 7; a += .3) { const rad = 4 + a * 4.2; swirl += `L${r(Math.cos(a) * rad)} ${r(Math.sin(a) * rad * .62)}` }
  const burek = `<g transform="translate(118 540)"><g class="bob">
    ${limb('M44 -10C70 -24 78 -52 72 -76', C.bread)}
    <g transform="translate(72 -86) rotate(-20)"><rect x="-6" y="-40" width="12" height="52" rx="5" fill="#dfe6f5" stroke="${I}" stroke-width="4"/><path d="M-16-44a16 16 0 1 1 32 0l-8 4v-12h-16v12Z" fill="#dfe6f5" stroke="${I}" stroke-width="4" stroke-linejoin="round"/></g>
    ${glove(72, -76)}
    ${limb('M-44 0C-64 10-68 30-60 44', C.bread)}${glove(-60, 48)}
    ${limb('M-18 40V66', C.bread, 12)}${limb('M18 40V66', C.bread, 12)}
    <ellipse cx="0" cy="0" rx="62" ry="44" fill="${C.bread}" stroke="${I}" stroke-width="5"/>
    <clipPath id="burekc"><ellipse cx="0" cy="0" rx="58" ry="40"/></clipPath><path clip-path="url(#burekc)" d="${swirl}" fill="none" stroke="#c78f3c" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M-44-24q10-8 22-6M20-34q14 0 24 10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="0" cy="0" rx="62" ry="44" fill="none" stroke="${I}" stroke-width="5"/>
    ${face(0, -6, .85)}
    ${shoe(-20, 70, true)}${shoe(22, 70)}
  </g></g>`
  return `<svg viewBox="0 0 560 700" xmlns="http://www.w3.org/2000/svg" class="art">
  <!-- kaldrma -->
  <clipPath id="kal"><path d="M-10 596H500Q556 606 552 720H-10Z"/></clipPath><g clip-path="url(#kal)"><rect x="-10" y="596" width="580" height="120" fill="#cfdcff"/>${kaldrma}</g><path d="M-10 596H500Q556 606 552 720" fill="none" stroke="${I}" stroke-width="5"/>
  <!-- steps -->
  <path d="M150 600L170 584H410L430 600Z" fill="#f4f7ff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M170 584L186 570H394L410 584Z" fill="#e2ebff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <!-- basin -->
  <path d="M176 570V540H404V570Z" fill="#f4f7ff" stroke="${I}" stroke-width="5"/>
  <path d="M188 552h204" stroke="#b9cdf7" stroke-width="3"/>
  <!-- octagon: two side faces + front -->
  <path d="M196 540V380L236 360V540Z" fill="#dbe7ff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M384 540V380L344 360V540Z" fill="#dbe7ff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="236" y="360" width="108" height="180" fill="#f4f7ff" stroke="${I}" stroke-width="5"/>
  ${lattice(250, 380, 80, 110, 'lat1')}
  <path d="M206 520V408l20-10V520Z" fill="${C.navy}" stroke="${I}" stroke-width="4"/>
  <path d="M374 520V408l-20-10V520Z" fill="${C.navy}" stroke="${I}" stroke-width="4"/>
  <path d="M210 420l12-6M210 444l12-6M210 468l12-6M210 492l12-6M370 420l-12-6M370 444l-12-6M370 468l-12-6M370 492l-12-6" stroke="#fff" stroke-width="2.5" opacity=".7"/>
  <rect x="236" y="500" width="108" height="40" fill="#e2ebff" stroke="${I}" stroke-width="4"/>
  ${[260, 290, 320].map((x) => tap(x, 510)).join('')}
  <!-- eaves -->
  <path d="M150 372L196 344H384L430 372L384 382H196Z" fill="${C.blue}" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M170 368L206 352H374L410 368" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
  ${[180, 214, 248, 290, 332, 366, 400].map((x) => `<path d="M${x} 378l-4 12h8Z" fill="${C.blue}" stroke="${I}" stroke-width="3" stroke-linejoin="round"/>`).join('')}
  <!-- dome -->
  <path d="M206 344C206 270 250 228 290 228C330 228 374 270 374 344Z" fill="${C.blue2}" stroke="${I}" stroke-width="5"/>
  <path d="M236 344C236 286 260 240 290 230M344 344C344 286 320 240 290 230M290 230V344" fill="none" stroke="${I}" stroke-width="3.5"/>
  <path d="M222 320C224 290 236 266 254 250" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
  <rect x="282" y="206" width="16" height="24" rx="4" fill="${C.bright}" stroke="${I}" stroke-width="4"/>
  <circle cx="290" cy="198" r="9" fill="${C.bright}" stroke="${I}" stroke-width="4"/><path d="M290 189v-22" stroke="${I}" stroke-width="4" stroke-linecap="round"/>
  ${burek}
  ${pigeon(470, 610, 1)}${pigeon(370, 640, .85, true)}${pigeon(220, 646, .8)}
  ${pigeon(330, 170, .9, false, true)}${pigeon(130, 300, .75, true, true)}
  ${star(470, 360, 12)}${star(120, 200, 9)}${star(520, 140, 14)}${star(250, 160, 8)}
</svg>`
}

// džezva on a rope pouring kahva into a fildžan on a tray
export function dzezva() {
  let engrave = ''
  for (let i = 0; i < 7; i++) engrave += `<path d="M${-30 + i * 10} 26l5 8 5-8" fill="none" stroke="#fff" stroke-width="2.4" opacity=".8"/>`
  return `<svg viewBox="0 0 400 720" xmlns="http://www.w3.org/2000/svg" class="art">
  <g class="swing">
    <line x1="330" y1="-30" x2="236" y2="236" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(220 320) rotate(-28)">
      <path d="M40 -40C70 -60 104 -60 140 -50" fill="none" stroke="${I}" stroke-width="16" stroke-linecap="round"/>
      <path d="M40 -40C70 -60 104 -60 140 -50" fill="none" stroke="${C.wood}" stroke-width="8" stroke-linecap="round"/>
      <path d="M-40 -56H44L56 -46C58 10 60 60 40 80H-40C-60 60-58 10-56-46Z" fill="${C.blue}" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M-56 -46L-80 -62L-48 -56Z" fill="${C.blue}" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="-46" y="-64" width="96" height="14" rx="6" fill="${C.sky}" stroke="${I}" stroke-width="4.5"/>
      <path d="M-50 18H54M-46 44H50" stroke="#fff" stroke-width="3" opacity=".75"/>
      <g transform="translate(2 6)">${engrave}</g>
      ${face(0, -16, .85)}
    </g>
    <g transform="translate(236 236)">${glove(0, 0)}</g>
  </g>
  <!-- the pour -->
  <path class="pour" d="M128 296C110 330 104 380 108 430" fill="none" stroke="#5b3216" stroke-width="9" stroke-linecap="round"/>
  <!-- tray (tepsija) with fildžan, sugar and rahat-lokum -->
  <g transform="translate(120 520)"><g class="bob">
    <ellipse cx="0" cy="40" rx="110" ry="24" fill="${C.sky}" stroke="${I}" stroke-width="5"/>
    <ellipse cx="0" cy="34" rx="92" ry="17" fill="#e2ebff" stroke="${I}" stroke-width="3"/>
    <path d="M-80 34q10 8 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="${C.blue}" stroke-width="2.5" opacity=".7"/>
    <ellipse cx="-6" cy="30" rx="34" ry="8" fill="#fff" stroke="${I}" stroke-width="4"/>
    <path d="M-30 -40H18L12 8C10 20 4 26-6 26C-16 26-22 20-24 8Z" fill="#fff" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="-6" cy="-40" rx="24" ry="6" fill="#5b3216" stroke="${I}" stroke-width="4"/>
    <path d="M-26 -18H14" stroke="${C.blue}" stroke-width="5"/><path d="M-24 -6H12" stroke="${C.blue}" stroke-width="2.5"/>
    <circle cx="-16" cy="-12" r="2.4" fill="${C.blue}"/><circle cx="-6" cy="-12" r="2.4" fill="${C.blue}"/><circle cx="4" cy="-12" r="2.4" fill="${C.blue}"/>
    <path class="steam" d="M-14 -56c-8-12 8-18 0-30M2 -56c-8-12 8-18 0-30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    <rect x="34" y="6" width="22" height="18" rx="3" fill="#fff" stroke="${I}" stroke-width="3.5"/><rect x="58" y="12" width="20" height="16" rx="3" fill="#fff" stroke="${I}" stroke-width="3.5"/>
    <g transform="translate(-74 10)"><rect x="-14" y="0" width="24" height="20" rx="4" fill="#ffb3c1" stroke="${I}" stroke-width="3.5"/><rect x="6" y="6" width="24" height="20" rx="4" fill="#fff" stroke="${I}" stroke-width="3.5"/><path d="M-10 4h4M10 10h4M-4 10h3" stroke="#fff" stroke-width="2.4"/></g>
  </g></g>
  ${star(60, 180, 14)}${star(330, 420, 12)}${star(40, 380, 8)}${star(350, 600, 10)}${star(280, 120, 7)}
</svg>`
}

/* ------------------------------------------------------------------ C: ĆEVAPI I NAVIJAČI */
export function cevapi() {
  const rungs = [60, 130, 200, 270, 340, 410, 480, 550].map((y) => `<rect x="100" y="${y}" width="120" height="16" rx="6" fill="${C.blue2}" stroke="${I}" stroke-width="5"/>`).join('')
  let dots = ''
  for (let i = 0; i < 22; i++) { const a = i * 2.4, rr = 18 + (i * 37) % 60; dots += `<circle cx="${r(Math.cos(a) * rr)}" cy="${r(Math.sin(a) * rr * .5 + 30)}" r="2.6" fill="#c78f3c"/>` }
  const cevap = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-9" y="-36" width="18" height="52" rx="9" fill="${C.meat}" stroke="${I}" stroke-width="4"/><path d="M-3 -28v14M3 -6v10" stroke="#b36a3a" stroke-width="3" stroke-linecap="round"/></g>`
  return `<svg viewBox="0 0 560 700" xmlns="http://www.w3.org/2000/svg" class="art">
  <g transform="rotate(-14 170 330)">
    <rect x="88" y="10" width="24" height="640" rx="9" fill="${C.blue}" stroke="${I}" stroke-width="5"/>
    <rect x="208" y="10" width="24" height="640" rx="9" fill="${C.blue}" stroke="${I}" stroke-width="5"/>
    ${rungs}
    <!-- somun climbing -->
    <g transform="translate(330 360)">
      ${limb('M-70 -30C-100 -50 -112 -80 -110 -106', C.bread)}${glove(-110, -112)}
      ${limb('M-74 30C-100 40 -110 70 -108 92', C.bread)}${glove(-108, 98)}
      ${limb('M-30 90C-34 120 -60 140 -90 150', C.bread, 13)}${shoe(-100, 150, true)}
      ${limb('M30 90C36 130 30 160 20 190', C.bread, 13)}${shoe(14, 196)}
      <path d="M-90 -20C-90 -90 90 -90 90 -20V60C90 110-90 110-90 60Z" fill="${C.bread}" stroke="${I}" stroke-width="5"/>
      <path d="M-74 -40C-60 -66 60 -66 74 -40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
      <g transform="translate(0 0)">${dots}</g>
      <!-- the pocket full of ćevapi + luk -->
      ${[-56, -36, -16, 4, 24, 44].map((x, i) => cevap(x, -70 + (i % 2) * 6, -10 + i * 4)).join('')}
      <path d="M-82 -56C-60 -40 60 -40 82 -56" fill="${C.bread}" stroke="${I}" stroke-width="5"/>
      ${[[-50, -62], [-6, -66], [34, -60]].map(([x, y]) => `<path d="M${x} ${y}q8-14 18 0" fill="#fff" stroke="${I}" stroke-width="3"/><path d="M${x + 4} ${y - 2}q5-7 10 0" fill="none" stroke="#e6b7ff" stroke-width="2"/>`).join('')}
      ${face(0, 10, 1.05, 'open')}
    </g>
  </g>
  <!-- steam from the hot ćevapi -->
  <path class="steam" d="M300 200c-10-14 10-22 0-36M330 190c-10-14 10-22 0-36M360 200c-10-14 10-22 0-36" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
  ${star(450, 160, 14)}${star(500, 420, 10)}${star(40, 120, 9)}${star(470, 560, 12)}${star(420, 300, 7)}
</svg>`
}

// football fan on a rope: blue jersey, blue and white scarf, ball
export function navijac() {
  let scarf = ''
  const cols = [C.blue, C.bright, '#fff', C.blue, C.bright, '#fff', C.blue]
  cols.forEach((c, i) => { scarf += `<rect x="${-70 + i * 20}" y="-10" width="20" height="22" fill="${c}"/>` })
  const ball = `<g transform="translate(110 600)"><g class="spin">
    <circle r="44" fill="#fff" stroke="${I}" stroke-width="5"/>
    <path d="M0-16L15-5L9 13H-9L-15-5Z" fill="${I}"/>
    <path d="M0-16V-43M15-5L41-13M9 13L25 36M-9 13L-25 36M-15-5L-41-13" stroke="${I}" stroke-width="3.5"/>
    <path d="M-12-42L0-44L12-42L4-34H-4Z M38-24L44-6L36 2L32-14Z M-38-24L-44-6L-36 2L-32-14Z" fill="${I}"/>
    <path d="M-26-26a34 34 0 0 1 20-10" stroke="${C.sky}" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g></g>`
  return `<svg viewBox="0 0 400 720" xmlns="http://www.w3.org/2000/svg" class="art">
  <g class="swing">
    <line x1="340" y1="-30" x2="236" y2="300" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${limb('M218 372C226 330 232 310 240 296', C.blue)}${limb('M248 372C246 346 240 330 232 322', C.blue)}
    ${glove(242, 290)}${glove(230, 322)}
    ${limb('M196 540C186 580 176 610 168 628', C.blue)}${limb('M268 540C280 580 290 610 300 628', C.blue)}
    ${shoe(160, 636, true)}${shoe(306, 636)}
    <path d="M160 360C160 330 300 330 304 360L318 520C320 556 150 556 148 520Z" fill="${C.blue}" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M150 470H316" stroke="#fff" stroke-width="5"/>
    <text x="232" y="520" text-anchor="middle" font-family="'Bricolage Grotesque', Figtree, sans-serif" font-weight="900" font-size="34" fill="#fff" stroke="${I}" stroke-width="1.5">11</text>
    ${face(232, 400, 1, 'open')}
    <g transform="translate(232 452)">
      <path d="M-74 -10H74V12H-74Z" fill="#fff"/>${scarf}
      <path d="M-74 -10H74V12H-74Z" fill="none" stroke="${I}" stroke-width="4"/>
      <g class="flutter"><path d="M50 10L60 80L84 76L74 10Z" fill="${C.bright}" stroke="${I}" stroke-width="4" stroke-linejoin="round"/><path d="M54 30L80 26M58 52L82 48" stroke="${C.blue}" stroke-width="6"/><path d="M60 80l4 10M68 79l4 10M76 78l4 10" stroke="${I}" stroke-width="3" stroke-linecap="round"/></g>
    </g>
  </g>
  ${ball}
  ${star(70, 220, 14)}${star(340, 430, 12)}${star(40, 420, 8)}${star(340, 600, 9)}${star(110, 120, 7)}
</svg>`
}

// line-art skyline: mountains, Vijećnica, minaret, Stari most, Jajce falls, Banja Luka Kastel
export function skyline(w = 1440, h = 170) {
  const s = `fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" class="skyline">
  <path d="M0 120L80 70L140 100L220 40L300 96L360 64L430 110" ${s} opacity=".35"/>
  <path d="M190 62l30-22 22 18" ${s} opacity=".35"/>
  <!-- Vijećnica -->
  <g transform="translate(450 50)" opacity=".55"><path d="M0 120V30H160V120M0 30L20 10H140L160 30M60 10V-10H100V10" ${s}/>${[20, 60, 100, 140].map((x) => `<path d="M${x - 10} 120V80a10 10 0 0 1 20 0V120" ${s}/><path d="M${x - 10} 70h20M${x - 10} 62h20" ${s}/>`).join('')}<path d="M10 50H150" ${s} stroke-dasharray="6 6"/></g>
  <!-- minaret -->
  <g transform="translate(660 0)" opacity=".55"><path d="M0 170V50H16V170M-4 50h24M8 50L8 6L0 30H16L8 6" ${s}/><path d="M-6 90h28" ${s}/></g>
  <!-- Stari most -->
  <g transform="translate(720 70)" opacity=".55"><path d="M0 100L20 40H40Q120-40 200 40H220L240 100M40 100Q120 6 200 100" ${s}/><path d="M14 40V0L28-16L42 0V40" ${s}/></g>
  <!-- Jajce waterfall -->
  <g transform="translate(1000 40)" opacity=".55"><path d="M0 40H90L110 130M0 40V10L20 -6L40 10V40M60 40V20h20v20" ${s}/>${[96, 106, 116, 126].map((x, i) => `<path class="fall" style="animation-delay:${i * .2}s" d="M${x} 50V130" ${s} stroke-dasharray="10 8"/>`).join('')}</g>
  <!-- Kastel -->
  <g transform="translate(1180 70)" opacity=".55"><path d="M0 100V20H140V100M0 20V8h14v12M28 20V8h14v12M56 20V8h14v12M84 20V8h14v12M112 20V8h14v12M126 20V8h14" ${s}/><path d="M60 100V70a10 10 0 0 1 20 0V100" ${s}/></g>
  <path d="M1340 120L1400 80L1460 120" ${s} opacity=".35"/>
  <path d="M0 168H${w}" ${s} opacity=".4"/>
</svg>`
}
