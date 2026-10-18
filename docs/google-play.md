# Zadatak na Google Playu (18.10.2026.)

Šta Google Play traži od aplikacije, šta je već urađeno u kodu i šta može uraditi samo vlasnik.
Odgovori za Play Console su ispod, da se samo prepišu.

## 1. Uslovi Google Playa i gdje su ispunjeni

| Uslov | Stanje | Gdje |
|---|---|---|
| Ciljni API nivo: Android 16 (API 36), obavezno za nove aplikacije i ažuriranja od 31.08.2026. | ✅ `targetSdk 36`, `compileSdk 36`; CI pada ako padne ispod 36 | `android/variables.gradle`, `.github/workflows/android.yml` (korak „Google Play checks“) |
| Paket za upload je Android App Bundle (`.aab`), potpisan upload ključem | ✅ CI pravi `zadatak-release.aab` kad postoje tajne `ANDROID_KEYSTORE_*` | `android/app/build.gradle`, workflow |
| Play App Signing | ⏳ vlasnik uključi pri prvom uploadu (zadano je uključeno) | Play Console |
| `versionCode` raste sa svakim uploadom | ✅ broj GitHub builda (`versionName` = `1.0.<broj>`) | workflow |
| 16 KB veličina stranice (Android 15+) | ✅ aplikacija nema svojih `.so` biblioteka; CI provjerava `zipalign -P 16` | workflow |
| Samo potrebne dozvole, svaka objašnjena | ✅ uklonjena `POST_NOTIFICATIONS` (nema nativnih push obavijesti); CI pada na svaku novu dozvolu koja nije na listi ispod | `AndroidManifest.xml`, tačka 4 |
| Politika privatnosti: javni link, bez prijave, nije PDF | ✅ `https://bilalishakcanada-wq.github.io/websample/privatnost` (od sada vraća 200, ne 404) | `src/pages/PrivacyPage.jsx`, `pages.yml` |
| Brisanje naloga u aplikaciji | ✅ Moj nalog → Profil → „Obriši nalog“ (briše odmah, i fajlove) | `ProfileSettingsPage.jsx`, `supabase/functions/delete-account` |
| Brisanje naloga preko weba, bez aplikacije | ✅ `…/privatnost#brisanje-naloga` + Kontakt forma | `PrivacyPage.jsx` |
| Sadržaj korisnika (UGC): uslovi se prihvataju prije objave | ✅ obavezna kvačica pri registraciji (i za Google/Facebook prijavu) | `RegisterPage.jsx` |
| UGC: prijava sadržaja i korisnika | ✅ zastavica na oglasu, profilu i u razgovoru → moderatorski red | `reportService.js`, Admin → Moderacija |
| UGC: **blokiranje** korisnika, odvojeno od prijave | ✅ novo: profil i razgovor (meni ⋯), lista u Postavkama; baza odbija poruke, ponude i pitanja između blokiranih | `supabase/communication/04_user_blocks.sql`, `useBlocks.js` |
| UGC: moderacija | ✅ automatska provjera teksta i slika, Pravilo #1, opomene i suspenzija | `supabase/security`, `supabase/communication` |
| Rezervne kopije ne nose prijavu na drugi telefon | ✅ `allowBackup=false` + `data_extraction_rules.xml` | manifest |
| WebView aplikacija smije učitavati samo vlastiti sajt | ✅ učitava samo `bilalishakcanada-wq.github.io/websample` (naš sajt); vanjski linkovi idu u preglednik | `capacitor.config.json` |
| Ne preuzima izvršni kod mimo Playa | ✅ JavaScript u WebViewu je dozvoljen izuzetak; nema `.dex`/`.so` sa interneta | — |
| Plaćanja | ✅ Zadatak Pay plaća fizičke usluge (majstor dolazi), pa **Google Play Billing nije obavezan** | — |
| Uzrast | ✅ samo 18+ (u politici i u kvačici pri registraciji) | — |

## 2. Šta samo ti možeš uraditi (redom)

1. **Pokreni SQL za blokiranje** (bez ovoga dugme kaže „Blokiranje još nije uključeno“):
   Supabase SQL Editor (https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/sql/new) → zalijepi
   cijeli `supabase/communication/04_user_blocks.sql` → **Run**. Rezultat: `Gotovo: blokiranje korisnika je uključeno.`
2. **Google Play Console nalog**: https://play.google.com/console → 25 USD jednom → provjera identiteta
   (lična karta, adresa, telefon). Lični nalog je dovoljan. Firma (organizacija) traži D-U-N-S broj, ali
   preskače pravilo iz tačke 6.
3. **GitHub tajne za upload ključ** (ključ je već napravljen, u projektnim fajlovima
   `android-play-key/`): repo → *Settings → Secrets and variables → Actions → New repository secret*:
   - `ANDROID_KEYSTORE_BASE64` = sadržaj `ANDROID_KEYSTORE_BASE64.txt`
   - `ANDROID_KEYSTORE_PASSWORD` = sadržaj `ANDROID_KEYSTORE_PASSWORD.txt`
   - `ANDROID_KEY_PASSWORD` = isti sadržaj `ANDROID_KEYSTORE_PASSWORD.txt`
   - `ANDROID_KEY_ALIAS` = `zadatak`

   Sačuvaj `zadatak-upload.keystore` i lozinku i van projekta (npr. u menadžer lozinki). Ako se izgubi,
   Play Console ga može zamijeniti (Play App Signing), ali to traje nekoliko dana.
4. **Build**: GitHub → *Actions → Android app → Run workflow* (ili push na `main`). U *Releases →
   android-beta* se pojavi `zadatak-release.aab`.
5. **Play Console → Create app**: ime `Zadatak`, jezik bosanski (`bs`), App, Free. Popuni sve iz tačke 3.
6. **Testiranje (obavezno za nove lične naloge)**: *Testing → Closed testing* → upload `.aab` →
   najmanje **12 testera** (Gmail adrese, npr. Google Grupa) koji imaju aplikaciju instaliranu **14 dana
   zaredom**. Tek onda se otključa *Apply for production*. Prije toga može *Internal testing* (do 100
   ljudi, bez pregleda) za brzu provjeru.
7. **Pravi telefon**: prođi registraciju, objavu posla, poruke, blokiranje, kameru (foto-dokaz), lokaciju
   i brisanje naloga na barem jednom Android telefonu.

## 3. Odgovori za Play Console

### Store listing (Main store listing)
- **App name** (do 30): `Zadatak – majstori i poslovi`
- **Short description** (do 80): `Objavi posao, dobij ponude provjerenih majstora i plati sigurno kroz aplikaciju.`
- **Full description**:
  ```
  Zadatak spaja ljude kojima treba posao urađen sa majstorima i izvođačima u Bosni i Hercegovini.

  • Objavi posao besplatno: šta, gdje i kada, uz slike.
  • Dobij ponude i uporedi ocjene, recenzije i značke izvođača.
  • Plati sigurno: Zadatak Pay drži novac dok posao nije urađen, a izvođač ga dobije kad ti potvrdiš.
  • Dopisuj se u aplikaciji. Brojevi telefona se dijele tek kad prihvatiš ponudu.
  • Prati izvođača na mapi dok dolazi i dobij foto-dokaz urađenog posla s mjestom i vremenom.
  • Za majstore: novi poslovi u tvom gradu i tvojoj struci, ponude jednim dodirom, isplata na račun.

  Sigurnost: provjera identiteta, moderacija oglasa i poruka, prijava i blokiranje korisnika.
  Nalog i sve podatke brišeš sam u aplikaciji.

  Za osobe od 18 godina i starije.
  ```
- **App icon**: `google-play-2026-10-18/ikona-512.png` · **Feature graphic**: `google-play-2026-10-18/naslovna-1024x500.png`
- **Phone screenshots**: `google-play-2026-10-18/snimci-ekrana/` (8 slika, 1080×1920)
- **Category**: Lifestyle (ili House & Home) · **Email**: email podrške · **Website**: link sajta

### App content
- **Privacy policy**: `https://bilalishakcanada-wq.github.io/websample/privatnost`
- **Ads**: No, the app does not contain ads.
- **App access**: All or some functionality is restricted → dodaj test nalog za pregled (email + lozinka
  klijenta s Balansom, npr. postojeći `e2e.client@posoba.dev`) i napiši: „Prijava emailom na ekranu Nalog.“
- **Content rating** (IARC upitnik): kategorija *All other app types*; nasilje, seks, droga, kockanje:
  **No**; *Users can interact or exchange content*: **Yes**; *Shares user's location with other users*:
  **Yes** (izvođač dijeli lokaciju dok dolazi); *Digital purchases*: **No**. Očekivana ocjena: PEGI 3/
  Everyone uz oznaku „Users Interact, Shares Location“.
- **Target audience**: **18 and over** (samo ta grupa). *Appeals to children*: No.
- **News app**: No · **COVID-19**: No · **Government app**: No · **Health**: No
- **Financial features**: aplikacija ima novčanik/Balans i escrow za plaćanje usluga → označi
  *Other* i opiši: „Escrow for paying for in-person services between users; no loans, crypto, or trading.“
  (Ako Play traži licencu za držanje novca, to je pitanje za procesor plaćanja; javi.)
- **Account deletion**: *Yes, users can request deletion* · URL:
  `https://bilalishakcanada-wq.github.io/websample/privatnost#brisanje-naloga`
- **Sensitive permissions**: nema obrasca (nema lokacije u pozadini, SMS-a, poziva, svih fajlova ni medija).

### Data safety
Opšte: **Yes** prikupljamo podatke · **Encrypted in transit: Yes** · **Users can request deletion: Yes** ·
podatke **ne dijelimo** s trećima u smislu Googlea (Supabase, Anthropic, GitHub, Resend rade za nas kao
obrađivači, to se ne broji kao dijeljenje).

| Tip podatka (Play) | Prikuplja se | Obavezno? | Svrha |
|---|---|---|---|
| Personal info → Name | da | obavezno | App functionality, Account management |
| Personal info → Email address | da | obavezno | App functionality, Account management, Developer communications |
| Personal info → Phone number | da | opcionalno | App functionality |
| Personal info → Address (adresa posla) | da | opcionalno | App functionality |
| Personal info → User IDs | da | obavezno | App functionality, Account management, Fraud prevention |
| Personal info → Other info (opis, struke, lična karta za provjeru) | da | opcionalno | App functionality, Fraud prevention, security, and compliance |
| Financial info → Purchase history | da | obavezno za plaćanje | App functionality, Fraud prevention |
| Financial info → Other financial info (IBAN za isplatu) | da | opcionalno | App functionality |
| Location → Precise location | da | opcionalno | App functionality |
| Messages → Other in-app messages | da | opcionalno | App functionality, Fraud prevention (moderacija) |
| Photos and videos → Photos | da | opcionalno | App functionality |
| Files and docs | da | opcionalno | App functionality (licence, potvrde) |
| App activity → Other user-generated content (oglasi, ponude, recenzije) | da | opcionalno | App functionality |
| App info and performance → Crash logs / Diagnostics | da | obavezno | Analytics (popravke grešaka) |
| Device or other IDs | da (push pretplata, IP u zaštiti prijave) | obavezno | Fraud prevention, security |

Ne prikupljamo: kontakte, kalendar, zdravlje, audio, SMS, web historiju, instalirane aplikacije,
reklamni ID.

## 4. Dozvole i zašto

| Dozvola | Zašto | Kada se traži |
|---|---|---|
| `INTERNET` | aplikacija učitava Zadatak | nikad (automatski) |
| `CAMERA` | foto-dokaz urađenog posla, slike za oglas/profil/poruke | kad otvoriš kameru |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | mjesto na foto-dokazu, „Krećem“ (mapa uživo), samo dok je aplikacija otvorena | kad uključiš tu funkciju |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` (iz `androidx.biometric`) | otisak/lice prije isplate | nikad (obična dozvola) |
| `ACCESS_NETWORK_STATE`, `WAKE_LOCK` | ako ih biblioteka doda: provjera veze | nikad (obične dozvole) |

Nova dozvola u buildu bez reda u ovoj tabeli ruši CI (korak „Google Play checks“): dodaj je ovdje i u
listu `ALLOWED` u workflowu tek kad je opravdana.

## 5. Kasnije (nije uslov za objavu)
- **Nativne push obavijesti** (`@capacitor/push-notifications` + Firebase): tada se vraća
  `POST_NOTIFICATIONS` i u Data safety dodaje „Device or other IDs“ za FCM token.
- **Vlastita domena** (`zadatak.ba`): promijeniti `server.url`, link politike i URL za brisanje u Play Consoleu.
- **Tableti**: Android 16 na tabletima ignoriše zaključavanje na portret; ekran se tada okreće.
