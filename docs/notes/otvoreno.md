# Otvoreno

Stanje na 30.10.2026. Briši stavku kad je gotova. Nazad: [[README]]

## Čeka na sd

- **Sigurnosna popravka baze** (`supabase/security/13_lock_roles_and_records.sql`): svaki prijavljen korisnik može sebi dati ulogu ADMIN. Primjena na živu bazu čeka odobrenje sd. Detalji u [[sigurnost]]. (30.10.)
- **Provjeriti moderatora dodanog 17.09.** (Admin > Osoblje): da li je namjerno. Vidi [[sigurnost]]. (30.10.)
- **Supabase > Authentication > Attack Protection:** uključiti zaštitu od procurjelih lozinki. (30.10.)
- **Supabase Pro (25 USD mjesečno).** Besplatni plan nema rezervne kopije baze, a u bazi je novac korisnika.
  Supabase > Billing > Upgrade to Pro. (Traženo 28.10.)
- **zadatak.ba na Cloudflare.** Na GitHubu dodati tajne `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID`;
  koraci u `docs/OBJAVA.md` (tačka 3) i `BETA.md`. Poslije toga Claude prebacuje sajt i aplikaciju na domenu.
- **SMS tajna u Supabaseu.** SMS kodovi još ne stižu; čeka novi tajni ključ u Supabase > Edge Functions > Secrets.
  (Stanje 26.10.)
- **Google Play.** Verzija 62 je u closed testingu; čeka korak sd u Play Consoleu. (Stanje 26.10.)
- **Rezervacija budžeta pri objavi posla.** PR #67 je spreman i testiran; promjena na živoj bazi čeka odobrenje sd. (Stanje 22.10.)
- **Sentry DSN**, ako sd želi hvatanje padova (kod je spreman, PR #98).
- **Testni nalozi u GitHub tajnama**, da testovi prije objave ne budu preskočeni. (Traženo 28.10.)
- **Plaćanje karticom (Monri)**: sd radi kasnije.
- **Podaci o firmi** (ime, adresa, ID broj) za Uslove, Privatnost i podnožje. Ne izmišljati, pitati sd.
- **Pravila povrata novca** (Balans i plaćanja): sd radi kasnije.
- **Supabase Auth email šabloni** (potvrda, lozinka, link za prijavu): u `supabase/email-templates/` su novi
  (bez emojija i pilula), ali ih treba zalijepiti u Supabase > Authentication > Email Templates.
- **AI krediti na Anthropic računu** (`docs/OBJAVA.md` tačka 4). Nije provjereno da li je još potrebno.

## Uslovi za pokretanje (iz [[pravila]])

- [ ] Vlastita domena: zadatak.ba kupljena, sajt još na GitHub Pages.
- [x] Favicon: `public/favicon.svg`, povezan u `index.html`.
- [ ] Oznaka "made with AI": u kodu nije nađena (30.10.), treba još provjeriti živi sajt i aplikaciju.
- [x] Politika privatnosti: `/privatnost`. Pravni pregled preporučen.
- [x] Uslovi korištenja: `/pravila`. Pravni pregled preporučen.
- [x] Duge crte (—) uklonjene iz sajta, aplikacije, emailova i obavijesti (PR #101).
