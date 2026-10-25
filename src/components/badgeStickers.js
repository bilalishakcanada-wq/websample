// Badges as hand-drawn stickers: a line drawing in one ink, flat colour printed a hair off the line,
// grainy paper, a scissor-cut white edge and a slight tilt, like a small print shop sticker.
// Each badge (badges.code) has its own drawing and colours; a badge added from the admin panel
// without one gets the drawing for its icon name, or a plain medal in its own colour.

const L = '#1d2c7a' // line ink
const P = '#fffdf8' // paper
const TIER_TAB = { bronze: ['BRONZA', 1], silver: ['SREBRO', 2], gold: ['ZLATO', 3], platinum: ['PLATINA', 4] }

const star = (cx, cy, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1) } return d + 'Z' }
const STAR_ARC = [[20, 44, 8], [33, 30, 9], [50, 24, 11], [67, 30, 9], [80, 44, 8]]
const ROSETTE = (() => { let d = ''; const n = 14; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; const a2 = a - Math.PI / n; if (!i) d = `M${(50 + 21 * Math.cos(a)).toFixed(1)} ${(38 + 21 * Math.sin(a)).toFixed(1)}`; else d += `Q${(50 + 28 * Math.cos(a2)).toFixed(1)} ${(38 + 28 * Math.sin(a2)).toFixed(1)} ${(50 + 21 * Math.cos(a)).toFixed(1)} ${(38 + 21 * Math.sin(a)).toFixed(1)}` } return d + 'Z' })()

// ink(c, c2, ht) = flat colour shapes (ht = halftone of the main ink); line = thick outlines; thin = finer detail
const DRAW = {
  verified: {
    ink: (c, c2) => `<path d="M40 56l-8 26 8-4 5 7 5-25zM60 56l8 26-8-4-5 7-5-25z" fill="${c2}"/><path d="${ROSETTE}" fill="${c}"/><circle cx="50" cy="38" r="16" fill="${P}"/>`,
    line: `<path d="M40 56l-8 26 8-4 5 7 5-25M60 56l8 26-8-4-5 7-5-25"/><path d="${ROSETTE}"/><circle cx="50" cy="38" r="16"/><path d="M42 38.5l5.5 5.5 11-12"/>`,
    thin: `<path d="M16 22l4 3M84 22l-4 3M14 44h5M81 44h5" />`,
  },
  jobs50: {
    ink: (c, c2, ht) => `<rect x="16" y="44" width="68" height="34" rx="4" fill="${c}"/><rect x="16" y="44" width="68" height="9" fill="${ht}"/><rect x="40" y="58" width="20" height="13" rx="2" fill="${P}"/><path d="M60 18l14 14-4 4-14-14z" fill="${c2}"/>`,
    line: `<rect x="16" y="44" width="68" height="34" rx="4"/><path d="M16 53h68"/><path d="M38 44v-6a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v6"/><path d="M60 18l14 14-4 4-14-14zM62 28L48 42"/><path d="M28 44V24l3-6 3 6v20"/><rect x="40" y="58" width="20" height="13" rx="2"/>`,
    thin: `<text x="50" y="68.5" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="10" fill="${L}" stroke="none">50</text><path d="M24 64v8M76 64v8"/>`,
  },
  stars5: {
    ink: (c, c2) => `${STAR_ARC.map(([x, y, r]) => `<path d="${star(x, y, r)}" fill="${c}"/>`).join('')}<path d="M26 74q24 10 48 0" stroke="${c2}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    line: `${STAR_ARC.map(([x, y, r]) => `<path d="${star(x, y, r)}"/>`).join('')}`,
    thin: `<text x="50" y="67" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="19" fill="${L}" stroke="none">5,0</text>`,
  },
  gas: {
    ink: (c, c2, ht) => `<path d="M50 12c6 9 16 15 16 28a16 16 0 0 1-32 0c0-8 5-13 8-17 2 6 4 8 6 8 0-7-1-12 2-19z" fill="${c}"/><path d="M50 36c-4 4-6 7-6 11a6 6 0 0 0 12 0c0-4-2-7-6-11z" fill="${c2}"/><ellipse cx="50" cy="70" rx="30" ry="8" fill="${ht}"/>`,
    line: `<path d="M50 12c6 9 16 15 16 28a16 16 0 0 1-32 0c0-8 5-13 8-17 2 6 4 8 6 8 0-7-1-12 2-19z"/><ellipse cx="50" cy="70" rx="30" ry="8"/><path d="M28 64l-6-8M72 64l6-8M50 62v-6"/>`,
    thin: `<path d="M50 36c-4 4-6 7-6 11a6 6 0 0 0 12 0c0-4-2-7-6-11z"/><path d="M36 70h28" stroke-dasharray="2 3"/>`,
  },
  hvac: {
    ink: (c, c2, ht) => `<rect x="12" y="20" width="76" height="28" rx="8" fill="${c}"/><rect x="12" y="40" width="76" height="8" rx="4" fill="${ht}"/><circle cx="76" cy="30" r="3" fill="#2fbf8f"/>`,
    line: `<rect x="12" y="20" width="76" height="28" rx="8"/><path d="M20 42h60"/>`,
    thin: `<path d="M24 56q4 6 0 12t0 12M40 56q4 6 0 12t0 12M56 56q4 6 0 12t0 12M72 56q4 6 0 12t0 12" stroke-dasharray="3 3"/>
      <path d="M22 30h6M25 27v6M22.8 27.8l4.4 4.4M27.2 27.8l-4.4 4.4" stroke-width="1.4"/><circle cx="76" cy="30" r="3"/>`,
  },
  construction: {
    ink: (c, c2) => `<path d="M10 70h80v14H10zM10 56h80v14H10z" fill="${c2}"/><path d="M24 44a26 22 0 0 1 52 0z" fill="${c}"/><rect x="18" y="44" width="64" height="6" rx="2" fill="${c}"/>`,
    line: `<path d="M24 44a26 22 0 0 1 52 0"/><rect x="18" y="44" width="64" height="6" rx="2"/><path d="M44 23v-4h12v4"/><path d="M10 56h80v28H10z"/>`,
    thin: `<path d="M10 70h80M30 56v14M54 56v14M78 56v14M20 70v14M42 70v14M66 70v14"/><path d="M50 24v18" />`,
  },
  car: {
    ink: (c) => `<path d="M12 60V50l10-2 10-14h30l12 14 14 3v9z" fill="${c}"/><path d="M36 37h11v12H28zM52 37h9l9 12H52z" fill="${P}"/><circle cx="28" cy="62" r="8" fill="${L}"/><circle cx="72" cy="62" r="8" fill="${L}"/>`,
    line: `<path d="M12 60V50l10-2 10-14h30l12 14 14 3v9H80M64 60H36M20 60h-8"/><path d="M36 37h11v12H28zM52 37h9l9 12H52z"/><circle cx="28" cy="62" r="8"/><circle cx="72" cy="62" r="8"/>`,
    thin: `<circle cx="28" cy="62" r="2.5" stroke="${P}"/><circle cx="72" cy="62" r="2.5" stroke="${P}"/><path d="M8 76h20M40 76h20M72 76h20" stroke-dasharray="6 5"/><path d="M84 52h4"/>`,
  },
  toprated: {
    ink: (c, c2, ht) => `<path d="${star(50, 44, 32)}" fill="${c}"/><path d="M50 12l9 19 21 3-15 15 4 21-19-10z" fill="${ht}"/>`,
    line: `<path d="${star(50, 44, 32)}"/>`,
    thin: `<text x="50" y="52" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="10" fill="${L}" stroke="none">4,8+</text><path d="M14 16v6M11 19h6M86 70v6M83 73h6" stroke-width="1.4"/>`,
  },
  gem: {
    ink: (c, c2, ht) => `<path d="M30 22h40l14 16-34 40-34-40z" fill="${c}"/><path d="M50 78l-12-40h24z" fill="${ht}"/><path d="M30 22l8 16H16z" fill="${P}" opacity=".7"/>`,
    line: `<path d="M30 22h40l14 16-34 40-34-40z"/><path d="M16 38h68M38 38l12 40 12-40M38 38l-8-16M62 38l8-16M38 38l12-16 12 16"/>`,
    thin: `<path d="M84 16v8M80 20h8M16 64v6M13 67h6M78 60l3 3" stroke-width="1.4"/>`,
  },
  veteran: {
    ink: (c, c2) => `<path d="M34 10h12l6 24H40zM54 10h12l-6 24H48z" fill="${c2}"/><circle cx="50" cy="54" r="22" fill="${c}"/><circle cx="50" cy="54" r="15" fill="${P}"/>`,
    line: `<path d="M34 10h12l6 24M66 10H54l-6 24"/><circle cx="50" cy="54" r="22"/><circle cx="50" cy="54" r="15"/>`,
    thin: `<path d="M38 10l6 22M62 10l-6 22"/><text x="50" y="59" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="12" fill="${L}" stroke="none">20+</text>`,
  },
  police: {
    ink: (c, c2) => `<g transform="rotate(-6 46 46)"><rect x="24" y="14" width="44" height="60" rx="3" fill="${P}"/><rect x="24" y="14" width="44" height="10" fill="${c}"/></g><circle cx="66" cy="66" r="13" fill="${c2}"/>`,
    line: `<g transform="rotate(-6 46 46)"><rect x="24" y="14" width="44" height="60" rx="3"/><path d="M24 24h44"/></g><circle cx="66" cy="66" r="13"/>`,
    thin: `<g transform="rotate(-6 46 46)"><path d="M31 32h30M31 38h30M31 44h22M31 50h26M31 56h14"/></g>
      <path d="M66 58v14M60 61h12M60 61l-3 6h6zM72 61l-3 6h6zM62 72h8" stroke="${P}" stroke-width="1.5"/>`,
  },
  reliable: {
    ink: (c, c2) => `<rect x="16" y="20" width="68" height="58" rx="5" fill="${P}"/><rect x="16" y="20" width="68" height="13" rx="5" fill="${c}"/><rect x="52" y="54" width="14" height="12" fill="${c2}"/>`,
    line: `<rect x="16" y="20" width="68" height="58" rx="5"/><path d="M16 33h68M32 14v12M68 14v12"/>`,
    thin: `<path d="M16 48h68M16 62h68M33 33v45M50 33v45M67 33v45"/><path d="M20 40l3 3 6-6M37 40l3 3 6-6M54 40l3 3 6-6M71 40l3 3 6-6M20 54l3 3 6-6M37 54l3 3 6-6M54 58l3 3 6-6" />`,
  },
  localhero: {
    ink: (c, c2) => `<path d="M14 80V62l10-8 10 8v18zM60 80V58l12-10 12 10v22z" fill="${c2}"/><path d="M50 10a15 15 0 0 1 15 15c0 12-15 26-15 26S35 37 35 25a15 15 0 0 1 15-15z" fill="${c}"/><circle cx="50" cy="25" r="5" fill="${P}"/>`,
    line: `<path d="M14 80V62l10-8 10 8v18M60 80V58l12-10 12 10v22M34 80h26M8 80h84"/><path d="M50 10a15 15 0 0 1 15 15c0 12-15 26-15 26S35 37 35 25a15 15 0 0 1 15-15z"/><circle cx="50" cy="25" r="5"/>`,
    thin: `<path d="M21 68h6v6h-6zM68 64h8v7h-8z"/><path d="M40 62q10 6 20 0" stroke-dasharray="2 3"/>`,
  },
  payment: {
    ink: (c, c2) => `<g transform="rotate(-8 44 46)"><rect x="12" y="26" width="58" height="38" rx="5" fill="${c}"/><rect x="12" y="34" width="58" height="8" fill="${L}"/></g><circle cx="70" cy="62" r="15" fill="${c2}"/>`,
    line: `<g transform="rotate(-8 44 46)"><rect x="12" y="26" width="58" height="38" rx="5"/></g><circle cx="70" cy="62" r="15"/>`,
    thin: `<g transform="rotate(-8 44 46)"><path d="M18 52h14M18 57h8"/><rect x="42" y="48" width="10" height="7" rx="1.5"/></g><circle cx="70" cy="62" r="11" stroke-dasharray="2 2.4"/>
      <text x="70" y="66" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="10" fill="${L}" stroke="none">KM</text>`,
  },
  trusted: {
    ink: (c, c2, ht) => `<path d="M6 44l14-14 12 6 8 22-12 10z" fill="${c}"/><path d="M94 44L80 30l-16 4-10 18 16 16z" fill="${ht}"/><path d="M50 26c-3-6-12-6-12 1 0 6 12 12 12 12s12-6 12-12c0-7-9-7-12-1z" fill="${c2}"/>`,
    line: `<g transform="translate(14 22) scale(3)" stroke-width=".9"><path d="M11 17l2 2a1 1 0 1 0 3-3"/><path d="M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="M21 3l1 11h-2"/><path d="M3 3L2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></g>`,
    thin: `<path d="M50 26c-3-6-12-6-12 1 0 6 12 12 12 12s12-6 12-12c0-7-9-7-12-1z" transform="translate(0 -14)"/>`,
  },
  sprout: {
    ink: (c, c2) => `<path d="M30 58h40l-5 24H35z" fill="${c}"/><path d="M50 40c-12 0-18-7-18-18 12 0 18 7 18 18zM50 34c0-11 7-18 19-18 0 11-7 18-19 18z" fill="${c2}"/>`,
    line: `<path d="M27 58h46v6H27zM30 64l5 18h30l5-18"/><path d="M50 58V30"/><path d="M50 40c-12 0-18-7-18-18 12 0 18 7 18 18zM50 34c0-11 7-18 19-18 0 11-7 18-19 18z"/>`,
    thin: `<path d="M80 50V22M74 28l6-6 6 6"/><path d="M38 28q6 4 12 12M62 22q-6 4-12 12"/>`,
  },
  jobs5: {
    ink: (c) => `<g transform="rotate(-35 46 40)"><rect x="30" y="16" width="34" height="13" rx="3" fill="${c}"/><rect x="43" y="29" width="8" height="38" rx="3" fill="#e0a764"/></g>`,
    line: `<g transform="rotate(-35 46 40)"><rect x="30" y="16" width="34" height="13" rx="3"/><rect x="43" y="29" width="8" height="38" rx="3"/></g>`,
    thin: `<path d="M60 58v20M66 58v20M72 58v20M78 58v20M56 72l26-10" stroke-width="2.2"/><path d="M16 64l4 2M14 72h5" />`,
  },
  email: {
    ink: (c, c2, ht) => `<rect x="12" y="24" width="64" height="44" rx="4" fill="${c}"/><path d="M12 26l32 22 32-22z" fill="${ht}"/><circle cx="72" cy="64" r="13" fill="${c2}"/>`,
    line: `<rect x="12" y="24" width="64" height="44" rx="4"/><path d="M12 27l32 22 32-22"/><path d="M72 51c5 0 10 2 12 6s1 10-2 13-9 5-14 3-8-6-8-11 6-11 12-11z"/>`,
    thin: `<path d="M66.5 64.5l3.5 3.5 7-7.5" stroke="${P}" stroke-width="2.4"/>`,
  },

  id: {
    ink: (c, c2, ht) => `<g transform="rotate(-7 50 50)">
        <rect x="16" y="30" width="64" height="42" rx="5" fill="${c}"/>
        <rect x="16" y="64" width="64" height="8" fill="${ht}"/>
        <rect x="23" y="40" width="19" height="23" rx="2" fill="${P}"/>
        <circle cx="66" cy="57" r="6" fill="${c2}"/></g>`,
    line: `<g transform="rotate(-7 50 50)"><rect x="16" y="30" width="64" height="42" rx="5"/><rect x="23" y="40" width="19" height="23" rx="2"/></g>`,
    thin: `<g transform="rotate(-7 50 50)"><path d="M16 36.5h64"/><circle cx="32.5" cy="48" r="4.6"/><path d="M26 62.5c1.2-6.5 12-6.5 13 0"/>
        <path d="M30.6 49.2q1.9 1.6 3.8 0M31 46.6v.2M34 46.6v.2"/>
        <path d="M47 43h25M47 48.5h20M47 54h12"/><path d="M47 63c3-4 4.5 2.5 7.5-1s3.5 2 6 0"/>
        <circle cx="66" cy="57" r="6"/><path d="M63 57.5l2 2 4-4"/>
        <path d="M22 33.5h2M27 33.5h9" stroke-width="1.2"/></g>`,
  },
  bulb: {
    ink: (c, c2, ht) => `<path d="M50 14c-13 0-21 9.5-21 20 0 7.5 4.5 11.5 7.5 14.5 2 2 3 5 3 8h21c0-3 1-6 3-8 3-3 7.5-7 7.5-14.5 0-10.5-8-20-21-20z" fill="${c}"/>
        <path d="M60 18c6 3 11 9 11 16 0 7.5-4.5 11.5-7.5 14.5-2 2-3 5-3 8h-5c0-3 1-6 3-8 3-3 7-7 7-14.5 0-6-2.5-12-5.5-16z" fill="${ht}"/>
        <path d="M84 23l-3 3.5h3.5l-3 3.5zM14 22l3 2.5h-3l3 3z" fill="${c2}" stroke="${c2}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M37 27q2.5-6.5 9-8.5" stroke="${P}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`,
    line: `<path d="M50 14c-13 0-21 9.5-21 20 0 7.5 4.5 11.5 7.5 14.5 2 2 3 5 3 8h21c0-3 1-6 3-8 3-3 7.5-7 7.5-14.5 0-10.5-8-20-21-20z"/>
        <path d="M39.5 57h21v4.5h-21zM40.5 61.5h19v4.5h-19zM43 66h14l-2 4.5h-10z"/>
        <path d="M50 71c0 5-8 4.5-8 10 0 4.5 7 4.5 7 0s-9-3.5-12 2.5"/>`,
    thin: `<path d="M44 57l2-13.5 4 5 4-5 2 13.5"/>
        <path d="M50 3.5v5M24.5 11l3.5 3.5M75.5 11L72 14.5M15.5 33h5M79.5 33h5M20 52l4-2M80 52l-4-2"/>
        <path d="M84 23l-3 3.5h3.5l-3 3.5M14 22l3 2.5h-3l3 3"/>`,
  },
  pipe: {
    ink: (c, c2, ht) => `<path d="M8 38h30a15 15 0 0 1 15 15v12H41V54a4 4 0 0 0-4-4H8z" fill="${c}"/>
        <path d="M41 58h12v7H41z" fill="${ht}"/>
        <circle cx="28" cy="25" r="8" fill="${c2}"/>
        <path d="M47 71s-5 6-5 9.5a5 5 0 0 0 10 0c0-3.5-5-9.5-5-9.5z" fill="${c}"/>
        <ellipse cx="48" cy="88" rx="16" ry="3" fill="${ht}"/>`,
    line: `<path d="M8 38h30a15 15 0 0 1 15 15v12M8 50h29a4 4 0 0 1 4 4v11"/>
        <path d="M38.5 65h17v4h-17z"/><path d="M17 35v18M21.5 35v18"/>
        <circle cx="28" cy="25" r="8"/><path d="M28 33v5"/>
        <path d="M47 71s-5 6-5 9.5a5 5 0 0 0 10 0c0-3.5-5-9.5-5-9.5z"/>
        <path transform="translate(62 72) rotate(-58)" d="M0 -3.2H29A8 8 0 0 1 43.5 -3.5H37V3.5H43.5A8 8 0 0 1 29 3.2H0A3.2 3.2 0 0 1 0 -3.2Z"/>`,
    thin: `<path d="M28 17v16M20 25h16M22.5 19.5l11 11M33.5 19.5l-11 11"/><circle cx="28" cy="25" r="2.2"/>
        <path d="M45 78.5a2.5 2.5 0 0 0 1.5 2.6"/><path d="M60 80s-2.5 3.2-2.5 5a2.5 2.5 0 0 0 5 0c0-1.8-2.5-5-2.5-5z"/>
        <circle cx="64.5" cy="67.5" r="1.6" />`,
  },
  bridge: {
    ink: (c, c2, ht) => `<circle cx="67" cy="24" r="10" fill="${c}"/>
        <path d="M6 67h88v18c-14 6-30 8-44 8s-30-2-44-8z" fill="${c2}"/>
        <path d="M6 75h88v10c-14 6-30 8-44 8s-30-2-44-8z" fill="url(#HT2)"/>
        <path d="M27 66Q31 45 50 39Q69 45 73 66z" fill="${ht}"/>`,
    line: `<path d="M17 46Q34 40 50 30Q66 40 83 46"/><path d="M27 66Q31 45 50 39Q69 45 73 66"/>
        <path d="M17 46v20M83 46v20"/>
        <path d="M8 66V31h11v35M8 31l5.5-9 5.5 9"/>
        <path d="M82 66V36h10v30M81 36q6-11 12 0"/>
        <path d="M4 66.5h21M75 66.5h21"/>
        <circle cx="50" cy="14.5" r="2.7"/>`,
    thin: `<path d="M18 43Q34 37 50 27.3Q66 37 82 43"/>
        <path d="M33 52l-4-2.5M38 46.5l-3-3.2M44 42.5l-1.5-3.5M50 41v-3.5M56 42.5l1.5-3.5M62 46.5l3-3.2M67 52l4-2.5"/>
        <path d="M11.5 38h4v5h-4zM85 42h4v5h-4zM11.5 50h4M85 54h4"/>
        <path d="M50 17.5v6.5M41.5 18.5q4.5 2.6 8.5 2 4 .6 8.5-2M50 24l-2.6 3.4M50 24l2.6 3.4"/>
        <path d="M12 73q5-2 10 0t10 0M44 77q5-2 10 0t10 0M70 72q5-2 10 0t10 0M26 83q5-2 10 0t10 0"/>`,
  },
  plane: {
    ink: (c, c2, ht) => `<path d="M26 48L84 22 52 57z" fill="${c}"/><path d="M52 57l-2 15 9-8.5z" fill="${ht}"/><path d="M84 22L66 75 52 57z" fill="${ht}"/>
        <circle cx="20" cy="27" r="3" fill="${c2}"/><circle cx="80" cy="74" r="2.4" fill="${c2}"/>`,
    line: `<path d="M26 48L84 22 66 75 52 57z"/><path d="M84 22L52 57l-2 15 9-8.5"/>`,
    thin: `<path d="M24 63c-13 5-13-11-3-9.5s5 15-7 17" stroke-dasharray="3 3.6"/>
        <path d="M10 44h9M13 50h7M7 56h8"/>
        <path d="M20 22v10M15 27h10M80 69.5v9M75.5 74h9" stroke-width="1.4"/>`,
  },
  phone: {
    ink: (c, c2, ht) => `<g transform="rotate(-8 40 52)"><rect x="24" y="24" width="32" height="57" rx="6" fill="${L}"/><rect x="28" y="33" width="24" height="38" rx="2" fill="${P}"/>
        <rect x="31" y="37" width="14" height="6" rx="3" fill="${c}"/><rect x="35" y="46" width="14" height="6" rx="3" fill="${ht}"/><rect x="31" y="55" width="10" height="6" rx="3" fill="${c}"/></g>
        <path d="M57 15h27a6 6 0 0 1 6 6v13a6 6 0 0 1-6 6H67l-8 7v-7h-2a6 6 0 0 1-6-6V21a6 6 0 0 1 6-6z" fill="${c}"/>
        <circle cx="62" cy="68" r="8.5" fill="${c2}"/>`,
    line: `<g transform="rotate(-8 40 52)"><rect x="24" y="24" width="32" height="57" rx="6"/></g>
        <path d="M57 15h27a6 6 0 0 1 6 6v13a6 6 0 0 1-6 6H67l-8 7v-7h-2a6 6 0 0 1-6-6V21a6 6 0 0 1 6-6z"/>
        <circle cx="62" cy="68" r="8.5"/>`,
    thin: `<g transform="rotate(-8 40 52)"><path d="M36 28.5h8" stroke="${P}"/><circle cx="40" cy="76" r="1.6" stroke="${P}"/></g>
        <path d="M58 68.5l2.6 2.6 5-5.4"/>
        <path d="M16 40q-4 6 0 12M11 37q-6 9 0 18M70 52q4 3 3 8"/>
        <text x="70.5" y="32" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="12.5" fill="${L}" stroke="none">ok!</text>`,
  },
  medal: {
    ink: (c, c2) => `<path d="M34 10h12l6 24H40zM54 10h12l-6 24H48z" fill="${c2}"/><circle cx="50" cy="54" r="22" fill="${c}"/><circle cx="50" cy="54" r="15" fill="${P}"/><path d="${star(50, 54, 9)}" fill="${c}"/>`,
    line: `<path d="M34 10h12l6 24M66 10H54l-6 24"/><circle cx="50" cy="54" r="22"/><circle cx="50" cy="54" r="15"/>`,
    thin: `<path d="M38 10l6 22M62 10l-6 22"/><path d="${star(50, 54, 9)}"/>`,
  },
}

const BY_CODE = {
  verified: { draw: 'verified', ink: '#3f7bff', ink2: '#ff5a4f', tint: '#e3ecff', tilt: 3, seed: 71 },
  id_verified: { draw: 'id', ink: '#ff5fb7', ink2: '#ffc93c', tint: '#ffe6f3', tilt: -4, seed: 3 },
  jobs_50: { draw: 'jobs50', ink: '#ff5a4f', ink2: '#ffcf1f', tint: '#ffe4e1', tilt: 2, seed: 72 },
  five_star_50: { draw: 'stars5', ink: '#ffcf1f', ink2: '#ff5fb7', tint: '#fff6cc', tilt: -3, seed: 73 },
  licence_electrician: { draw: 'bulb', ink: '#ffcf1f', ink2: '#ff7a3d', tint: '#fff6cc', tilt: 3, seed: 7 },
  licence_plumber: { draw: 'pipe', ink: '#3fb8e8', ink2: '#ff5a4f', tint: '#e0f4fc', tilt: -2, seed: 11 },
  licence_gas: { draw: 'gas', ink: '#ff8a3d', ink2: '#ffcf1f', tint: '#ffeadb', tilt: 2, seed: 74 },
  licence_hvac: { draw: 'hvac', ink: '#3fb8e8', ink2: '#ff8a3d', tint: '#e0f4fc', tilt: -3, seed: 75 },
  licence_construction: { draw: 'construction', ink: '#ffcf1f', ink2: '#ff8a3d', tint: '#fff2d6', tilt: 3, seed: 76 },
  licence_driver: { draw: 'car', ink: '#ff5a4f', ink2: '#ffcf1f', tint: '#ffe4e1', tilt: -2, seed: 77 },
  police_check: { draw: 'police', ink: '#3f7bff', ink2: '#ff5a4f', tint: '#e3ecff', tilt: 2, seed: 78 },
  top_rated: { draw: 'toprated', ink: '#ffcf1f', ink2: '#ff8a3d', tint: '#fff6cc', tilt: -4, seed: 79 },
  flawless: { draw: 'gem', ink: '#21b3a1', ink2: '#ff5fb7', tint: '#dcf5f1', tilt: 3, seed: 80 },
  veteran: { draw: 'veteran', ink: '#ff8a3d', ink2: '#3f7bff', tint: '#ffeadb', tilt: -2, seed: 81 },
  reliable: { draw: 'reliable', ink: '#2fbf8f', ink2: '#ffcf1f', tint: '#ddf6ec', tilt: 2, seed: 82 },
  local_hero: { draw: 'localhero', ink: '#ff5a4f', ink2: '#ffcf1f', tint: '#ffe4e1', tilt: -3, seed: 83 },
  payment_verified: { draw: 'payment', ink: '#9d7bff', ink2: '#ffcf1f', tint: '#ede6ff', tilt: 3, seed: 84 },
  trusted_client: { draw: 'trusted', ink: '#ff8fb1', ink2: '#ff5a4f', tint: '#ffe6ee', tilt: -2, seed: 85 },
  founder: { draw: 'bridge', ink: '#ff8a3d', ink2: '#21b3a1', tint: '#ffeadb', tilt: 3, seed: 5 },
  fast_responder: { draw: 'plane', ink: '#2fbf8f', ink2: '#ffcf1f', tint: '#ddf6ec', tilt: -5, seed: 9 },
  rising_talent: { draw: 'sprout', ink: '#ff8a3d', ink2: '#2fbf8f', tint: '#ffeadb', tilt: 2, seed: 86 },
  jobs_5: { draw: 'jobs5', ink: '#ff5a4f', ink2: '#ffcf1f', tint: '#ffe4e1', tilt: -3, seed: 87 },
  mobile_verified: { draw: 'phone', ink: '#9d7bff', ink2: '#ffcf1f', tint: '#ede6ff', tilt: 2, seed: 13 },
  email_verified: { draw: 'email', ink: '#3fb8e8', ink2: '#ff5a4f', tint: '#e0f4fc', tilt: -2, seed: 88 },
}

// a badge without its own drawing: by icon name (badges.icon), else the medal
const BY_ICON = {
  'shield-check': 'verified', 'badge-check': 'reliable', 'id-card': 'id', rocket: 'jobs50', sparkles: 'stars5', zap: 'bulb', droplets: 'pipe',
  flame: 'gas', thermometer: 'hvac', 'hard-hat': 'construction', car: 'car', star: 'toprated', gem: 'gem', medal: 'veteran',
  'map-pinned': 'localhero', 'credit-card': 'payment', handshake: 'trusted', 'trending-up': 'sprout', 'thumbs-up': 'jobs5',
  hammer: 'jobs5', phone: 'phone', mail: 'email',
}
const PALETTE = ['#3f7bff', '#ff5fb7', '#ffcf1f', '#3fb8e8', '#ff8a3d', '#2fbf8f', '#9d7bff', '#ff5a4f']

const hash = (text) => [...String(text)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7)
const tintOf = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v) => Math.round(v + (255 - v) * 0.84)
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

/** Drawing + colours for a badge. */
export function stickerStyle(badge) {
  const own = BY_CODE[badge.code]
  if (own) return own
  const h = hash(badge.code || badge.label || '')
  const ink = /^#[0-9a-f]{6}$/i.test(badge.color || '') ? badge.color : PALETTE[h % PALETTE.length]
  return { draw: BY_ICON[badge.icon] || 'medal', ink, ink2: PALETTE[(h + 3) % PALETTE.length], tint: tintOf(ink), tilt: (h % 7) - 3, seed: 90 + (h % 50) }
}

function blob(seed) {
  let s = seed
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const pts = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; const r = 41 + rnd() * 4.5; return [50 + r * Math.cos(a), 48 + r * Math.sin(a)] })
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length]
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

/**
 * The sticker as SVG markup. `uid` keeps filter ids unique on the page; `tab` adds the printed
 * strip with the tier ("ZLATO ★★★"), which is only readable from about 90 px up; `fine` adds paper grain.
 * Every string here is ours (drawings, tier names): nothing from the database goes into the markup.
 */
export function stickerMarkup(badge, { uid, tab = true, fine = true, tier = 'bronze' } = {}) {
  const st = stickerStyle(badge)
  const d = DRAW[st.draw] || DRAW.medal
  const id = `bs${uid}`
  const [tierName, stars] = TIER_TAB[tier] || TIER_TAB.bronze
  const ink = d.ink(st.ink, st.ink2, `url(#${id}h)`).replaceAll('url(#HT2)', `url(#${id}h2)`)
  return `<svg viewBox="-12 -10 124 ${tab ? 128 : 116}" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <defs>
    <pattern id="${id}h" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.3" cy="1.3" r=".75" fill="${st.ink}"/></pattern>
    <pattern id="${id}h2" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.3" cy="1.3" r=".8" fill="${L}" opacity=".35"/></pattern>
    <filter id="${id}r" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${st.seed}"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>
    <filter id="${id}i" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="2" seed="${st.seed + 4}"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.45" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    <filter id="${id}c" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="cut"/>
      <feGaussianBlur in="cut" stdDeviation="1.6" result="b"/><feOffset in="b" dx=".6" dy="2" result="o"/>
      <feFlood flood-color="#0b1640" flood-opacity=".26"/><feComposite in2="o" operator="in" result="shadow"/>
      <feFlood flood-color="${P}"/><feComposite in2="cut" operator="in" result="paper"/>
      ${fine ? `<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" seed="${st.seed}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .1  0 0 0 0 .12  0 0 0 0 .2  0 0 0 -.8 .38" result="grain"/>
      <feComposite in="grain" in2="cut" operator="in" result="g"/>` : ''}
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="paper"/><feMergeNode in="SourceGraphic"/>${fine ? '<feMergeNode in="g"/>' : ''}</feMerge>
    </filter>
  </defs>
  <g transform="rotate(${st.tilt} 50 52)">
    <g filter="url(#${id}c)">
      <path d="${blob(st.seed)}" fill="${st.tint}"/>
      <g transform="translate(1.5 1.1)" filter="url(#${id}i)">${ink}</g>
      <g filter="url(#${id}r)" fill="none" stroke="${L}" stroke-linecap="round" stroke-linejoin="round">
        <g stroke-width="2.8">${d.line}</g><g stroke-width="1.6">${d.thin}</g>
      </g>
      ${tab ? `<g transform="rotate(${-st.tilt - 2.5} 50 95)">
        <path d="M13 88.5L87 87 85 90 88 93 85 96 88 99 87 100.5 13 102 15 99 12 96 15 93 12 90Z" fill="${L}"/>
        <text x="50" y="97.7" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="7.4" letter-spacing=".5" fill="${P}">${tierName} ${'★'.repeat(stars)}</text>
      </g>` : ''}
    </g>
  </g>
</svg>`
}
