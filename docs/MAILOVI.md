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

Nova ponuda, prihvaćena ili odbijena ponuda, zahtjev za ponudu, nova poruka, promjene na poslu,
novi posao u blizini, uplata, recenzija, značka, provjera i podrška idu i na mail, osim ako je
korisnik isključio mailove (Nalog → Postavke obavijesti). Isti mail o istoj stvari ide najviše
jednom u 15 minuta, a najviše 20 mailova dnevno po osobi.

Dijelovi:
- Edge funkcija `supabase/functions/send-email` (izgled A/B/C nasumično, tekst iz
  `_shared/notificationEmails.js`)
- SQL `supabase/communication/02_email_notifications.sql` (tabela `email_log` i okidač na
  `notifications`)
- Tajne funkcije: https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/functions/secrets
  - Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<gmail adresa>`,
    `SMTP_PASS=<app lozinka>`, `EMAIL_FROM=Zadatak <gmail adresa>`
  - ili Resend: `RESEND_API_KEY`, `EMAIL_FROM=Zadatak <obavijesti@zadatak.ba>`

Dok tajni nema, funkcija ne šalje ništa i ništa se ne kvari.
