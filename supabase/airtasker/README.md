# Airtasker-style pravila (rokovi, istek posla, obavezni uslovi, sačuvani poslovi, doseg i put, zahtjev za ponudu)

Pokrenuti ovim redom na Supabase bazi:

1. `01_task_schedule_and_expiry.sql` — kolone `date_type`, `due_date`, `time_of_day`, `requirements`;
   status `expired`; posao kojem je prošao rok ne prima ponude i ne može se prihvatiti ponuda
   dok vlasnik ne izabere novi datum; cron `expire-overdue-listings` svakih 15 minuta.
2. `02_search_due_dates.sql` — pretraga vraća rok i ima sortiranje „Rok uskoro“ (`due_soon`).
3. `03_saved_tasks.sql` — tabela `saved_listings` (Sačuvani poslovi), vidljiva samo vlasniku.
4. `04_reach_and_travel.sql` — doseg ponuda: koliko daleko izvođač smije biti od posla zavisi od
   toga koliko posao plaća (budžet + novac za put); ponuda izvan dosega se odbija
   (`PREDALEKO`), a izvođač bez grada u profilu dobija `GRAD_POTREBAN`. `listing_reach(id)` vraća
   doseg i udaljenost za prijavljenog korisnika; preporučeni poslovi ne nude poslove izvan dosega.
   Poslovi s rokom danas ili sutra dobijaju malu prednost u preporukama („Treba brzo“).
5. `05_quote_requests.sql` — „Zatraži ponudu“: klijent sa profila izvođača pošalje posao samo
   njemu (`invited_provider`). Posao ne vidi niko drugi (ni pretraga, ni obavijesti, ni javni
   profil), ponudu može poslati samo taj izvođač (`SAMO_POZVANI`) i doseg za njega ne važi.
   Izvođač može odbiti (`decline_quote_request`), klijent dobija obavijest i može „Objavi svima“.
   Najviše 10 zahtjeva dnevno po klijentu.

| Plaća (budžet + put) | Ponude do |
|---|---|
| „Po dogovoru“ bez puta | 25 km |
| do 49 KM | 15 km |
| 50–99 KM | 25 km |
| 100–199 KM | 40 km |
| 200–399 KM | 70 km |
| 400–799 KM | 120 km |
| 800 KM i više | cijela BiH |
| online posao | cijela BiH |

Udaljenost je zračna linija od grada u profilu izvođača do grada posla.

Aplikacija radi i prije nego što se ovo pokrene (stari način: rok u opisu), ali rok, istek,
obavezni uslovi, sačuvani poslovi, doseg i zahtjev za ponudu rade tek nakon migracija.
Privatni zahtjev se nikad ne objavljuje javno ako 05 još nije pokrenut: aplikacija tada javi da
„Zatraži ponudu“ još nije uključeno.

Svih pet datoteka je testirano zajedno s ostalim SQL-om koji čeka (bid_replies, PR #9) na kopiji
žive baze (supabase/postgres slika + 122 žive migracije), dvaput zaredom.
