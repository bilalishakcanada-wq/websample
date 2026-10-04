# Sigurnost prijave i podataka (04.10.2026.)

Zadatak nema svoj server. Sajt je statičan (GitHub Pages), aplikacija učitava taj sajt, a prijava,
baza i fajlovi su na Supabaseu. Zato se dio sigurnosti radi u kodu, a dio u Supabase podešavanjima.

## 1. Lozinke (bcrypt)

Supabase Auth sam hešira lozinke **bcryptom**. Provjereno na produkciji 04.10.2026.: svih 6 naloga
s lozinkom ima bcrypt heš (`$2a$…`), a 3 Google naloga nemaju lozinku. Lozinka nikad ne prolazi
kroz naš kod niti se čuva u čitljivom obliku.

U kodu: ista pravila na registraciji, resetu i promjeni lozinke (najmanje 8 znakova, veliko i malo
slovo, broj; najviše 72 jer bcrypt čita samo prva 72 bajta). Ranije je promjena lozinke u postavkama
tražila samo 8 znakova.

## 2. Sesija (JWT)

Sesija je već **JWT** koji Supabase potpisuje: važi 1 sat, obnavlja se kratkotrajnim tokenom koji se
mijenja pri svakoj upotrebi (ukradeni stari token ne radi).

**HttpOnly kolačić nije moguć dok je sajt na GitHub Pagesu:** takav kolačić može postaviti samo
server na istoj domeni, a mi ga nemamo. HttpOnly štiti od jedne stvari: da ubačena skripta (XSS)
pročita token. Tu istu zaštitu sada daje **sigurnosna politika stranice (CSP)**, dodana u ovom PR-u:
pretraživač pokreće samo naše skripte i šalje podatke samo na naš Supabase, pa ubačena skripta niti
se pokrene niti može token poslati negdje drugo. Kad sajt pređe na vlastitu domenu iza Cloudflarea,
može se dodati mali server (Cloudflare Worker) koji drži sesiju u HttpOnly kolačiću.

## 3. Provjera unosa (SQL injection i XSS)

- **SQL injection:** sajt ne sastavlja SQL. Svi upiti idu preko Supabase API-ja s parametrima, a
  pravila baze (RLS) odlučuju ko šta smije. Jedino mjesto gdje se tekst korisnika ubacuje u filter je
  pretraga poslova; sada se uklanjaju svi znakovi koji bi mogli dodati novi uslov (`, ( ) " \ * :`).
- **XSS:** React sav tekst prikazuje kao tekst, nigdje se ne koristi `dangerouslySetInnerHTML`, a
  React 19 blokira `javascript:` linkove. Novo:
  - CSP (gore) kao druga linija odbrane.
  - `supabase/security/08_safe_file_links.sql`: baza prima samo linkove na naše fajlove (slike u
    porukama, dokumenti za verifikaciju, portfolio, slike oglasa, dokazi rada i spora), profilnu
    sliku samo kao `https://`, a link u obavještenju samo kao putanju na sajtu. Do sada je neko mogao
    direktno preko API-ja upisati link na lažnu stranicu kao "dokument", koji bi admin otvorio.
    Provjereno na produkciji: nijedan postojeći red ne krši pravila.

## 4. Ograničenje pokušaja prijave

- **Pravo ograničenje je na Supabaseu** (po IP adresi), jer se API može zvati i mimo sajta. Vidi
  podešavanja ispod.
- U sajtu (novo): 5 pogrešnih lozinki za isti email u 15 minuta, pa poruka "Pokušaj ponovo za X
  minuta"; email za reset lozinke najviše jednom u minuti i 5 puta na sat; 5 novih naloga na sat s
  istog uređaja. Greške Supabasea o previše pokušaja prikazuju se na bosanskom.
- CAPTCHA (Cloudflare Turnstile) je već ugrađena u prijavu i registraciju, ali nije uključena (vidi
  podešavanja).

## 5. CORS

- **Edge funkcije** (`delete-account`, `support-assistant`, `moderate-media`, `trust-agent`,
  `card-topup-start`) su do sada odgovarale svakoj stranici (`*`). Sada samo našim:
  `https://bilalishakcanada-wq.github.io`, aplikaciji
  (`capacitor://localhost`, `https://localhost`) i lokalnom razvoju. Ostale dobiju 403 prije nego
  funkcija išta uradi. Nova domena (npr. nakon promjene imena) dodaje se u Supabase tajnu
  `ALLOWED_ORIGINS`, bez mijenjanja koda. Pozivi bez `Origin` zaglavlja (cron, Monri) rade kao prije.
  Kod je u `supabase/functions/_shared/cors.ts`.
- **Supabase API (baza i prijava)** ne dozvoljava ograničenje CORS-a; tamo štite RLS pravila i
  ograničenja pokušaja.
- Express server u `server/` (ne koristi se na produkciji) već dozvoljava samo `CORS_ORIGIN`.

## Šta treba uraditi na produkciji

Iz projekta (Claude), kad vlasnik napiše tačnu rečenicu:

1. Primijeniti `supabase/security/08_safe_file_links.sql` na bazu.
2. Objaviti edge funkcije `delete-account`, `support-assistant`, `moderate-media` i `trust-agent`
   s novim CORS pravilima (`card-topup-start` ide kad se uključe kartična plaćanja).

U Supabase panelu (vlasnik, https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh):

1. **Authentication → Rate Limits:** "Sign-ups and sign-ins" najviše 30 na 5 minuta po IP adresi,
   "Token verifications" 30, "Emails" po potrebi (ugrađeni email je ograničen na 2 na sat).
2. **Authentication → Sign In / Providers → Email:** "Minimum password length" 8,
   "Password requirements" "Lowercase, uppercase letters and digits". Ako plan dozvoljava, uključiti
   "Prevent use of leaked passwords".
3. **Authentication → URL Configuration:** "Site URL" `https://bilalishakcanada-wq.github.io/websample/`;
   "Redirect URLs" samo `https://bilalishakcanada-wq.github.io/websample/**` i `ba.poso.app://**`
   (obrisati sve ostalo, npr. localhost).
4. **CAPTCHA (preporučeno):** na https://dash.cloudflare.com → Turnstile napraviti widget za domenu
   `bilalishakcanada-wq.github.io`. **Secret key** upisati u Supabase → Authentication → Attack
   Protection → "Enable CAPTCHA protection" (Turnstile). **Site key** poslati Claudeu: on je javan i
   ide u build sajta (`VITE_TURNSTILE_SITE_KEY`). Redoslijed je bitan: prvo novi sajt sa site keyem,
   pa tek onda uključiti CAPTCHA u Supabaseu, inače prijava ne radi.
