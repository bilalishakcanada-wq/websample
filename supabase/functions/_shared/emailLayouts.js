// Zadatak, email layouts shared by the auth templates (scripts/build-email-templates.mjs)
// and the notification mails (supabase/functions/_shared/brandedEmail.ts).
//
// Three looks, each with its own Bosnian illustration (public/email/*.png):
//   A  "Mostar noću"    , dark-blue header and footer, Stari most at night
//   B  "Bosanska sofra" , light card, coffee, ćevapi and burek on a ćilim
//   C  "Baščaršija"     , big headline, Sebilj with pigeons
// Every mail picks one at random. Table layout and inline styles only, because
// Gmail, Outlook and phone mail apps drop <style> blocks and modern CSS.
// Values are inserted as they are: callers escape user text (escapeHtml below).

export const SITE_URL = 'https://bilalishakcanada-wq.github.io/websample'
export const VARIANTS = ['A', 'B', 'C']

const NAVY = '#0A1A5C'
const BLUE = '#1F5BFF'
const LIGHT = '#E8EFFF'
const PALE = '#F4F7FF'
const BODY = '#3D4660'
const MUTED = '#8A93A6'
const FONT = "Figtree, Arial, 'Helvetica Neue', Helvetica, sans-serif"

const ART = {
  A: { file: 'mostar.png', alt: 'Ilustracija: Stari most u Mostaru noću' },
  B: { file: 'sofra.png', alt: 'Ilustracija: bosanska sofra s kahvom, ćevapima i burekom' },
  C: { file: 'carsija.png', alt: 'Ilustracija: Sebilj na Baščaršiji' },
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function pickVariant(random = Math.random) {
  return VARIANTS[Math.floor(random() * VARIANTS.length) % VARIANTS.length]
}

const link = (site, path, text, color) =>
  `<a href="${site}${path}" style="font:400 13px ${FONT};color:${color};text-decoration:none">${text}</a>`

function logoRow(site, color) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:10px"><img src="${site}/email/logo.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>
      <td style="font:900 24px ${FONT};color:${color};letter-spacing:-0.5px">Zadatak</td></tr></table>`
}

function button(m, bg, center = false) {
  if (!m.url || !m.button) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${center ? ' align="center"' : ''} style="margin:26px ${center ? 'auto' : '0'} 8px"><tr>
      <td style="background:${bg};border-radius:999px"><a href="${m.url}" style="display:inline-block;padding:16px 34px;font:700 16px ${FONT};color:#FFFFFF;text-decoration:none;border-radius:999px">${m.button} &rarr;</a></td>
    </tr></table>`
}

function code(m, center = false) {
  if (!m.code) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${center ? ' align="center"' : ''} style="margin:22px ${center ? 'auto' : '0'} 4px"><tr>
      <td style="background:${LIGHT};border:2px dashed ${BLUE};border-radius:14px;padding:14px 26px;font:900 30px ${FONT};letter-spacing:8px;color:${NAVY}">${m.code}</td>
    </tr></table>${m.codeHint ? `<div style="font:400 13px/20px ${FONT};color:${MUTED};margin:6px 0 0">${m.codeHint}</div>` : ''}`
}

function details(m) {
  if (!m.details) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0"><tr>
      <td style="border-left:4px solid ${BLUE};background:${PALE};border-radius:0 12px 12px 0;padding:14px 16px;font:400 15px/23px ${FONT};color:${BODY}">${m.details}</td></tr></table>`
}

function note(m) {
  if (!m.note) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0"><tr>
      <td style="background:${PALE};border:1px solid #DCE6FF;border-radius:14px;padding:14px 16px;font:400 13px/20px ${FONT};color:${BODY}">
        <span style="font-weight:700;color:${NAVY}">&#128274; Sigurnost:</span> ${m.note}</td></tr></table>`
}

function fallback(m) {
  if (!m.url || !m.button) return ''
  return `<div style="font:400 12px/18px ${FONT};color:${MUTED};margin:18px 0 0">Dugme ne radi? Kopirajte ovaj link u preglednik:<br>
      <a href="${m.url}" style="color:${BLUE};word-break:break-all">${m.url}</a></div>`
}

function footerDark(site, m) {
  const col = (title, items) => `<td valign="top" width="33%" style="padding:0 10px 0 0">
      <div style="font:700 14px ${FONT};color:#FFFFFF;margin:0 0 10px">${title}</div>
      ${items.map(([text, path]) => `<div style="margin:0 0 8px">${link(site, path, text, '#C7D6FF')}</div>`).join('')}
    </td>`
  return `<tr><td style="background:${NAVY};border-radius:0 0 20px 20px;padding:32px 32px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${col('Zadatak', [['Kako radi', '/kako-radi'], ['Objavi posao', '/objavi'], ['Pronađi posao', '/search']])}
      ${col('Pomoć', [['Centar za pomoć', '/pomoc'], ['Pravila zajednice', '/pravila-zajednice'], ['Kontakt', '/kontakt']])}
      ${col('Aplikacija', [['Android i iPhone', '/aplikacija'], ['Uslovi korištenja', '/pravila'], ['Privatnost', '/privatnost']])}
    </tr></table>
    <div style="border-top:1px solid #23347A;margin:22px 0 16px;line-height:0;font-size:0">&nbsp;</div>
    <div style="font:400 12px/18px ${FONT};color:#8FA8F0">Zadatak · Bosna i Hercegovina · Dobri ljudi. Dobri dogovori.<br>${m.footerNote}</div>
  </td></tr>`
}

function footerLight(site, m) {
  const sep = ' &nbsp;·&nbsp; '
  return `<tr><td style="padding:26px 32px 30px;text-align:center">
    <div style="font:400 13px ${FONT};color:${MUTED};margin:0 0 10px">${[
      link(site, '/pomoc', 'Pomoć', BLUE),
      link(site, '/pravila-zajednice', 'Pravila zajednice', BLUE),
      link(site, '/aplikacija', 'Aplikacija', BLUE),
      link(site, '/pravila', 'Uslovi', BLUE),
    ].join(sep)}</div>
    <div style="font:400 12px/18px ${FONT};color:${MUTED}">Zadatak · Bosna i Hercegovina · Dobri ljudi. Dobri dogovori.<br>${m.footerNote}</div>
  </td></tr>`
}

function art(site, variant, radius = '') {
  const a = ART[variant]
  return `<img src="${site}/email/${a.file}" width="600" alt="${a.alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0${radius}">`
}

function body(m, center = false) {
  return `${m.lead ? `<p style="margin:0;font:400 16px/25px ${FONT};color:${BODY}">${m.lead}</p>` : ''}
  ${details(m)}
  ${code(m, center)}
  ${button(m, center ? BLUE : m.variant === 'B' ? NAVY : BLUE, center)}
  <div style="text-align:left">${note(m)}${fallback(m)}</div>`
}

const h1 = (text) => `<h1 style="margin:0 0 12px;font:900 28px/34px ${FONT};color:${NAVY};letter-spacing:-0.5px">${text}</h1>`

function layoutA(site, m) {
  return `<tr><td style="background:${NAVY};border-radius:20px 20px 0 0;padding:22px 28px">${logoRow(site, '#FFFFFF')}</td></tr>
<tr><td style="background:${NAVY};line-height:0">${art(site, 'A')}</td></tr>
<tr><td style="background:#FFFFFF;padding:34px 32px">
  ${m.kicker ? `<div style="font:700 12px ${FONT};letter-spacing:0.8px;text-transform:uppercase;color:${BLUE};margin:0 0 10px">${m.kicker}</div>` : ''}
  ${h1(m.title)}
  ${body(m)}
</td></tr>
${footerDark(site, m)}`
}

function layoutB(site, m) {
  return `<tr><td style="padding:4px 4px 18px">${logoRow(site, NAVY)}</td></tr>
<tr><td style="background:#FFFFFF;border-radius:24px;border:1px solid #DCE6FF">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="line-height:0">${art(site, 'B', ';border-radius:24px 24px 0 0')}</td></tr>
  <tr><td style="padding:30px 32px 34px">
    ${m.kicker ? `<div style="display:inline-block;background:${LIGHT};color:${BLUE};font:700 12px ${FONT};letter-spacing:0.6px;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin:0 0 14px">${m.kicker}</div>` : ''}
    ${h1(m.title)}
    ${body(m)}
  </td></tr></table>
</td></tr>
${footerLight(site, m)}`
}

function layoutC(site, m) {
  return `<tr><td style="background:${NAVY};border-radius:20px 20px 0 0;padding:26px 30px 6px">${logoRow(site, '#FFFFFF')}</td></tr>
<tr><td style="background:${NAVY};padding:18px 30px 22px;text-align:center">
  ${m.kicker ? `<div style="font:700 12px ${FONT};letter-spacing:1px;text-transform:uppercase;color:#7FB0FF;margin:0 0 10px">${m.kicker}</div>` : ''}
  <div style="font:900 36px/40px ${FONT};color:#FFFFFF;letter-spacing:-0.5px;text-transform:uppercase">${m.title}</div>
  ${m.short ? `<div style="font:400 16px/24px ${FONT};color:#C7D6FF;margin:10px 0 0">${m.short}</div>` : ''}
</td></tr>
<tr><td style="background:${NAVY};line-height:0">${art(site, 'C')}</td></tr>
<tr><td style="background:#FFFFFF;padding:30px 32px 34px;text-align:center">
  ${body(m, true)}
</td></tr>
${footerDark(site, m)}`
}

const LAYOUTS = { A: layoutA, B: layoutB, C: layoutC }

/** The table rows of one look; inner() lets the auth templates put three looks in one file. */
export function emailInner(variant, message, site = SITE_URL) {
  const m = { footerNote: 'Ovaj mail je poslan jer imate Zadatak račun.', ...message, variant }
  return LAYOUTS[variant](site, m)
}

export function emailShell(inner, { title = 'Zadatak', preheader = '' } = {}) {
  return `<!doctype html>
<html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${LIGHT};-webkit-text-size-adjust:100%">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${LIGHT}">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LIGHT}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
${inner}
</table></td></tr></table></body></html>
`
}

/** One finished mail in one look (used for notification mails). */
export function renderEmail(variant, message, site = SITE_URL) {
  return emailShell(emailInner(variant, message, site), { title: message.subject ? escapeHtml(message.subject) : message.title, preheader: message.preheader })
}
