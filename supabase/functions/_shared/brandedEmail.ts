// Notification mails sent through send-transactional-email (Resend, info@zadatak.ba).
// The look comes from emailLayouts.js, the same three Bosnian looks (A/B/C) as the
// Supabase Auth templates; each mail picks one at random.
import { escapeHtml, pickVariant, renderEmail } from './emailLayouts.js'

export const brandedEmailEvents = ['WELCOME_CONFIRM', 'PASSWORD_RESET', 'JOB_PUBLISHED', 'NEW_BID_RECEIVED', 'JOB_ACCEPTED', 'JOB_COMPLETED', 'NEW_MESSAGE', 'NOTIFICATION'] as const
export type BrandedEmailEvent = typeof brandedEmailEvents[number]
export type EmailData = {
  userName?: string; jobTitle?: string; providerName?: string; price?: number | string
  actionUrl: string; notificationTitle?: string; notificationBody?: string
  // where email notifications are switched off; shown as the unsubscribe link
  settingsUrl?: string
}
export type EmailVariant = 'A' | 'B' | 'C'
type Content = { subject: string; heading: string; paragraphs: string[]; action: string; actionUrl: string; detail?: string; footer?: string; kicker?: string; settingsUrl?: string }
export const escapeEmailHtml = (value: unknown): string => escapeHtml(value)
const clean = (value: unknown, limit = 160) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit)
export function emailSiteUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('EMAIL_URL_INVALID')
  return url
}

const SECURITY = 'Zadatak nikada ne traži vašu lozinku ni sigurnosni link. Trebate pomoć? Pišite nam na <a href="mailto:info@zadatak.ba" style="color:#1F5BFF">info@zadatak.ba</a>.'
const KICKERS: Record<BrandedEmailEvent, string> = {
  WELCOME_CONFIRM: 'Dobrodošli', PASSWORD_RESET: 'Sigurnost računa', JOB_PUBLISHED: 'Oglas objavljen',
  NEW_BID_RECEIVED: 'Nova ponuda', JOB_ACCEPTED: 'Posao dogovoren', JOB_COMPLETED: 'Posao završen',
  NEW_MESSAGE: 'Nova poruka', NOTIFICATION: 'Obavijest',
}

function layout(content: Content, authTemplate = false, variant: EmailVariant = pickVariant() as EmailVariant) {
  // Go template tokens are permitted only by the static Auth template generator.
  if (!(authTemplate && content.actionUrl === '{{ .ConfirmationURL }}')) emailSiteUrl(content.actionUrl)
  const e = escapeEmailHtml
  const footer = content.footer || (content.settingsUrl
    ? 'Ovu poruku ste dobili zbog aktivnosti svog računa.'
    : 'Ovu poruku ste dobili zbog aktivnosti svog računa. Email obavijesti možete podesiti u aplikaciji.')
  const settingsUrl = !content.footer && content.settingsUrl ? emailSiteUrl(content.settingsUrl).href : ''
  const unsubscribe = 'Isključi email obavijesti'
  const html = renderEmail(variant, {
    subject: clean(content.subject, 180),
    preheader: e(content.heading),
    kicker: e(content.kicker || ''),
    title: e(content.heading),
    lead: content.paragraphs.map(e).join('<br><br>'),
    details: content.detail ? `<strong>${e(content.detail)}</strong>` : '',
    button: e(content.action),
    url: e(content.actionUrl),
    note: SECURITY,
    footerNote: e(footer) + (settingsUrl ? ` <a href="${e(settingsUrl)}" style="color:inherit;text-decoration:underline">${unsubscribe}</a>` : ''),
  })
  return { subject: clean(content.subject, 180), html,
    text: [content.heading, content.detail, ...content.paragraphs, `${content.action}: ${content.actionUrl}`, footer, settingsUrl ? `${unsubscribe}: ${settingsUrl}` : '', 'Trebate pomoć? Pišite na info@zadatak.ba. Nikada ne šaljite lozinku niti sigurnosni link.', 'Zadatak.ba'].filter(Boolean).join('\n\n') }
}

function contentFor(type: BrandedEmailEvent, data: EmailData): Content {
  const title = clean(data.jobTitle || 'Vaš zadatak', 120)
  const provider = clean(data.providerName, 100)
  const amount = Number(data.price)
  const price = Number.isFinite(amount) && amount > 0 ? `${new Intl.NumberFormat('bs-BA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} KM` : ''
  const hello = clean(data.userName, 80)
  let subject: string, heading: string, body: string, action: string, footer: string | undefined
  switch (type) {
    case 'WELCOME_CONFIRM':
      subject = 'Potvrdite svoj email — Zadatak.ba'; heading = 'Dobrodošli na Zadatak.ba!'
      body = 'Potvrdite svoj email kako biste započeli. Nakon potvrde možete objaviti zadatak ili pronaći posao u svojoj blizini.'
      action = 'Potvrdi email'; footer = 'Ako niste otvorili račun na Zadatak.ba, zanemarite ovu poruku. Vaš račun neće biti potvrđen bez otvaranja linka.'; break
    case 'PASSWORD_RESET':
      subject = 'Postavite novu lozinku — Zadatak.ba'; heading = 'Zahtjev za promjenu lozinke'
      body = 'Primili smo zahtjev za promjenu lozinke vašeg računa. Otvorite sigurni link i postavite novu lozinku.'
      action = 'Postavi novu lozinku'; footer = 'Ako niste zatražili promjenu lozinke, zanemarite ovu poruku. Vaša postojeća lozinka ostaje nepromijenjena. Link nemojte prosljeđivati drugima.'; break
    case 'JOB_PUBLISHED':
      subject = 'Vaš oglas je objavljen — Zadatak.ba'; heading = 'Oglas je uspješno objavljen'
      body = `Vaš oglas „${title}“ je uspješno objavljen na Zadatak.ba. Obavijestit ćemo vas kada stigne nova ponuda.`
      action = 'Pogledaj oglas'; break
    case 'NEW_BID_RECEIVED':
      subject = `Nova ponuda za „${title}“ — Zadatak.ba`; heading = 'Stigla je nova ponuda'
      body = `Imate novu ponudu za „${title}“${provider ? ` od izvođača ${provider}` : ''}${price ? ` u iznosu od ${price}` : ''}. Pogledajte detalje izvođača i ponude prije odluke.`
      action = 'Pogledaj ponudu'; break
    case 'JOB_ACCEPTED':
      subject = `Posao dogovoren: ${title} — Zadatak.ba`; heading = 'Posao je dogovoren!'
      body = `Sredstva${price ? ` (${price})` : ''} su rezervisana i izvođač može krenuti. Dogovorite detalje kroz chat u aplikaciji.`
      action = 'Otvori dogovor'; break
    case 'JOB_COMPLETED':
      subject = `Zadatak završen: ${title} — Zadatak.ba`; heading = 'Posao je završen'
      body = `Posao je završen i odobren. ${provider ? `Ocijenite majstora ${provider}` : 'Molimo vas da ostavite recenziju'} — vaše iskustvo pomaže drugim korisnicima.`
      action = 'Ostavi recenziju'; break
    case 'NEW_MESSAGE':
      subject = 'Stigla vam je nova poruka — Zadatak.ba'; heading = 'Nastavite razgovor'
      body = 'Drugi učesnik vam je poslao poruku. Otvorite razgovor u aplikaciji da pročitate poruku i odgovorite.'
      action = 'Otvori razgovor'; break
    case 'NOTIFICATION':
      heading = clean(data.notificationTitle || 'Novost na vašem računu', 120)
      subject = `${heading} — Zadatak.ba`
      body = clean(data.notificationBody || 'Otvorite aplikaciju za više detalja.', 600)
      action = 'Pogledaj detalje'; break
    default: throw new Error('EVENT_TYPE_INVALID')
  }
  const auth = type === 'WELCOME_CONFIRM' || type === 'PASSWORD_RESET'
  return { subject, heading, action, actionUrl: data.actionUrl, settingsUrl: data.settingsUrl, kicker: KICKERS[type],
    detail: auth || type === 'NOTIFICATION' || type === 'NEW_MESSAGE' ? undefined : title,
    paragraphs: [...(hello ? [`Poštovani/a ${hello},`] : []), body], footer }
}

/** One finished mail; the look is random unless a variant is given (previews). */
export function renderBrandedEmail(type: BrandedEmailEvent, data: EmailData, variant?: EmailVariant) {
  return layout(contentFor(type, data), false, variant)
}
export function renderEmailLayout(content: Content, variant?: EmailVariant) { return layout(content, false, variant) }

// This emits dashboard HTML, not a second Auth delivery path. Supabase owns tokens and SMTP delivery.
// The pasted Auth templates come from scripts/build-email-templates.mjs; this stays for compatibility.
export function renderSupabaseAuthTemplate(type: 'WELCOME_CONFIRM' | 'PASSWORD_RESET' | 'MAGIC_LINK', variant?: EmailVariant) {
  const content: Content = type === 'MAGIC_LINK'
    ? { subject: 'Vaš link za prijavu — Zadatak.ba', heading: 'Prijavite se jednim klikom', kicker: 'Prijava',
      paragraphs: ['Otvorite sigurni link za prijavu na svoj Zadatak.ba račun.'], action: 'Prijavi se', actionUrl: '{{ .ConfirmationURL }}',
      footer: 'Ako niste zatražili prijavu, zanemarite ovu poruku. Link nemojte prosljeđivati drugima.' }
    : contentFor(type, { actionUrl: '{{ .ConfirmationURL }}' })
  content.footer += ' Poruka je namijenjena adresi {{ .Email }}.'
  return layout(content, true, variant)
}
