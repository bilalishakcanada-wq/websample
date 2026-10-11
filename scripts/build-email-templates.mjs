// Builds the Supabase Auth email templates (supabase/email-templates/*.html) from the shared
// layouts in supabase/functions/_shared/emailLayouts.js.
//
//   node scripts/build-email-templates.mjs          templates only
//   node scripts/build-email-templates.mjs --png    also re-render public/email/*.png from scripts/email-art/*.svg
//   node scripts/build-email-templates.mjs --preview <dir>   HTML previews with sample values (local images)
//
// Each template holds all three looks (A Mostar, B sofra, C Baščaršija). Supabase fills them with
// Go templates, which have no random function, so the look is picked from the first digit of the
// one-time code ({{ .Token }}), which is random for every mail: 0–2 → A, 3–5 → B, 6–9 → C.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { emailInner, emailShell, SITE_URL } from '../supabase/functions/_shared/emailLayouts.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'supabase/email-templates')

const NAME = '{{ with .Data.full_name }} {{ . }}{{ end }}'

export const AUTH_EMAILS = {
  confirmation: {
    subject: 'Potvrdite svoj email za Zadatak',
    preheader: 'Još jedan klik i vaš Zadatak račun je spreman.',
    kicker: 'Dobro došli',
    title: 'Potvrdite svoj email',
    short: 'Još samo jedan klik do vašeg računa.',
    lead: `Zdravo${NAME}! Hvala što ste se pridružili Zadataku, mjestu gdje se dobri ljudi i dobri majstori nađu. Potvrdite da je ovo vaša email adresa i račun je spreman.`,
    details: '<b>Šta dalje?</b> Objavite prvi posao besplatno ili, ako ste majstor, pošaljite ponudu na poslove u svom gradu.',
    button: 'Potvrdi email',
    url: '{{ .ConfirmationURL }}',
    note: 'Niste vi napravili račun? Zanemarite ovaj mail i račun neće biti aktiviran.',
  },
  recovery: {
    subject: 'Postavite novu lozinku za Zadatak',
    preheader: 'Link za novu lozinku vrijedi 1 sat.',
    kicker: 'Vaš račun',
    title: 'Postavite novu lozinku',
    short: 'Link vrijedi 1 sat i radi samo jednom.',
    lead: 'Neko je zatražio promjenu lozinke za vaš Zadatak račun. Ako ste to bili vi, kliknite dugme ispod. Link vrijedi 1 sat i radi samo jednom.',
    button: 'Postavi novu lozinku',
    url: '{{ .ConfirmationURL }}',
    note: 'Niste vi tražili promjenu? Slobodno zanemarite ovaj mail, lozinka ostaje ista. Zadatak vas nikad neće pitati za lozinku putem maila ili poruke.',
  },
  magic_link: {
    subject: 'Vaš link za prijavu na Zadatak',
    preheader: 'Prijava jednim klikom, bez lozinke.',
    kicker: 'Prijava',
    title: 'Prijavite se jednim klikom',
    short: 'Bez lozinke. Link vrijedi 1 sat.',
    lead: 'Kliknite dugme ispod i bit ćete prijavljeni na svoj Zadatak račun. Link vrijedi 1 sat i radi samo jednom.',
    button: 'Prijavi me',
    url: '{{ .ConfirmationURL }}',
    note: 'Niste vi tražili prijavu? Zanemarite ovaj mail, niko ne može ući bez ovog linka.',
  },
  email_change: {
    subject: 'Potvrdite novu email adresu',
    preheader: 'Potvrdite promjenu email adrese na Zadatku.',
    kicker: 'Vaš račun',
    title: 'Potvrdite novu email adresu',
    short: 'Promjena važi tek kad je potvrdite.',
    lead: 'Zatražili ste promjenu email adrese za Zadatak račun.',
    details: 'Stara adresa: <b>{{ .Email }}</b><br>Nova adresa: <b>{{ .NewEmail }}</b>',
    button: 'Potvrdi novu adresu',
    url: '{{ .ConfirmationURL }}',
    note: 'Niste vi tražili promjenu? Ne klikajte link i odmah promijenite lozinku u Nalog, Postavke.',
  },
  invite: {
    subject: 'Pozvani ste na Zadatak',
    preheader: 'Prihvatite poziv i napravite svoj račun.',
    kicker: 'Poziv',
    title: 'Pozvani ste na Zadatak',
    short: 'Dobri ljudi. Dobri dogovori.',
    lead: 'Pozvani ste da se pridružite Zadataku, platformi gdje ljudi iz cijele BiH objavljuju poslove, a provjereni majstori šalju ponude.',
    button: 'Prihvati poziv',
    url: '{{ .ConfirmationURL }}',
    note: 'Ne očekujete ovaj poziv? Zanemarite mail, ništa se neće desiti.',
  },
  reauthentication: {
    subject: 'Vaš sigurnosni kod za Zadatak',
    preheader: 'Kod za potvrdu važne promjene na računu.',
    kicker: 'Sigurnost',
    title: 'Vaš sigurnosni kod',
    short: 'Upišite ga u aplikaciju.',
    lead: 'Za ovu promjenu na računu moramo još jednom potvrditi da ste to vi. Upišite kod ispod.',
    code: '{{ .Token }}',
    codeHint: 'Kod vrijedi kratko i radi samo jednom.',
    note: 'Niste vi tražili kod? Promijenite lozinku i javite nam se preko Pomoći.',
  },
}

/** One Supabase template: the shared shell around a Go-template switch over the three looks. */
export function authTemplate(type) {
  const m = AUTH_EMAILS[type]
  const inner = `{{ $d := "" }}{{ if .Token }}{{ $d = slice .Token 0 1 }}{{ end }}
{{ if or (eq $d "0") (eq $d "1") (eq $d "2") }}
${emailInner('A', m)}
{{ else if or (eq $d "3") (eq $d "4") (eq $d "5") }}
${emailInner('B', m)}
{{ else }}
${emailInner('C', m)}
{{ end }}`
  return emailShell(inner, { title: m.subject, preheader: m.preheader })
}

const SAMPLE = {
  '{{ .ConfirmationURL }}': 'https://kshzsnceukbpwpgpicsh.supabase.co/auth/v1/verify?token=…&type=recovery',
  '{{ .Token }}': '482913',
  '{{ .Email }}': 'amra@primjer.ba',
  '{{ .NewEmail }}': 'amra.hodzic@primjer.ba',
  [NAME]: ' Amra',
}
const fillSample = (text) => Object.entries(SAMPLE).reduce((s, [k, v]) => s.split(k).join(v), text)

async function renderPngs() {
  const { chromium } = await import('playwright')
  const artDir = path.join(root, 'scripts/email-art')
  const browser = await chromium.launch()
  for (const file of fs.readdirSync(artDir).filter((f) => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(artDir, file), 'utf8')
    const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
    const page = await browser.newPage({ viewport: { width: +w, height: +h } })
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`)
    await page.screenshot({ path: path.join(root, 'public/email', file.replace('.svg', '.png')), omitBackground: file === 'logo.svg' })
    await page.close()
  }
  await browser.close()
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--png')) await renderPngs()
  fs.mkdirSync(outDir, { recursive: true })
  for (const type of Object.keys(AUTH_EMAILS)) fs.writeFileSync(path.join(outDir, `${type}.html`), authTemplate(type))
  const subjects = Object.fromEntries(Object.entries(AUTH_EMAILS).map(([k, v]) => [k, v.subject]))
  fs.writeFileSync(path.join(outDir, 'subjects.json'), JSON.stringify(subjects, null, 2) + '\n')

  const previewAt = args.indexOf('--preview')
  if (previewAt !== -1) {
    const dir = path.resolve(args[previewAt + 1] || 'email-preview')
    fs.mkdirSync(dir, { recursive: true })
    const site = 'file://' + path.join(root, 'public').replace(/\\/g, '/')
    for (const [type, m] of Object.entries(AUTH_EMAILS)) {
      for (const v of ['A', 'B', 'C']) {
        const html = emailShell(emailInner(v, m, site), { title: m.subject, preheader: m.preheader })
        fs.writeFileSync(path.join(dir, `${type}-${v}.html`), fillSample(html))
      }
    }
    // Notification mails (send-transactional-email). Node 22.18+ runs the .ts file directly.
    const { renderBrandedEmail } = await import('../supabase/functions/_shared/brandedEmail.ts')
    const url = SITE_URL + '/listings/00000000-0000-4000-8000-000000000001'
    const samples = [
      ['JOB_PUBLISHED', { jobTitle: 'Montaža kuhinje u Hrasnici', userName: 'Amra', actionUrl: url }],
      ['NEW_BID_RECEIVED', { jobTitle: 'Montaža kuhinje u Hrasnici', providerName: 'Emir H.', price: 120, userName: 'Amra', actionUrl: url }],
      ['JOB_ACCEPTED', { jobTitle: 'Montaža kuhinje u Hrasnici', price: 120, userName: 'Amra', actionUrl: url }],
      ['JOB_COMPLETED', { jobTitle: 'Montaža kuhinje u Hrasnici', providerName: 'Emir H.', userName: 'Amra', actionUrl: url }],
      ['NEW_MESSAGE', { userName: 'Amra', actionUrl: SITE_URL + '/messages' }],
      ['NOTIFICATION', { notificationTitle: 'Na tvoj balans je uplaćeno 100.00 KM', notificationBody: 'Uplata je stigla i možeš je koristiti za plaćanje poslova.', actionUrl: SITE_URL + '/account/novcanik' }],
    ]
    samples.forEach(([type, data], i) => {
      const v = ['A', 'B', 'C'][i % 3]
      const { html } = renderBrandedEmail(type, data, v)
      fs.writeFileSync(path.join(dir, `obavijest-${type}-${v}.html`), html.replaceAll(SITE_URL + '/email/', site + '/email/'))
    })
  }
  console.log(`email templates written to ${path.relative(root, outDir)}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
