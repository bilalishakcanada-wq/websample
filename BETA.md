# Poso.ba — beta testing (kratki vodič)

## Link za testere
**https://bilalishakcanada-wq.github.io/websample/**

Svaki push na `main` automatski gradi i objavljuje novu verziju (GitHub Actions → `gh-pages`). Instalirana aplikacija sama povuče novu verziju pri sljedećem otvaranju.

## Instalacija na telefon (bez App Store-a)
- **iPhone (Safari):** otvori link → *Dijeli* (ikona kvadrata sa strelicom) → **Dodaj na početni ekran**. Aplikacija se otvara preko cijelog ekrana, bez Safari trake.
- **Android (Chrome):** otvori link → pojavi se traka „Instaliraj Poso.ba“ (ili meni ⋮ → **Instaliraj aplikaciju**).

Na telefonu aplikacija počinje ekranom dobrodošlice → „Šta ti je glavni cilj?“ → 3 kratka ekrana uvoda → objava posla ili pregled poslova (registracija se traži tek na kraju).

## Obavijesti — šta stiže i kome
Sve ide u zvono u aplikaciji + push (kad je uključen) + link na pravi ekran:
- Dobrodošlica pri registraciji · **Tvoj posao je objavljen** · nova ponuda · ponuda prihvaćena (rezervacija) · ponuda odbijena · pitanje uz posao / odgovor · nova poruka · uplata osigurana / zatražena isplata / isplaćeno / otkazano / spor · nova recenzija · značke i verifikacija · **novi posao u tvom gradu za tvoju struku** (izvođači) + alarmi po ključnoj riječi.
- Tab „Poruke“ ima brojač nepročitanih.

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
- **Auth → URL Configuration:** dodaj `https://bilalishakcanada-wq.github.io/websample/` u *Site URL* i *Redirect URLs* (inače Google prijava i reset lozinke vraćaju na pogrešnu adresu). Google prijava u native aplikaciji (iOS/Android) ide kroz sistemski preglednik i vraća se preko sajta (`/dashboard?native=1` → `ba.poso.app://…`), pa **ne treba** dodatni unos u Redirect URLs.
- **Google prijava za druge ljude:** u [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent) → *OAuth consent screen* → ako piše **Testing**, klikni **Publish app** (inače Google pušta samo emailove sa liste „Test users“ — svi ostali dobiju „Access blocked“).
- **Facebook prijava:** App ID + App Secret u *Auth → Providers → Facebook* (dugme već postoji).
- **AI podrška / AI provjera profila:** Anthropic nalog treba kredite (`ANTHROPIC_API_KEY` je već postavljen kao secret). Do tada radi ugrađeni odgovarač i ručno preuzimanje razgovora.
- **Email/Telegram za admina:** `RESEND_API_KEY` + `ADMIN_EMAIL` ili `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` kao Edge Function secrets.

## Native aplikacija (iOS / Android)
Projekat je spreman u `ios/` i `android/` (Capacitor 8; aplikacija učitava live sajt, pa je uvijek sinhronizovana sa web-om). Ikona, splash i dozvole su podešeni.

### Android — beta bez Google Play-a (najbrže)
Svaki push na `main` (ili ručno: GitHub → *Actions* → **Android app** → *Run workflow*) gradi APK. Testerima pošalji ovaj link:

**https://github.com/bilalishakcanada-wq/websample/releases/tag/android-beta** → `poso-ba-beta.apk`

Na telefonu: preuzmi → otvori → „Dozvoli instalaciju iz ovog izvora“ → Instaliraj. Nova verzija se instalira preko stare.

### Android — Google Play (interno testiranje)
1. [Google Play Console](https://play.google.com/console) — nalog razvijača (jednokratno 25 USD) → *Create app* → Poso.ba.
2. Napravi ključ za potpis (jednom, čuvaj ga!):
   ```bash
   keytool -genkeypair -v -keystore poso-release.keystore -alias poso -keyalg RSA -keysize 2048 -validity 10000
   ```
3. GitHub → repo *Settings → Secrets and variables → Actions* → dodaj: `ANDROID_KEYSTORE_BASE64` (`base64 -i poso-release.keystore | pbcopy`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (=`poso`), `ANDROID_KEY_PASSWORD`.
4. Pokreni workflow → u *Releases* se pojavi i `poso-ba-release.aab` → Play Console → *Testing → Internal testing → Create release* → upload `.aab` → dodaj emailove testera → podijeli link.

### iOS — TestFlight
1. [Apple Developer Program](https://developer.apple.com/programs/) (99 USD/god) + [App Store Connect](https://appstoreconnect.apple.com) → *My Apps → +* → Poso.ba, Bundle ID `ba.poso.app`.
2. U Xcodeu: `open ios/App/App.xcodeproj` → **App** → *Signing & Capabilities* → tvoj tim → gore odaberi **Any iOS Device (arm64)** → *Product → Archive* → *Distribute App → TestFlight & App Store* → Upload.
3. App Store Connect → *TestFlight* → dodaj testere (email) ili uključi **Public link** i pošalji ga. Testeri instaliraju aplikaciju TestFlight i otvore link.
4. Za svoj iPhone odmah (bez TestFlight-a): spoji kabl, odaberi telefon u Xcodeu → ▶ Run (na telefonu: *Settings → General → VPN & Device Management → Trust*).

Detalji i rješavanje problema: `MOBILE.md`.
