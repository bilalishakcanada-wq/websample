// Daytime view over the Neretva: Stari Most, stone houses with red roofs, the mountains behind.
// Sits at the bottom of the chat as its backdrop; the sky above stays clear for the messages.
const W = 1200
const H = 340
const INK = '#08164a'
const STONE = '#efe2c6'
const STONE_DARK = '#d6c196'
const ROOF = '#e0603f'
const ROOF_DARK = '#b8462c'
const WALL = '#ffffff'
const TREE = '#2f9e6e'
const TREE_DARK = '#237a55'

/** small deterministic random numbers, so the town looks the same on every visit */
function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function house(x, base, w, h, rand) {
  const roof = 10 + rand() * 8
  const win = w > 26 ? `<rect x="${x + 6}" y="${base - h + 8}" width="6" height="8" rx="1" fill="${INK}" opacity=".75"/><rect x="${x + w - 12}" y="${base - h + 8}" width="6" height="8" rx="1" fill="${INK}" opacity=".75"/>`
    : `<rect x="${x + w / 2 - 3}" y="${base - h + 8}" width="6" height="8" rx="1" fill="${INK}" opacity=".75"/>`
  return `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${WALL}" stroke="${INK}" stroke-width="2.5"/>${win}`
    + `<path d="M${x - 4} ${base - h}L${x + w / 2} ${base - h - roof}L${x + w + 4} ${base - h}Z" fill="${rand() > 0.5 ? ROOF : ROOF_DARK}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`
}

function town(from, to, base, seed) {
  const rand = rng(seed)
  let out = ''
  for (let x = from; x < to;) {
    const w = 22 + Math.round(rand() * 18)
    const h = 20 + Math.round(rand() * 22)
    const lift = Math.round(rand() * 14)
    out += house(x, base - lift, w, h, rand)
    if (rand() > 0.6) out += `<ellipse cx="${x + w + 7}" cy="${base - lift - 16}" rx="7" ry="18" fill="${rand() > 0.5 ? TREE : TREE_DARK}" stroke="${INK}" stroke-width="2"/>`
    x += w + 10 + Math.round(rand() * 10)
  }
  return out
}

const tower = (x) => `<rect x="${x}" y="196" width="46" height="104" fill="${STONE}" stroke="${INK}" stroke-width="3"/>
  <path d="M${x - 6} 198L${x + 23} 166L${x + 52} 198Z" fill="${ROOF}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="${x + 18}" y="214" width="10" height="16" rx="5" fill="${INK}" opacity=".8"/>
  <path d="M${x} 250H${x + 46}" stroke="${STONE_DARK}" stroke-width="3"/>`

const cloud = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 20C0 9 10 2 20 6C25-4 42-4 47 6C58 2 70 10 68 22H0Z" fill="#fff" opacity=".95"/>`

const bird = (x, y) => `<path d="M${x - 8} ${y}q4-6 8 0q4-6 8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`

export function chatScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
  <circle cx="930" cy="120" r="82" fill="#ffe7a8" opacity=".55"/>
  <circle cx="930" cy="120" r="46" fill="#ffd27a"/>
  ${cloud(170, 70, 1.3)}${cloud(640, 40, 1)}${cloud(1040, 150, 0.9)}
  ${bird(330, 110)}${bird(356, 96)}${bird(700, 130)}
  <path d="M0 230L90 170L170 200L260 128L360 190L450 150L560 200L660 138L760 185L860 116L980 190L1080 150L1200 190V${H}H0Z" fill="#b9cdf7"/>
  <path d="M245 140L260 128L276 141L268 138L260 144L252 138ZM646 150L660 138L676 151L667 148L660 154L652 148ZM846 128L860 116L876 129L867 126L860 132L852 126Z" fill="#fff"/>
  <path d="M0 262C150 222 260 252 380 236C520 216 640 256 800 240C950 225 1080 250 1200 236V${H}H0Z" fill="#7fa3f0"/>
  <path d="M0 286C120 256 260 266 430 276L470 ${H}H0Z" fill="#3f6fe0"/>
  <path d="M770 276C900 256 1060 262 1200 272V${H}H730Z" fill="#3f6fe0"/>
  ${town(20, 380, 282, 7)}
  ${town(830, 1180, 280, 31)}
  <path d="M430 300C520 312 680 312 770 300L820 ${H}H380Z" fill="#4fc7c9"/>
  <path d="M470 318q15-6 30 0t30 0M620 326q15-6 30 0t30 0M540 334q15-6 30 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>
  <path d="M436 300V236Q600 186 764 236V300H748Q600 172 452 300Z" fill="${STONE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M452 300Q600 172 748 300" fill="none" stroke="${STONE_DARK}" stroke-width="6" transform="translate(0 -7)"/>
  <path d="M436 236Q600 186 764 236" fill="none" stroke="${INK}" stroke-width="3"/>
  ${tower(390)}${tower(764)}
</svg>`
}

export const chatSceneUrl = `url("data:image/svg+xml,${encodeURIComponent(chatScene())}")`
