# Sigurnost: provjera 30.10.2026.

Provjereno na kodu, git historiji i živoj bazi (kao gost i kao običan prijavljen korisnik, sve u transakciji koja se vraća). Nazad: [[README]]

## Popravljeno (PR #105, na živoj bazi od 30.10., provjereno)

`supabase/security/13_lock_roles_and_records.sql`:
- **Bilo ko prijavljen mogao je sebi dati ulogu ADMIN** (politika `user_roles_manage_own`). Dokazano: poslije upisa `is_admin()` vraća true i nalog vidi sve profile. Sada uloge mijenja samo `admin_set_role()`. Na bazi i dalje samo 3 uloge (1 admin, 2 moderatora), nema lažnih potvrda telefona, plaćanja ni razgovora bez posla.
- Korisnik mogao sam označiti broj telefona kao potvrđen (okidač iz `11_phone_verification_guard.sql` nije bio na bazi).
- Korisnik mogao sam otvoriti razgovor s bilo kim, bez posla, i pisati mu; ili zamijeniti drugog učesnika. Sada razgovore otvara samo prihvatanje ponude.
- Prijavilac mogao sam zatvoriti ili obrisati svoju prijavu.
- `payment_records`, `subscriptions`: korisnik mogao upisati lažno plaćanje (sajt ih ne koristi). Sada samo čitanje.
- Bucket `avatars` primao bilo koji fajl bilo koje veličine; sada JPG/PNG/WEBP do 5 MB. `media` do 25 MB.

Ostalo u PR-u: `npm audit fix` (express, multer, body-parser, proxy-addr, qs), `.github/dependabot.yml` (samo sigurnosne nadogradnje).

## Već uredu

- Oba moderatora dodao je admin nalog sd preko Admin > Osoblje (zapis u `staff_actions`, 17.09. i 12.10.).

- Ključevi: u repou i historiji (svih 84 grana) samo javni anon ključ. Service role i ostale tajne samo u Supabase/GitHub tajnama.
- RLS uključen na svim tabelama. Gost vidi samo objavljene poslove, javne kartice profila (bez emaila i telefona), recenzije i pitanja.
- Tuđi profili, poruke, isplate, transakcije: prijavljen korisnik vidi 0 redova. Balans, status naloga, identitet, ponude, provizije, prekidači, značke: zaštićeni okidačima i politikama (provjereno).
- Edge funkcije: svaka provjerava JWT, `x-sweep-key` ili potpis webhooka.
- Lozinke: bcrypt (Supabase Auth). SQL: nema dinamičkog SQL-a, sve ide parametrizovano. React escape-uje tekst; `dangerouslySetInnerHTML` samo za naše SVG crteže; mailovi escape-uju korisnički tekst.
- CSP u `index.html`, zaglavlja u `public/_headers` (za Cloudflare), github.io je samo HTTPS.
- Sesija: JWT u localStorage + CSP (HttpOnly kolačić traži vlastiti server, vidi `docs/SIGURNOST.md`).

## Nađeno, nije popravljeno (čeka odluku sd)

- Stari beta Android ključ (`android/app/beta.keystore`, lozinka "android") je u git historiji (27.09.). Više se ne koristi (trenutni beta ključ je drugi, Play ključ je drugi). Brisanje iz historije prepisuje historiju; preporuka: ne treba.
- Supabase panel: uključiti "Prevent use of leaked passwords"; Turnstile CAPTCHA nije uključen (treba Cloudflare site i secret key, koraci u `docs/SIGURNOST.md`).
- `zod` ima propust (popravka tek u verziji 4). Koristi ga samo Express server u `server/`, koji ne radi na produkciji; sajt ga nema u buildu.
- IBAN u `payout_accounts` nije posebno šifrovan (baza je šifrovana na disku, RLS: samo vlasnik).
