# Šta treba za pravo pokretanje (07.10.2026.)

Provjereno na živom sistemu 07.10.2026. Ovdje je samo ono što može uraditi vlasnik (računi, plaćanja,
odluke). Sve ostalo radi Claude.

## 1. Mailovi (najvažnije)

Supabase-ov ugrađeni pošiljalac šalje mailove samo članovima tima projekta, najviše 2 na sat. Pravi
korisnik zato ne dobije mail za novu lozinku. Novi nalozi se od 29.09. potvrđuju sami, bez maila, pa se
svako može registrovati i s tuđim emailom. Treba vlastiti SMTP.

**Najbrže, bez domene (10 minuta), preko Gmaila:**

1. Napravi Gmail za Zadatak (npr. `zadatak.podrska@gmail.com`) ili uzmi postojeći.
2. Na https://myaccount.google.com/security uključi „2-Step Verification“, pa na
   https://myaccount.google.com/apppasswords napravi lozinku za aplikaciju (ime: Supabase). Dobiješ 16 slova.
3. Supabase (prijavljen kao akessonlana@gmail.com) → projekat → **Authentication → Emails → SMTP Settings**
   → „Enable custom SMTP“:
   - Sender email: taj Gmail; Sender name: `Zadatak`
   - Host: `smtp.gmail.com`, Port: `465`
   - Username: taj Gmail; Password: onih 16 slova
4. **Authentication → Sign In / Providers → Email:** uključi „Confirm email“. Sajt to već podržava
   (poslije registracije kaže „provjeri email“).
5. Javi Claudeu: provjerit će da mail stiže.

Gmail šalje do oko 500 mailova dnevno, dovoljno za početak. Kad bude vlastita domena (tačka 3), prelazi
se na pošiljaoca s domenom (npr. Resend), da mailovi dolaze s adrese `@tvoja-domena`.

Šabloni na bosanskom (nije obavezno, ali Supabase inače šalje engleski tekst) su na dnu ovog fajla.

## 2. Supabase Pro (25 USD mjesečno)

Projekat je na besplatnom planu: **nema rezervnih kopija baze**, a projekat se sam ugasi poslije sedmice
bez dovoljno aktivnosti. U bazi je novac korisnika (Balans), pa je Pro potreban prije pravog starta.
Pro čuva dnevne kopije 7 dana.

Supabase → organizacija „akessonlana@gmail.com's Org“ → **Billing → Upgrade to Pro**.

## 3. Vlastita domena

GitHub ne dozvoljava GitHub Pages za sajt koji služi plaćanju i prijavi lozinkom („not ... allowed to be
used ... to run your online business, e-commerce site, or any other website that is primarily directed at
either facilitating commercial transactions“). Domena treba i za mailove s vlastite adrese.

1. Kupi domenu (npr. `zadatak.ba` ili `zadatak.app`).
2. Napravi besplatan račun na https://dash.cloudflare.com i dodaj domenu (Cloudflare kaže koje
   nameservere upisati kod prodavca domene).
3. Cloudflare → My Profile → API Tokens → „Create Token“ → „Create Custom Token“ s dozvolom
   Account → Cloudflare Pages → Edit. Na GitHubu, Settings → Secrets and variables → Actions, dodaj `CLOUDFLARE_API_TOKEN` (token) i
   `CLOUDFLARE_ACCOUNT_ID` (Account ID s početne strane Cloudflarea).
4. Javi Claudeu ime domene: on prebacuje sajt, aplikaciju, prijavu i pravila prijave na novu adresu.

## 4. AI provjera (oko 10 USD)

Automatska provjera slika, procjena rizika profila i asistent u podršci ne rade od 16.09.2026: Anthropic
odgovara „Your credit balance is too low“. Na https://console.anthropic.com (račun čiji je ključ
`ANTHROPIC_API_KEY` u Supabase → Edge Functions → Secrets) → **Billing → Add credits**. Ako ne znaš koji je
to račun, napravi novi ključ na računu s kreditom i zamijeni tu tajnu.

## 5. Pravni dio

- Zadatak Pay čuva tuđi novac dok posao nije gotov. Provjeri s knjigovođom ili advokatom treba li za to
  registrovana firma ili dozvola, i kako se knjiže naknade.
- Pošalji Claudeu ime firme (ili svoje ime), grad i email za podršku. Ide u Politiku privatnosti i u
  Apple i Google, koji traže odgovornu osobu i kontakt.
- Politika privatnosti i Uslovi korištenja su napisani prema stvarnim pravilima sajta; pravni pregled je
  preporučen.

## 6. Već poznato (od ranije)

- Admin → Identitet → „Uključi provjeru ponovo“ (lična karta za objavu i ponude).
- Koraci iz `docs/SIGURNOST.md` u Supabase panelu.
- Dvije Android tajne (`ANDROID_BETA_KEYSTORE_BASE64`, `ANDROID_BETA_KEYSTORE_PASSWORD`) iz foldera
  android-beta-key, da nova verzija aplikacije ide preko stare.
- Jednom proći kroz živi sajt prijavljen: objaviti posao, poslati ponudu i poruku.
- Rečenica „premjesti stare fajlove“ (10 starih test fajlova, među njima 2 lične karte, još su javni po linku).

## Android

- **APK (glavni put):** radi. Stranica `/aplikacija` na sajtu ima dugme za preuzimanje i upute.
- **2027:** Google će tražiti registraciju developera i za APK izvan Google Playa (25 USD, lična karta, u
  Android Developer Consoleu). Za BiH još ne važi; Claude javlja kad krene.
- **Google Play (nije obavezno):** 25 USD i lična karta; novi lični račun mora 14 dana testirati sa najmanje
  12 testera prije objave; obrasci o podacima i finansijskim funkcijama. Izdvajanje oglasa („Hitno“, „VIP“)
  se u Play verziji ne smije plaćati Balansom (Google traži svoje plaćanje, a iz BiH se ne može
  registrovati za prodaju), pa ga Claude u toj verziji sakrije.

## iPhone (App Store)

- **Ti:** Apple Developer račun, najbolje **na firmu** (99 USD godišnje; treba besplatan D-U-N-S broj),
  jer Appleova pravila kažu da aplikacije s finansijskim uslugama objavljuje firma, ne fizičko lice. Mac ne treba: Claude gradi i šalje
  aplikaciju preko GitHuba.
- **Claude, prije slanja Appleu:** ugraditi sajt u samu aplikaciju (Apple odbija aplikacije koje samo
  učitavaju sajt), blokiranje korisnika, prijava s Apple računom (dugme je spremno, pojavi se kad se Apple
  uključi u Supabaseu), sakriti plaćeno izdvajanje oglasa u iPhone verziji (Apple za to traži svoje
  plaćanje), privatnosni manifest.
- **Ti, pri slanju:** opis, slike ekrana, upitnici o privatnosti i uzrastu u App Store Connectu, demo nalog
  za Appleov pregled.

## Kasnije

- Plaćanje karticom (Monri račun, ključevi `MONRI_KEY` i `MONRI_AUTHENTICITY_TOKEN`).

---

## Email šabloni (Supabase → Authentication → Emails → Templates)

**Confirm signup** — Subject: `Potvrdi svoj email za Zadatak`

```html
<h2>Dobrodošao na Zadatak</h2>
<p>Klikni dugme da potvrdiš email i završiš registraciju:</p>
<p><a href="{{ .ConfirmationURL }}">Potvrdi email</a></p>
<p>Ako se nisi registrovao na Zadatku, slobodno ignoriši ovaj mail.</p>
```

**Reset password** — Subject: `Nova lozinka za Zadatak`

```html
<h2>Nova lozinka</h2>
<p>Neko je zatražio novu lozinku za tvoj Zadatak nalog. Klikni dugme i upiši novu:</p>
<p><a href="{{ .ConfirmationURL }}">Postavi novu lozinku</a></p>
<p>Ako to nisi bio ti, ignoriši ovaj mail; lozinka ostaje ista.</p>
```

**Change email address** — Subject: `Potvrdi novi email za Zadatak`

```html
<h2>Promjena emaila</h2>
<p>Klikni dugme da potvrdiš da je {{ .NewEmail }} tvoj novi email na Zadatku:</p>
<p><a href="{{ .ConfirmationURL }}">Potvrdi novi email</a></p>
<p>Ako to nisi tražio, piši nam odmah preko stranice Kontakt.</p>
```
