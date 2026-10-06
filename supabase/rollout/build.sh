#!/usr/bin/env bash
# Builds supabase/rollout/2026-10-06_all_pending.sql: every SQL file that is not yet on the live
# database, in one transaction, so a failure anywhere changes nothing. Run from anywhere:
#   bash supabase/rollout/build.sh
# The order matters where files redefine the same thing (see README.md next to this script).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=supabase/rollout/2026-10-06_all_pending.sql
FILES=(
  security/07_phone_run_false_positives
  performance/01_search_radius_first
  airtasker/04_reach_and_travel
  offers/bid_replies
  payments/02_price_increase_and_cancellation_policy
  identity/id_badge_counts
  offers/job_conditions
  booking/04_fraud_shield
  booking/05_live_location
  marketplace/01_promoted_and_rebids
  security/06_private_uploads
  security/09_signed_in_only_functions
)

{
cat <<'SQL'
-- =============================================================================
-- Zadatak · sve što čeka na živu bazu (06.10.2026.)
--
-- Jedan fajl umjesto dvanaest. Pokreće se jednom, u Supabase SQL Editoru (Run).
-- Sve ide u jednoj transakciji: ako bilo šta ne prođe, baza ostaje kakva je bila.
-- Smije se pokrenuti i više puta. Na kraju piše "Gotovo".
--
-- Sadržaj (redoslijed je bitan):
--   1. security/07          lažne "brojeve telefona" u običnim rečenicama više ne kažnjava
--   2. performance/01       brža pretraga po gradu i udaljenosti
--   3. airtasker/04         doseg ponude po cijeni + "Platiću put", preporuke bez isteklih poslova
--   4. offers/bid_replies   poruke ispod ponude, obavijest kad izvođač izmijeni ponudu
--   5. payments/02          povećanje cijene tokom posla, pravila i naknada za otkazivanje
--   6. identity/id_badge_counts   značka "Lična karta verifikovana" vrijedi kao potvrđen identitet
--   7. offers/job_conditions      uslovi posla (tražene značke) i pogodnosti
--   8. booking/04           zaštita od prevare: zaključan status, provjeren escrow, foto dokaz
--   9. booking/05           "Izvođač je na putu": lokacija uživo
--  10. marketplace/01       izdvojeni oglasi (Hitno/VIP), nova cijena nakon odbijene ponude
--  11. security/06          privatni dokumenti, slike iz poruka i dokazi rada
--  12. security/09          funkcije samo za prijavljene (mora biti zadnje)
--
-- Generisano skriptom supabase/rollout/build.sh iz gornjih fajlova; ne mijenjati ručno.
-- =============================================================================

begin;
-- ako je neka tabela zauzeta, odustani za 15 s umjesto da sajt čeka (pokreni ponovo)
set local lock_timeout = '15s';
SQL

for f in "${FILES[@]}"; do
  printf '\n-- =============================================================================\n'
  printf -- '-- supabase/%s.sql\n' "$f"
  printf -- '-- =============================================================================\n\n'
  cat "supabase/$f.sql"
  printf '\n'
done

cat <<'SQL'

-- =============================================================================
-- Provjera: ako išta od gornjeg nedostaje, cijela transakcija se poništava
-- =============================================================================
do $verify$
declare
  missing text[] := '{}';
begin
  if public.phone_run_hit('Zato sto se ne javite ranije?') or not public.phone_run_hit('061 234 567') then
    missing := missing || 'security/07'::text;
  end if;
  if pg_get_functiondef('public.search_listings_core(text,text,double precision,double precision,double precision,boolean,numeric,numeric,boolean,boolean,text,integer,integer,boolean)'::regprocedure) not like '%lat_span%' then
    missing := missing || 'performance/01'::text;
  end if;
  if to_regprocedure('public.listing_reach(uuid)') is null
     or not exists (select 1 from pg_trigger where tgname = 'bids_reach_guard') then
    missing := missing || 'airtasker/04'::text;
  end if;
  if to_regclass('public.bid_replies') is null
     or not exists (select 1 from pg_trigger where tgname = 'bid_edited_notify') then
    missing := missing || 'offers/bid_replies'::text;
  end if;
  if to_regclass('public.price_increase_requests') is null
     or to_regprocedure('public.request_cancellation(uuid,text,text,text)') is null
     or to_regprocedure('public.request_cancellation(uuid,text,text)') is not null then
    missing := missing || 'payments/02'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'identity_approved_badge')
     or pg_get_functiondef('public.identity_verified(uuid)'::regprocedure) not like '%id_verified%' then
    missing := missing || 'identity/id_badge_counts'::text;
  end if;
  if not public.job_conditions_valid('{"requires":["licence_gas"],"perks":["materials"]}')
     or not exists (select 1 from pg_trigger where tgname = 'bids_conditions_gate')
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'bids_insert_conditions') then
    missing := missing || 'offers/job_conditions'::text;
  end if;
  if to_regclass('public.work_proofs') is null
     or not exists (select 1 from pg_trigger where tgname = 'listings_status_guard')
     or not exists (select 1 from pg_trigger where tgname = 'job_payments_insert_guard')
     or has_function_privilege('authenticated', 'public.job_transition(uuid,public.work_state,jsonb)', 'execute') then
    missing := missing || 'booking/04'::text;
  end if;
  if to_regclass('public.job_live_locations') is null
     or to_regprocedure('public.share_live_location(uuid,double precision,double precision,real,real,real)') is null then
    missing := missing || 'booking/05'::text;
  end if;
  if (select count(*) from public.promotion_plans) < 2
     or to_regprocedure('public.promote_listing(uuid,text)') is null
     or not exists (select 1 from pg_trigger where tgname = 'bids_rebid_guard') then
    missing := missing || 'marketplace/01'::text;
  end if;
  if to_regprocedure('public.private_uploads_enabled()') is null
     or coalesce((select b.public from storage.buckets b where b.id = 'uploads'), true)
     or not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'uploads_read_work') then
    missing := missing || 'security/06'::text;
  end if;
  if has_function_privilege('anon', 'public.my_inbox()', 'execute')
     or has_function_privilege('anon', 'public.request_cancellation(uuid,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.submit_work(uuid,text,text[])', 'execute') then
    missing := missing || 'security/09'::text;
  end if;
  if cardinality(missing) > 0 then
    raise exception 'PROVJERA_NIJE_PROSLA: %', array_to_string(missing, ', ');
  end if;
end $verify$;

-- zapis u listu migracija (vidi se u Supabase → Database → Migrations); ako ne uspije, ne smeta
do $record$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values ('20261006180000', 'rollout_2026_10_06_all_pending',
            array['-- supabase/rollout/2026-10-06_all_pending.sql (github.com/bilalishakcanada-wq/websample)'])
    on conflict (version) do nothing;
  end if;
exception when others then
  raise notice 'zapis migracije preskočen: %', sqlerrm;
end $record$;

commit;

select 'Gotovo: sve je primijenjeno na živu bazu.' as rezultat;
SQL
} > "$OUT"

echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
