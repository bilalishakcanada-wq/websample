# Airtasker-style pravila (rokovi, istek posla, obavezni uslovi, sačuvani poslovi)

Pokrenuti ovim redom na Supabase bazi:

1. `01_task_schedule_and_expiry.sql` — kolone `date_type`, `due_date`, `time_of_day`, `requirements`;
   status `expired`; posao kojem je prošao rok ne prima ponude i ne može se prihvatiti ponuda
   dok vlasnik ne izabere novi datum; cron `expire-overdue-listings` svakih 15 minuta.
2. `02_search_due_dates.sql` — pretraga vraća rok i ima sortiranje „Rok uskoro“ (`due_soon`).
3. `03_saved_tasks.sql` — tabela `saved_listings` (Sačuvani poslovi), vidljiva samo vlasniku.

Aplikacija radi i prije nego što se ovo pokrene (stari način: rok u opisu), ali rok, istek,
obavezni uslovi i sačuvani poslovi rade tek nakon migracija.
