-- ============================================================================
-- Uslovi i pogodnosti posla: klijent traži značke, baza ih provjerava
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Klijent pri objavi posla bira:
--   * USLOVE  — značke koje izvođač mora imati da bi poslao ponudu
--               (telefon, uvjerenje o nekažnjavanju, licence…);
--   * POGODNOSTI — šta klijent obezbjeđuje (materijal, alat, parking, obrok).
--     Plaćanje puta/goriva već postoji kao listings.travel_allowance (airtasker/01).
--
-- Sve stoji u listings.conditions (jsonb):
--   {"requires": ["licence_electrician", "police_check"], "perks": ["materials", "parking"]}
--
-- Gradi se na postojećem: značke su badges/user_badges (dodjeljuje ih samo tim
-- ili sistemski okidači), identitet je identity_verified(). Lična karta je ionako
-- uslov za svaku ponudu (bids_require_verified.sql), pa se "id_verified" ne bira.
--
-- Provjera ponude ide u bazu (okidač + restriktivna politika), ne samo u sučelje:
-- izvođač bez tražene značke ne može poslati ponudu ni direktnim API pozivom.
-- Nema zaobilaznice za testere u ovoj datoteci — testni nalozi sa svim značkama
-- postoje samo u privatnoj test bazi (robot/local-db).
-- Idempotentno: može se pokrenuti više puta.
-- ============================================================================

-- 1. Katalog: koje značke klijent smije tražiti i koje pogodnosti postoje.
--    Funkcija je immutable da bi je check constraint smio koristiti.
create or replace function public.job_requirement_codes()
returns text[]
language sql immutable set search_path = public as $fn$
  select array['mobile_verified', 'police_check', 'payment_verified',
               'licence_electrician', 'licence_plumber', 'licence_gas',
               'licence_hvac', 'licence_construction', 'licence_driver'];
$fn$;

create or replace function public.job_perk_codes()
returns text[]
language sql immutable set search_path = public as $fn$
  select array['materials', 'tools', 'parking', 'meal', 'transport_help'];
$fn$;

create or replace function public.job_conditions_valid(p jsonb)
returns boolean
language sql immutable set search_path = public as $fn$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_object_keys(p) k where k not in ('requires', 'perks'))
     and (not p ? 'requires' or (
           jsonb_typeof(p->'requires') = 'array'
           and jsonb_array_length(p->'requires') <= 5
           and not exists (select 1 from jsonb_array_elements(p->'requires') e
                           where jsonb_typeof(e) <> 'string' or not (e #>> '{}') = any (public.job_requirement_codes()))))
     and (not p ? 'perks' or (
           jsonb_typeof(p->'perks') = 'array'
           and jsonb_array_length(p->'perks') <= 6
           and not exists (select 1 from jsonb_array_elements(p->'perks') e
                           where jsonb_typeof(e) <> 'string' or not (e #>> '{}') = any (public.job_perk_codes()))));
$fn$;

grant execute on function public.job_requirement_codes() to anon, authenticated;
grant execute on function public.job_perk_codes() to anon, authenticated;
grant execute on function public.job_conditions_valid(jsonb) to anon, authenticated;

-- 2. Kolona na poslu
alter table public.listings add column if not exists conditions jsonb not null default '{}'::jsonb;
alter table public.listings drop constraint if exists listings_conditions_check;
alter table public.listings add constraint listings_conditions_check check (public.job_conditions_valid(conditions));

-- 3. Akreditivi korisnika: kodovi značaka koje drži + 'id_verified' kad je identitet
--    potvrđen (isto pravilo kao kapija za ponude). SECURITY DEFINER jer
--    identity_state nije javan; drugi korisnik dobija samo javne značke.
create or replace function public.user_credentials(p_user uuid default auth.uid())
returns text[]
language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(distinct code order by code), '{}')
  from (
    select b.code from public.user_badges ub join public.badges b on b.id = ub.badge_id
    where ub.user_id = p_user
    union all
    select 'id_verified'
    where (p_user = auth.uid() or public.is_admin())
      and public.identity_verified(p_user)
  ) c;
$fn$;

revoke execute on function public.user_credentials(uuid) from public, anon;
grant execute on function public.user_credentials(uuid) to authenticated;

-- 4. Šta prijavljeni korisnik trenutno smije (jedno mjesto za sučelje).
create or replace function public.my_permissions()
returns jsonb
language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'credentials', to_jsonb(public.user_credentials(auth.uid())),
    'identity_verified', public.identity_verified(auth.uid()),
    'suspended', public.is_suspended(),
    'can_post_job', public.identity_verified(auth.uid()) and not public.is_suspended(),
    'can_bid', public.identity_verified(auth.uid()) and not public.is_suspended()
  )
  where auth.uid() is not null;
$fn$;

revoke execute on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

-- 5. Nedostajuće značke za ponudu na ovaj posao (prazno = smije).
create or replace function public.job_missing_requirements(p_listing uuid, p_user uuid default auth.uid())
returns text[]
language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(r order by r), '{}')
  from public.listings l,
       jsonb_array_elements_text(coalesce(l.conditions->'requires', '[]'::jsonb)) r
  where l.id = p_listing
    and not exists (select 1 from public.user_badges ub join public.badges b on b.id = ub.badge_id
                    where ub.user_id = p_user and b.code = r);
$fn$;

revoke execute on function public.job_missing_requirements(uuid, uuid) from public, anon, authenticated;

create or replace function public.bid_meets_conditions(p_listing uuid, p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select cardinality(public.job_missing_requirements(p_listing, p_user)) = 0;
$fn$;

revoke execute on function public.bid_meets_conditions(uuid, uuid) from public, anon;
grant execute on function public.bid_meets_conditions(uuid, uuid) to authenticated;

-- 6. Kapija na ponudama: okidač daje jasnu poruku (USLOV_POSLA + kodovi),
--    restriktivna politika drži i kad bi okidač nekad bio uklonjen.
create or replace function public.guard_bid_conditions()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_missing text[];
begin
  v_missing := public.job_missing_requirements(new.listing_id, new.bidder_id);
  if cardinality(v_missing) > 0 then
    raise exception 'USLOV_POSLA: nedostaju značke %', array_to_string(v_missing, ',')
      using errcode = '42501', hint = 'conditions_required', detail = array_to_string(v_missing, ',');
  end if;
  return new;
end $fn$;

revoke execute on function public.guard_bid_conditions() from public, anon, authenticated;

drop trigger if exists bids_conditions_gate on public.bids;
create trigger bids_conditions_gate before insert on public.bids
  for each row execute function public.guard_bid_conditions();

drop policy if exists bids_insert_conditions on public.bids;
create policy bids_insert_conditions on public.bids as restrictive for insert to authenticated
  with check (public.bid_meets_conditions(listing_id, auth.uid()));

-- 7. Uslovi se ne mijenjaju kad je izvođač već izabran (ponuda prihvaćena).
create or replace function public.lock_conditions_after_assign()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.conditions is distinct from old.conditions
     and exists (select 1 from public.bids b where b.listing_id = new.id and b.status = 'accepted') then
    raise exception 'USLOVI_ZAKLJUCANI: izvođač je već izabran' using errcode = '42501';
  end if;
  return new;
end $fn$;

revoke execute on function public.lock_conditions_after_assign() from public, anon, authenticated;

drop trigger if exists listings_conditions_lock on public.listings;
create trigger listings_conditions_lock before update of conditions on public.listings
  for each row execute function public.lock_conditions_after_assign();
