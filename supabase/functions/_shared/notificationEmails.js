// Which in-app notifications also go out as a mail, and how each one reads.
// Shared by supabase/functions/send-email and scripts/build-email-templates.mjs (previews).
import { escapeHtml } from './emailLayouts.js'

// type → label above the title, button text, and where the button goes when the notification has no link
export const EMAIL_TYPES = {
  offer: { kicker: 'Nova ponuda', button: 'Pogledaj ponudu', fallback: '/moji-poslovi' },
  offer_accepted: { kicker: 'Ponuda prihvaćena', button: 'Otvori posao', fallback: '/moji-poslovi' },
  offer_rejected: { kicker: 'Vaša ponuda', button: 'Pronađi novi posao', fallback: '/search' },
  quote_request: { kicker: 'Zahtjev za ponudu', button: 'Pošalji ponudu', fallback: '/search' },
  message: { kicker: 'Nova poruka', button: 'Odgovori', fallback: '/messages' },
  job: { kicker: 'Vaš posao', button: 'Otvori posao', fallback: '/moji-poslovi' },
  task_expired: { kicker: 'Vaš posao', button: 'Otvori posao', fallback: '/moji-poslovi' },
  task_alert: { kicker: 'Novi posao za vas', button: 'Pogledaj posao', fallback: '/search' },
  wallet: { kicker: 'Zadatak Pay', button: 'Otvori novčanik', fallback: '/account/novcanik' },
  review: { kicker: 'Nova recenzija', button: 'Pogledaj profil', fallback: '/account/profil' },
  badge: { kicker: 'Nova značka', button: 'Pogledaj značke', fallback: '/account/znacke' },
  moderation: { kicker: 'Provjera', button: 'Otvori nalog', fallback: '/account' },
  support: { kicker: 'Podrška', button: 'Otvori razgovor', fallback: '/messages' },
  support_reply: { kicker: 'Podrška', button: 'Otvori razgovor', fallback: '/messages' },
}

// emoji in notification titles look fine in the app but break the big uppercase headline
const stripEmoji = (text) => String(text || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim()

/** The message object renderEmail() takes, from one notifications row. */
export function emailMessage(n, { site, firstName = '' } = {}) {
  const t = EMAIL_TYPES[n.type] || { kicker: 'Obavijest', button: 'Otvori Zadatak', fallback: '/account/obavijesti' }
  // links are app paths ("/listings/…"); anything else (a full URL) falls back to the type's page
  const path = n.link && !/^[a-z]+:/i.test(n.link) && !n.link.startsWith('//') ? (n.link.startsWith('/') ? n.link : `/${n.link}`) : t.fallback
  const title = escapeHtml(stripEmoji(n.title))
  const greeting = firstName ? `Zdravo ${escapeHtml(firstName)},<br>` : ''
  const text = escapeHtml(n.message || '')
  return {
    subject: `${stripEmoji(n.title)} · Zadatak`,
    preheader: escapeHtml(stripEmoji(n.message || n.title).slice(0, 120)),
    kicker: t.kicker,
    title,
    short: '',
    lead: `${greeting}${text || (greeting ? 'imate novu obavijest na Zadatku.' : 'Imate novu obavijest na Zadatku.')}`,
    button: t.button,
    url: escapeHtml(`${site}${path}`),
    note: 'Zadatak nikad ne traži lozinku, broj kartice ni plaćanje mimo platforme. Dogovor i plaćanje držite na Zadatku i zaštićeni ste.',
    footerNote: `Dobili ste ovaj mail jer imate uključene obavijesti mailom. <a href="${site}/account/postavke-obavijesti" style="color:inherit">Isključite ih ovdje</a>.`,
  }
}
