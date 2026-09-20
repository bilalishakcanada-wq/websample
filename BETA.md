# Poso.ba — beta testing (kratki vodič)

## Link za testere
**https://bilalishakcanada-wq.github.io/websample/**

Svaki push na `main` automatski gradi i objavljuje novu verziju (GitHub Actions → `gh-pages`). Instalirana aplikacija sama povuče novu verziju pri sljedećem otvaranju.

## Instalacija na telefon (bez App Store-a)
- **iPhone (Safari):** otvori link → *Dijeli* (ikona kvadrata sa strelicom) → **Dodaj na početni ekran**. Aplikacija se otvara preko cijelog ekrana, bez Safari trake.
- **Android (Chrome):** otvori link → pojavi se traka „Instaliraj Poso.ba“ (ili meni ⋮ → **Instaliraj aplikaciju**).

## Obavijesti (push)
- Nakon prijave pojavi se kartica **„Uključi obavijesti“** (nadzorna ploča / poruke) — ili *Nalog → Postavke → Ovaj uređaj → Uključi*.
- Na iPhoneu obavijesti rade **samo iz instalirane aplikacije** (početni ekran), iOS 16.4+.
- Stižu za: nove ponude na tvoj posao, prihvaćenu ponudu, nove poruke, isplate/balans, podršku.

## Šta testirati
1. Registracija (email ili Google) → popuni profil → odaberi tip naloga.
2. Objavi posao sa slikama (5 koraka) → „Posao je objavljen!“.
3. Drugi nalog: pošalji ponudu → prvi nalog: prihvati ponudu (Poso.ba Pay rezerviše iznos sa balansa — admin može dodati balans u *Admin → Balans*).
4. Poruke između naloga (Pravilo #1 automatski uklanja brojeve/emailove).
5. Izvođač: „Posao je urađen — zatraži isplatu“ → klijent: „Oslobodi“ → provjeri *Balans* na oba naloga.
6. Recenzija, značke, javni profil, pomoć + chat podrške.
7. Admin/mod panel na telefonu (*/admin*, */mod*).

## Šta samo vlasnik može podesiti (Supabase / servisi)
- **VAŽNO za registracije:** Supabase-ov ugrađeni email servis šalje samo ~2 emaila na sat, pa testeri neće dobiti potvrdu registracije. Za beta uradi jedno od dvoje:
  - *Auth → Providers → Email → isključi „Confirm email“* (najbrže), ili
  - *Auth → SMTP Settings → Custom SMTP* (npr. Resend besplatni plan) — tada radi i potvrda emaila i reset lozinke bez limita.
- **Auth → URL Configuration:** dodaj `https://bilalishakcanada-wq.github.io/websample/` u *Site URL* i *Redirect URLs* (inače Google prijava i reset lozinke vraćaju na pogrešnu adresu).
- **Facebook prijava:** App ID + App Secret u *Auth → Providers → Facebook* (dugme već postoji).
- **AI podrška / AI provjera profila:** Anthropic nalog treba kredite (`ANTHROPIC_API_KEY` je već postavljen kao secret). Do tada radi ugrađeni odgovarač i ručno preuzimanje razgovora.
- **Email/Telegram za admina:** `RESEND_API_KEY` + `ADMIN_EMAIL` ili `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` kao Edge Function secrets.

## Native aplikacija (iOS / Android)
Projekat je već spreman u `ios/` i `android/` (Capacitor 8, učitava live sajt). Za iOS treba **Xcode** (App Store, besplatan):
```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run app:sync && npm run app:ios
```
Zatim u Xcodeu: odaberi svoj tim (Signing) → Run na iPhone ili simulator. Za TestFlight: Product → Archive → Distribute. Detalji u `MOBILE.md`.
