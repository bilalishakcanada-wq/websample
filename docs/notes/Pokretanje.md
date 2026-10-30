# Pokretanje (lista za start)

Provjereno 30.10.2026. Status: **gotovo**, **već uredu** ili **čeka vlasnika**.
Povezano: [[../OBJAVA]] (računi i plaćanja koje radi vlasnik), [[../MAILOVI]].

## Pravila projekta

- Radi tačno ono što vlasnik traži, bez dodataka i izmišljenog sadržaja. Kad nije jasno, pitaj.
- Nepovratni koraci (brisanje iz žive baze, pravi ključevi za plaćanje, limiti potrošnje) samo uz izričito "da" vlasnika.
- Promjene u živoj bazi i Edge funkcijama idu tek kad vlasnik odobri (automatski alat ih blokira bez toga).
- Dizajn: bez ljubičastih gradijenata, dugmadi u obliku pilule, lažnih recenzija i brojki, emoji ikona, crtica (—) i AI teksta.
- Nema starta dok: domena nije spojena, favicon postoji, nema oznake "made with AI", Politika privatnosti i Uslovi su živi.

## Stanje

| Stavka | Status |
|---|---|
| Praćenje grešaka | Već uredu: Sentry je u živoj verziji (DSN u GitHub tajni `SENTRY_DSN`). |
| Plaćanje | Nema Stripea. Kartice idu preko Monri (`card-topup-start`), bez ugovora i ključeva je isključeno (`CARD_PAYMENTS_OFF`). Sav novac na balansima je admin uplata (test). Čeka vlasnika: Monri ugovor, pa tajne `MONRI_KEY`, `MONRI_AUTHENTICITY_TOKEN`, `MONRI_ENV=live` (30.10. rekao: poslije starta). |
| Test podaci | Vlasnik odlučio 30.10.: ne brisati ništa. |
| localhost, lorem ipsum, console.log | Već uredu: u izgrađenom sajtu nema localhost adresa (osim unutar biblioteka), nema lorem ipsum, nema console.log. console.error ostaje namjerno (greške). |
| Favicon, slika za dijeljenje, metapodaci | Već uredu: vlastiti favicon, og-image.png, naslov, opis i og oznake na svih 15 javnih stranica. |
| Mailovi s vlastite domene | Već uredu u kodu: info@zadatak.ba (Supabase SMTP i Resend). Domena zadatak.ba je na čekanju dok se ne plati. |
| Kontakt stranica | Gotovo u kodu: poruke su do sada stajale u bazi i niko ih nije vidio. Sada: Admin → Podrška → "Kontakt stranica" i mail adminu s odgovorom direktno pošiljaocu. Primijenjeno u bazi i funkcija `notify-admin` objavljena 30.10. |
| Registracije i aktivacija | Gotovo u kodu: Admin → Rast (aktiviran = posao ili ponuda u prvih 7 dana). Primijenjeno u bazi 30.10. |
| Limit AI troška | U kodu: asistent podrške najviše 20 odgovora na sat i 60 na dan po korisniku, poslije toga lokalni asistent. Funkcija `support-assistant` objavljena 30.10. Vlasnik: mjesečni limit u Anthropic i OpenAI konzoli (30.10. rekao: radi poslije starta). |
| Connection pooling | Već uredu: aplikacija ide samo preko Supabase API-ja (PostgREST ima svoj pool), nema direktnih veza na bazu. |
| Prekidač za rizične funkcije | Već uredu: Admin → Prekidači (uplata karticom, objava posla, slike u porukama, AI asistent, najmanja verzija aplikacije). |
| Uptime alarmi i status stranica | Čeka vlasnika: UptimeRobot (besplatno), vidi ispod. |
| Test od registracije do plaćanja | Robot na svakom PR-u prolazi cijeli tok na lokalnoj bazi (registracija, objava, ponuda, plaćanje balansom, poruke, predaja, odobrenje, recenzija). Test protiv žive baze prije objave nije uključen jer nema tajni `E2E_*`. Plaćanje karticom se ne može testirati bez Monri ugovora. |
| Nova lozinka i info@zadatak.ba | Vlasnik javio 30.10. "došao je mail" (nije rekao koji od ta dva testa). |

## Popravljeno 30.10.

- Pitanja ispod posla nisu pokazivala ime autora: `public_profiles` je pogled nad `public_profile_cards`, pa spajanje preko FK ne radi. Ponude, recenzije i pitanja sada uzimaju imena drugim upitom.
- Glavna kartica s brojem (Balans, Rast) imala je plavi broj na tamnoplavoj pozadini; sada bijeli.

## Otvoreno

- Repo je bio iza žive verzije funkcije `notify-admin`; usklađeno 30.10. Prije svake objave funkcije uporedi s živom verzijom.
- Tabela `public_profile_cards` postoji u bazi, ali ne u repou.
- Na GitHub Pages rute aplikacije (/login, /objavi...) vraćaju status 404 (stranica se ipak prikaže). Rješava se prelaskom na Cloudflare Pages s domenom.
