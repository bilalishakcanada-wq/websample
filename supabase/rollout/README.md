# Objava na živu bazu (06.10.2026.)

`2026-10-06_all_pending.sql` je jedan fajl sa svim SQL-om koji je bio napisan, a nije bio na živoj
bazi. Pravi ga `build.sh` od dvanaest izvornih fajlova; mijenjaju se izvorni fajlovi, pa se pokrene
`bash supabase/rollout/build.sh`, a generisani fajl se ne dira ručno.

## Kako se pokreće

1. Prijava na Supabase nalog kojem projekat pripada ("akessonlana@gmail.com's Project").
2. SQL Editor: https://supabase.com/dashboard/project/kshzsnceukbpwpgpicsh/sql/new
3. Zalijepiti cijeli fajl i kliknuti **Run**. Ako Supabase upozori na "destructive operation"
   (fajl briše i ponovo pravi stara pravila), potvrditi sa **Run this query**.
4. Rezultat je jedan red: `Gotovo: sve je primijenjeno na živu bazu.`

Sve je u jednoj transakciji. Ako bilo šta ne prođe (i provjera na kraju fajla), baza ostaje kakva je
bila i Supabase pokaže grešku. Fajl se smije pokrenuti više puta.

## Redoslijed

| # | Fajl | Šta donosi | Redoslijed |
|---|------|------------|------------|
| 1 | security/07 | obične rečenice više nisu "broj telefona" | |
| 2 | performance/01 | brža pretraga (`search_listings_core`) | prije 10, koji je koristi |
| 3 | airtasker/04 | doseg ponude po cijeni, "Platiću put" | |
| 4 | offers/bid_replies | poruke ispod ponude | |
| 5 | payments/02 | povećanje cijene, naknada za otkaz | |
| 6 | identity/id_badge_counts | značka "Lična karta" vrijedi kao identitet | prije 7, koji koristi `identity_verified` |
| 7 | offers/job_conditions | uslovi posla i pogodnosti | |
| 8 | booking/04 | zaključan status, provjeren escrow, foto dokaz | |
| 9 | booking/05 | lokacija uživo (isti fajl kao u PR #23) | |
| 10 | marketplace/01 | Hitno/VIP, ponovna ponuda poslije odbijanja | |
| 11 | security/06 | privatni bucket `uploads` za dokumente, slike iz poruka i dokaze rada | |
| 12 | security/09 | funkcije samo za prijavljene | zadnji, jer gornji prave nove funkcije |

Nijedna funkcija nije definisana u dva dijela; svaki dio je nadskup onoga što je na živoj bazi
(provjereno poređenjem sa živom bazom 06.10.2026.).

## Kako je testirano

- Lokalna kopija žive baze (`robot/local-db`, ista do zadnje funkcije, pravila i dozvole), pa ovaj
  fajl: prošao tri puta zaredom.
- `scenario_test.sql` na toj kopiji: klijenti i izvođači prolaze sve iz paketa (uslovi posla, doseg,
  ponovna ponuda, Hitno/VIP, escrow, povećanje cijene, foto dokaz, lokacija uživo, otkaz sa naknadom,
  privatni fajlovi, funkcije samo za prijavljene). Sve se vraća na kraju (`rollback`).
  ```
  psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/rollout/scenario_test.sql
  ```
- Svi e2e testovi (`e2e/*.spec.js`) protiv te kopije.
- Robot (`robot/local-db/setup.sh`) od sada pravi bazu istim fajlom, pa testira ono što ide uživo.
