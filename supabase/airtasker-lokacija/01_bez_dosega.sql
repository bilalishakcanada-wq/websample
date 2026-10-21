-- Lokacija kao na Airtaskeru, 1: bez dosega ponuda i bez molbe za prevoz.
-- Udaljenost više ne ograničava ko smije poslati ponudu ili pitanje: svako ko vidi posao može se javiti,
-- a udaljenost se samo prikazuje. Pokrenuti poslije reach/01. Može se pokrenuti više puta.
-- Vraćanje: ponovo pokrenuti supabase/reach/01_device_location_and_travel_requests.sql.
begin;

-- nijedan posao više nema granicu: listing_reach_km je null (= "cijela BiH") za svaki posao, pa i
-- reach_status, listing_reach, preporuke i jobs_near_location sami prestaju ograničavati
create or replace function public.listing_reach_km(p_price numeric, p_travel numeric)
returns numeric language sql immutable set search_path = public
as $$ select null::numeric $$;

-- ponude i pitanja ispod posla: bez provjere udaljenosti
drop trigger if exists bids_reach_guard on public.bids;
drop trigger if exists listing_questions_reach_guard on public.listing_questions;

-- molba za prevoz: nove se više ne šalju (stare ostaju u bazi kao zapis)
create or replace function public.request_travel(p_listing uuid, p_kind text, p_amount numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  raise exception 'MOLBA_NIJE_MOGUCA: molba za prevoz više ne postoji, ponudu možeš poslati direktno' using errcode = 'P0001';
end $$;

commit;
