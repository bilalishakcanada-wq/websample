# Poso.ba

**Live (beta):** https://bilalishakcanada-wq.github.io/websample/ — vodič za testere: [BETA.md](BETA.md) · mobilna/native aplikacija: [MOBILE.md](MOBILE.md)

Bosanski marketplace za lokalne usluge — povezuje korisnike koji trebaju pomoć sa provjerenim
izvođačima (majstori, IT, dizajn, čišćenje, selidbe, itd.), inspirisan Airtaskerom ali sa
originalnim BiH identitetom.

## Stack

- React 19 + Vite
- React Router
- Supabase (auth, Postgres, storage, RLS)
- Express server (opciono, za buduće server-side potrebe)
- vite-plugin-pwa (instalabilna web aplikacija)

## Šta je stvarno implementirano

- Puna marketplace naslovna stranica sa pravim fotografijama, kategorijama, poslovima i izvođačima
- Registracija, prijava, reset lozinke — povezano na pravi Supabase Auth
- Objava/uređivanje/brisanje oglasa (Dashboard) sa RLS-om po korisniku
- Pretraga i filtriranje oglasa po gradu, kategoriji i cijeni
- Slanje ponuda na oglase (applications) i prihvatanje ponuda od vlasnika oglasa
- Moderacija sadržaja — oglasi sa zabranjenim sadržajem (oružje, droga) se automatski odbijaju,
  i na nivou aplikacije i na nivou baze (Postgres trigger)
- Prijava oglasa (reports) od strane korisnika
- Live chat podrška (support widget) povezan na bazu + admin inbox za odgovaranje
- Admin panel (/admin) — podrška, prijave, moderacija oglasa, upravljanje korisnicima
- Brisanje naloga (GDPR-style) putem Supabase Edge Function-a
- PWA — instalabilna na telefon (manifest + service worker + ikone), Web Push obavijesti (ponude, poruke, isplate)
- Poso.ba Pay — balans (pravi novac), rezervacija uplate pri prihvatanju ponude, oslobađanje, sporovi, admin rješavanje
- Staff konzola (/admin, /mod) — nadzor uživo, dosijei, značke, suspenzije, balans, greške aplikacije
- Capacitor ljuska za iOS/Android (`ios/`, `android/`)

## Šta NIJE implementirano (namjerno)

- Stvarni payment provider (Stripe/RevenueCat/itd.) — sve je pripremljeno za kasniju integraciju
- Push notifikacije — infrastruktura nije još postavljena
- Native iOS/Android aplikacija — trenutno je ovo web aplikacija (PWA-installable)

## Lokalni razvoj

```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Build

```bash
npm run build
```

## Supabase podešavanje

1. Pokreni `supabase/schema.sql` u Supabase SQL editoru (osnovna šema, ako već nije pokrenuta).
2. Pokreni `supabase/migration_moderation_and_support.sql` (moderacija, admin uloge, support chat).
3. Registruj se u aplikaciji, pa sebe postavi za admina po uputama na dnu te migracije.
4. (Opciono) Deploy `supabase/functions/delete-account` za pravo brisanje naloga:
   `supabase functions deploy delete-account` + `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`

## Environment varijable

Kopiraj `.env.example` ili `.env.local.example` u `.env.local` i popuni prave vrijednosti.
