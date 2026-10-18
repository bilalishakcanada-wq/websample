-- ============================================================================
-- Doseg ponuda 2: lokacija uređaja, razredi u tabeli i molba za plaćen prevoz
-- ----------------------------------------------------------------------------
-- 1. Razredi dosega su u tabeli public.reach_tiers (mijenjaju se bez novog koda):
--      plaća (budžet + novac za put)  <  50 KM  ->  10 km
--                                     < 150 KM  ->  25 km
--                                     < 300 KM  ->  50 km
--                                    >= 300 KM  ->  cijela BiH
--      "Po dogovoru" (bez cijene)                ->  25 km (reach_config.no_budget_km)
--    Ista tabela je u src/utils/reach.js (REACH_TIERS), za prikaz na ekranu.
-- 2. Lokacija uređaja (device_locations): kad korisnik dozvoli lokaciju, aplikacija pošalje tačku
--    telefona/preglednika. Doseg se mjeri od nje (zaokružene na ~1 km) dok nije starija od
--    reach_config.device_fresh_days, pa od adrese iz profila (profile_locations), pa od grada.
-- 3. Molba za prevoz (travel_requests): izvođač koji je predaleko ne može poslati ponudu ni pitanje.
--    Jedino što može je molba klijentu da plati prevoz (gorivo, taksi, prevoz) sa iznosom.
--    Klijent prihvati ili odbije; kad prihvati, taj izvođač smije poslati ponudu bez obzira na
--    udaljenost, a dogovoreni iznos za prevoz piše uz njegovu molbu.
-- Treba airtasker/04, algorithms/01 i communication/04. Smije se pokrenuti više puta.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- 1. razredi dosega
create table if not exists public.reach_tiers (
  pay_below numeric primary key check (pay_below > 0),
  km numeric not null check (km > 0)
);
create table if not exists public.reach_config (
  id boolean primary key default true check (id),
  no_budget_km numeric not null default 25,
  device_fresh_days integer not null default 30,
  max_travel_request numeric not null default 300
);
alter table public.reach_tiers enable row level security;
alter table public.reach_config enable row level security;
revoke all on public.reach_tiers, public.reach_config from anon, authenticated;
grant select on public.reach_tiers, public.reach_config to anon, authenticated;
drop policy if exists reach_tiers_read on public.reach_tiers;
create policy reach_tiers_read on public.reach_tiers for select using (true);
drop policy if exists reach_config_read on public.reach_config;
create policy reach_config_read on public.reach_config for select using (true);

-- the defaults go in only once: a tier someone changed on the live database stays as it is
insert into public.reach_config (id) values (true) on conflict (id) do nothing;
insert into public.reach_tiers (pay_below, km)
select * from (values (50::numeric, 10::numeric), (150, 25), (300, 50)) v
where not exists (select 1 from public.reach_tiers);

-- km a provider may be from the job, or null for no limit (pays at least the top tier).
-- "Po dogovoru" never drops below no_budget_km: travel money only widens it.
create or replace function public.listing_reach_km(p_price numeric, p_travel numeric)
returns numeric language sql stable set search_path = public
as $$
  select case
    when t.km is null then null
    else greatest(t.km, case when p_price is null then (select no_budget_km from public.reach_config) else 0 end)
  end::numeric
  from (
    select (select rt.km from public.reach_tiers rt
             where coalesce(p_price, 0) + coalesce(p_travel, 0) < rt.pay_below
             order by rt.pay_below limit 1) as km
  ) t
$$;

-- ---------------------------------------------------------------- 2. lokacija uređaja
create table if not exists public.device_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  updated_at timestamptz not null default now(),
  check (public.inside_bih(lat, lng))
);
alter table public.device_locations enable row level security;
revoke all on public.device_locations from anon, authenticated;
grant select on public.device_locations to authenticated;
drop policy if exists device_locations_own on public.device_locations;
create policy device_locations_own on public.device_locations for select to authenticated using (user_id = auth.uid());

-- The app sends the device's position after the person allowed location. A point outside BiH
-- (abroad, or a laptop placed by its internet provider) is ignored: false, nothing saved.
create or replace function public.report_device_location(p_lat double precision, p_lng double precision, p_accuracy_m real default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Prijavi se' using errcode = '42501'; end if;
  if p_lat is null or p_lng is null or not public.inside_bih(p_lat, p_lng) then return false; end if;
  insert into public.device_locations (user_id, lat, lng, accuracy_m, updated_at)
  values (auth.uid(), p_lat, p_lng, p_accuracy_m, now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
  return true;
end $$;
revoke all on function public.report_device_location(double precision, double precision, real) from public, anon;
grant execute on function public.report_device_location(double precision, double precision, real) to authenticated;

-- Where a person is measured from for reach: fresh device location, else the profile address,
-- else the profile city. Rounded to ~1 km. source: device | address | city | null
create or replace function public.reach_point(p_user uuid)
returns table (lat double precision, lng double precision, source text, city text)
language sql stable security definer set search_path = public as $$
  select
    coalesce(public.blurred(dl.lat), public.blurred(pl.lat), c.lat),
    coalesce(public.blurred(dl.lng), public.blurred(pl.lng), c.lng),
    case when dl.user_id is not null then 'device' when pl.user_id is not null then 'address' when c.lat is not null then 'city' end,
    p.city
  from public.profiles p
  left join public.device_locations dl on dl.user_id = p.user_id
    and dl.updated_at > now() - make_interval(days => (select device_fresh_days from public.reach_config))
  left join public.profile_locations pl on pl.user_id = p.user_id
  left join lateral public.coords_for_location(p.city) c on true
  where p.user_id = p_user
$$;
revoke all on function public.reach_point(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. molba za prevoz
create table if not exists public.travel_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  provider_id uuid not null references public.profiles(user_id) on delete cascade,
  client_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null check (kind in ('gorivo', 'taksi', 'prevoz')),
  amount numeric not null check (amount > 0),
  note text check (note is null or char_length(note) <= 300),
  distance_km numeric,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (listing_id, provider_id)
);
create index if not exists travel_requests_client_idx on public.travel_requests(client_id, created_at desc);
create index if not exists travel_requests_provider_idx on public.travel_requests(provider_id, created_at desc);
alter table public.travel_requests enable row level security;
revoke all on public.travel_requests from anon, authenticated;
grant select on public.travel_requests to authenticated;
drop policy if exists travel_requests_parties on public.travel_requests;
create policy travel_requests_parties on public.travel_requests for select to authenticated
  using (provider_id = auth.uid() or client_id = auth.uid() or public.is_staff());

do $$ begin
  alter publication supabase_realtime add table public.travel_requests;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ---------------------------------------------------------------- 4. jedno pravilo za doseg
-- Where one person stands for one job. reason:
--   ok | travel_ok (client agreed to pay the trip) | remote | no_limit | no_job_location | no_city
--   | unknown_city | too_far | own_job | invited | not_invited
create or replace function public.reach_status(p_listing uuid, p_user uuid)
returns table (reach_km numeric, distance_km numeric, can_offer boolean, reason text, my_city text)
language plpgsql stable security definer set search_path = public as $$
declare
  l record;
  me record;
  d double precision;
  r numeric;
begin
  select id, user_id, location, lat, lng, price, travel_allowance, invited_provider into l from public.listings where id = p_listing;
  if l.id is null then return; end if;
  if l.invited_provider is not null then
    if p_user = l.invited_provider then
      return query select null::numeric, null::numeric, true, 'invited'::text, null::text;
    elsif p_user = l.user_id then
      return query select null::numeric, null::numeric, false, 'own_job'::text, null::text;
    else
      return query select null::numeric, null::numeric, false, 'not_invited'::text, null::text;
    end if;
    return;
  end if;
  if public.listing_is_remote(l.location) then
    return query select null::numeric, null::numeric, true, 'remote'::text, null::text; return;
  end if;
  r := public.listing_reach_km(l.price, l.travel_allowance);
  select * into me from public.reach_point(p_user);
  if l.user_id = p_user then
    return query select r, null::numeric, false, 'own_job'::text, me.city; return;
  end if;
  if l.lat is null or l.lng is null then
    return query select r, null::numeric, true, 'no_job_location'::text, me.city; return;
  end if;
  if me.lat is not null then d := public.distance_km(me.lat, me.lng, l.lat, l.lng); end if;
  if r is null then
    return query select r, round(d::numeric, 1), true, 'no_limit'::text, me.city; return;
  end if;
  if exists (select 1 from public.travel_requests t where t.listing_id = p_listing and t.provider_id = p_user and t.status = 'accepted') then
    return query select r, round(d::numeric, 1), true, 'travel_ok'::text, me.city; return;
  end if;
  if me.lat is null then
    -- a city we can't place on the map: distance unknown, so it doesn't block
    if coalesce(btrim(me.city), '') <> '' then
      return query select r, null::numeric, true, 'unknown_city'::text, me.city; return;
    end if;
    return query select r, null::numeric, false, 'no_city'::text, me.city; return;
  end if;
  return query select r, round(d::numeric, 1), d <= r, case when d <= r then 'ok' else 'too_far' end, me.city;
end $$;
revoke all on function public.reach_status(uuid, uuid) from public, anon, authenticated;

-- the signed-in person's view (same columns as before, so older app builds keep working)
create or replace function public.listing_reach(p_listing uuid)
returns table (reach_km numeric, distance_km numeric, can_offer boolean, reason text, my_city text)
language plpgsql stable security definer set search_path = public as $$
declare l record;
begin
  if auth.uid() is null then
    select id, location, price, travel_allowance, invited_provider into l from public.listings where id = p_listing;
    if l.id is null or l.invited_provider is not null then return; end if;
    if public.listing_is_remote(l.location) then
      return query select null::numeric, null::numeric, true, 'remote'::text, null::text; return;
    end if;
    return query select public.listing_reach_km(l.price, l.travel_allowance), null::numeric, true, 'signed_out'::text, null::text;
    return;
  end if;
  return query select s.reach_km, s.distance_km, s.can_offer, s.reason, s.my_city
    from public.reach_status(p_listing, auth.uid()) s where s.reason <> 'not_invited';
end $$;
revoke execute on function public.listing_reach(uuid) from public, anon;
grant execute on function public.listing_reach(uuid) to anon, authenticated;

-- offers: too far without an accepted travel request is refused
create or replace function public.guard_bid_reach()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.reach_status(new.listing_id, new.bidder_id);
  -- private quote requests: 05 makes sure only the invited provider offers
  if s.reason is null or s.reason in ('invited', 'not_invited', 'own_job') then return new; end if;
  if s.reason = 'no_city' then
    raise exception 'GRAD_POTREBAN: dozvoli lokaciju ili dodaj svoj grad u profil da vidimo koliko si daleko od posla'
      using errcode = 'P0001';
  end if;
  if s.reason = 'too_far' then
    raise exception 'PREDALEKO: udaljen/a si % km, a za ovaj posao ponude mogu slati izvođači do % km. Možeš zamoliti klijenta da plati prevoz.',
      round(s.distance_km), s.reach_km using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.guard_bid_reach() from public, anon, authenticated;
drop trigger if exists bids_reach_guard on public.bids;
create trigger bids_reach_guard before insert on public.bids
  for each row execute function public.guard_bid_reach();

-- questions under the job: a provider who is too far has only the travel request
create or replace function public.guard_question_reach()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if public.is_staff() then return new; end if;
  select * into s from public.reach_status(new.listing_id, new.user_id);
  if s.reason = 'too_far' then
    raise exception 'PREDALEKO: predaleko si od ovog posla za pitanja. Možeš zamoliti klijenta da plati prevoz.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.guard_question_reach() from public, anon, authenticated;
drop trigger if exists listing_questions_reach_guard on public.listing_questions;
create trigger listing_questions_reach_guard before insert on public.listing_questions
  for each row execute function public.guard_question_reach();

-- ---------------------------------------------------------------- 5. molba: šalje izvođač
create or replace function public.request_travel(p_listing uuid, p_kind text, p_amount numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  l record;
  s record;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
  v_max numeric := (select max_travel_request from public.reach_config);
  v_name text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Prijavi se' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'Račun je suspendovan' using errcode = '42501'; end if;
  select id, user_id, title, status into l from public.listings where id = p_listing;
  if l.id is null or l.status <> 'published' then
    raise exception 'MOLBA_NIJE_MOGUCA: posao više ne prima ponude' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(l.user_id, auth.uid()) then
    raise exception 'KORISNIK_BLOKIRAN: vlasnik posla i ovaj korisnik su blokirani' using errcode = '42501', hint = 'user_blocked';
  end if;
  select * into s from public.reach_status(p_listing, auth.uid());
  if s.reason is distinct from 'too_far' then
    raise exception 'MOLBA_NIJE_MOGUCA: molba za prevoz je samo za izvođače koji su predaleko od posla' using errcode = 'P0001';
  end if;
  if p_kind not in ('gorivo', 'taksi', 'prevoz') then
    raise exception 'MOLBA_NIJE_MOGUCA: izaberi gorivo, taksi ili prevoz' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > v_max then
    raise exception 'MOLBA_NIJE_MOGUCA: iznos za prevoz mora biti od 1 do % KM', v_max using errcode = '22023';
  end if;
  if v_note is not null and not (public.moderation_scan(v_note) ->> 'clean')::boolean then
    raise exception 'Pravilo #1: poruka ne smije sadržavati telefon, email ili link' using errcode = '22023';
  end if;
  if exists (select 1 from public.travel_requests where listing_id = p_listing and provider_id = auth.uid()) then
    raise exception 'MOLBA_NIJE_MOGUCA: već si poslao/la molbu za ovaj posao' using errcode = 'P0001';
  end if;
  if (select count(*) from public.travel_requests where provider_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'MOLBA_NIJE_MOGUCA: danas si poslao/la 10 molbi, pokušaj sutra' using errcode = 'P0001';
  end if;

  insert into public.travel_requests (listing_id, provider_id, client_id, kind, amount, note, distance_km)
  values (p_listing, auth.uid(), l.user_id, p_kind, round(p_amount, 2), v_note, round(s.distance_km))
  returning id into v_id;

  select coalesce(nullif(btrim(full_name), ''), 'Izvođač') into v_name from public.profiles where user_id = auth.uid();
  insert into public.notifications (user_id, type, title, message, link) values
    (l.user_id, 'job', 'Molba za plaćen prevoz',
     split_part(v_name, ' ', 1) || ' je ' || round(s.distance_km) || ' km daleko i želi doći ako platiš '
       || case p_kind when 'gorivo' then 'gorivo' when 'taksi' then 'taksi' else 'prevoz' end || ' (' || round(p_amount) || ' KM). Otvori posao i odluči.',
     '/listings/' || p_listing::text);
  return v_id;
end $$;
revoke all on function public.request_travel(uuid, text, numeric, text) from public, anon;
grant execute on function public.request_travel(uuid, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------- 6. molba: odgovara klijent
create or replace function public.answer_travel_request(p_request uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare t public.travel_requests;
begin
  if auth.uid() is null then raise exception 'Prijavi se' using errcode = '42501'; end if;
  select * into t from public.travel_requests where id = p_request for update;
  if t.id is null or t.client_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if t.status <> 'pending' then return t.status; end if;
  update public.travel_requests set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
   where id = t.id;
  insert into public.notifications (user_id, type, title, message, link) values
    (t.provider_id, 'job',
     case when p_accept then 'Klijent plaća prevoz' else 'Klijent ne plaća prevoz' end,
     case when p_accept
       then 'Klijent je pristao platiti prevoz (' || round(t.amount) || ' KM). Sada možeš poslati ponudu za posao.'
       else 'Klijent je odbio molbu za prevoz. Pogledaj poslove bliže tebi.' end,
     '/listings/' || t.listing_id::text);
  return case when p_accept then 'accepted' else 'declined' end;
end $$;
revoke all on function public.answer_travel_request(uuid, boolean) from public, anon;
grant execute on function public.answer_travel_request(uuid, boolean) to authenticated;

commit;

select 'Gotovo: doseg od lokacije uređaja i molba za prevoz su uključeni.' as rezultat;
