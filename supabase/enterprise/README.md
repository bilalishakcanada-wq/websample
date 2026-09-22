# Enterprise moduli — shema

Pokretati **redoslijedom**, jednom, na Supabase projektu `kshzsnceukbpwpgpicsh`:

| Fajl | Modul | Šta donosi |
|---|---|---|
| `01_rbac.sql` | Nalozi i RBAC | permisije, role_permissions, staff_members, audit_log, `has_permission()` |
| `02_kyc.sql` | KYC | kyc_cases/documents/checks, poklapanje imena, pragovi AI-detekcije, red za pregled |
| `03_payments_deposits.sql` | Finansije | depoziti, zabrana povrata, skrivanje provizije, payment_events, fakture |
| `04_jobs_geo_consulting.sql` | Poslovi | premium prag, geofencing, savjetovanja |
| `05_trust_safety.sql` | Trust & Safety | razlozi raskida, strajkovi, bedž povjerenja |
| `06_principal.sql` | Kontekst | `principal_for()` — ovisi o 01–03, ide zadnji |

Sve su **idempotentne** (`if not exists`, `create or replace`, `drop policy if exists`),
pa se mogu pustiti ponovo bez štete.

## Dva koraka koja se rade ručno pri deployu

```sql
-- Realtime: klijent više ne sluša job_payments (curila bi provizija)
alter publication supabase_realtime drop table public.job_payments;
alter publication supabase_realtime add table public.payment_events;
```

I izmjena u `src/services/paymentService.js`:
`from('job_payments').select('*')` → `from('my_payments_client').select('*')`,
a pretplata sa `table: 'job_payments'` → `table: 'payment_events'`.

## Provjera prije produkcije

Šema je testirana lokalno (PostgreSQL, UTF8) nad scaffoldom postojećih tabela;
spisak testiranih invarijanti je u [../../docs/ARHITEKTURA.md](../../docs/ARHITEKTURA.md#7-šta-je-provjereno).
Prije puštanja na živo: pusti na Supabase **branch** (`create_branch`), pa
`npx playwright test` protiv te grane — `can_transact()` mijenja ko smije objaviti
posao, pa E2E odmah pokaže ako je pravilo prestrogo.
