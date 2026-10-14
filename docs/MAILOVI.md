# Mailovi (Zadatak)

Svi mailovi koje Zadatak šalje imaju tri izgleda s bosanskom ilustracijom, a svaki mail
nasumično dobije jedan od njih:

| Izgled | Ilustracija | Stil |
|---|---|---|
| A | Stari most u Mostaru noću (skakač, džamija, kamene kuće) | tamnoplavo zaglavlje i podnožje |
| B | Bosanska sofra (kahva, ćevapi u somunu, burek, kajmak, ćilim) | svijetla kartica |
| C | Sebilj na Baščaršiji (golubovi, Sahat-kula, žičara, majstor) | veliki naslov |

Sve je plavo-bijelo, bez žute. Slike su u `public/email/` (izvor u `scripts/email-art/*.svg`)
i učitavaju se s https://bilalishakcanada-wq.github.io/websample/email/.

## 1. Mailovi za račun (Supabase Auth)

| Mail | Fajl | Naslov maila (Subject) |
|---|---|---|
| Potvrda registracije (Confirm signup) | `supabase/email-templates/confirmation.html` | Potvrdite svoj email za Zadatak |
| Nova lozinka (Reset password) | `recovery.html` | Postavite novu lozinku za Zadatak |
| Prijava linkom (Magic link) | `magic_link.html` | Vaš link za prijavu na Zadatak |
| Promjena maila (Change email address) | `email_change.html` | Potvrdite novu email adresu |
| Poziv (Invite user) | `invite.html` | Pozvani ste na Zadatak |
| Sigurnosni kod (Reauthentication) | `reauthentication.html` | Vaš sigurnosni kod za Zadatak |

Supabase predlošci nemaju nasumični izbor, pa se izgled bira po prvoj cifri jednokratnog
koda u mailu (`{{ .Token }}`), koji je slučajan za svaki mail: 0–2 je A, 3–5 je B, 6–9 je C.

Gdje se lijepe: https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/auth/templates
(prijava kao akessonlana@gmail.com). Za svaki mail: Subject iz tabele, a u "Message body"
cijeli sadržaj fajla.

Fajlovi se prave iz zajedničkog kalupa (`supabase/functions/_shared/emailLayouts.js`):

```
node scripts/build-email-templates.mjs                  # predlošci
node scripts/build-email-templates.mjs --png            # i slike iz SVG-a
node scripts/build-email-templates.mjs --preview dir    # pregledi sa primjerima
```

## 2. Podešavanja u Supabase (jednom)

1. **Pošiljalac (SMTP)**: https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/auth/smtp
   Brzi put je Gmail s app lozinkom (https://myaccount.google.com/apppasswords, treba uključena
   2-step verifikacija): host `smtp.gmail.com`, port `465`, ime pošiljaoca `Zadatak`.
   Pravi put kasnije je vlastita domena (npr. zadatak.ba) i https://resend.com.
2. **Potvrda maila**: https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/auth/providers
   → Email → uključi "Confirm email".
3. **Adrese za povratak**: https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/auth/url-configuration
   Site URL `https://bilalishakcanada-wq.github.io/websample/`, a u Redirect URLs dodaj
   `https://bilalishakcanada-wq.github.io/websample/**`.

Aplikacija: link iz maila za potvrdu prijavljuje osobu i otvara uređivanje profila. Na stranici
za prijavu je "Nije stigao mail? Pošalji ponovo", i nakon registracije i kad se neko pokuša
prijaviti bez potvrđenog maila.

## 3. Obavijesti mailom

Obavijesti (objavljen oglas, nova ponuda, dogovoren i završen posao, nova poruka i ostale
obavijesti) idu preko Resenda s adrese `info@zadatak.com`. Okidač `on_notification_email` na
`notifications` stavlja mail u red `zadatak_private.transactional_email_outbox`, a funkcija
`send-transactional-email` ga šalje. Svaki mail dobije nasumično jedan od tri izgleda (A/B/C).

Dijelovi:
- `supabase/functions/send-transactional-email` i `send-branded-email`
- `supabase/functions/_shared/brandedEmail.ts` (tekstovi i izgled, preko `emailLayouts.js`)
- Tajne funkcije (`RESEND_API_KEY`, `RESEND_FROM`):
  https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/functions/secrets

Pregled svih mailova: `node scripts/build-email-templates.mjs --preview email-preview`.

Važno: ove funkcije su prije objavljivane iz lokalnog Codex foldera na računaru. Prije novog
objavljivanja odatle, prvo povuci najnoviji `main`, inače se vraća stari izgled.

## 4. Potvrda emaila za svaki novi račun

- **Email i lozinka:** Supabase šalje mail za potvrdu kad je u *Authentication → Sign In / Providers → Email* uključeno **Confirm email**. Bez toga se račun odmah sam potvrdi.
- **Google:** Google već potvrđuje adresu, pa Supabase ne šalje ništa. Zato `supabase/communication/03_email_confirmation.sql` svakom novom Google računu doda red u `zadatak_private.email_confirmations`. Aplikacija tada na svakoj stranici pokaže "Potvrdi svoj email" i sama pošalje mail (događaj `EMAIL_CONFIRM` kroz `send-transactional-email`, isti plavo-bijeli izgled). Link vodi na `/potvrdi-email?t=…`, a `public.confirm_email` račun otključa. Link vrijedi 24 sata, novi mail najviše jednom u minuti. Postojeći računi se ne diraju.
- Pravila u bazi koja traže potvrđen email (`public.is_email_verified`) čekaju i ovaj link.
