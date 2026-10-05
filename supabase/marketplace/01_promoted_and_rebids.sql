-- =============================================================================
-- Zadatak · marketplace/01 — izdvojeni oglasi (Hitno / VIP) i nova cijena nakon
-- odbijene ponude.
--
-- 1. Izdvojeni oglas: klijent plaća sa Zadatak Pay balansa (kartice dolaze kasnije).
--      Hitno  5 KM, 3 dana  — žuto istaknut u listi, uvijek iznad običnih oglasa
--      VIP   15 KM, 7 dana  — prvi u listi, veći zlatni pin koji pulsira na mapi
--    Cijene i trajanje su u tabeli promotion_plans (admin ih mijenja bez novog koda).
--    listings.promotion_tier / promoted_until mijenja SAMO promote_listing(): direktan
--    API poziv ih ne može postaviti, pa se izdvajanje ne može dobiti bez plaćanja.
--    is_promoted je izračunato polje (PostgREST: select=*,is_promoted): istekla
--    promocija se sama gasi, bez cron-a.
--    promoted_listings() vraća aktivne izdvojene oglase sa ISTIM filterima kao
--    pretraga (tekst, kategorija, grad + radijus, online), pa ih stranica pretrage
--    stavlja na vrh. search_listings ostaje netaknut (nema sukoba s performance/01).
--
-- 2. Nova cijena nakon odbijene ponude: tabela bids nikad nije imala unique pravilo,
--    ali sučelje je izvođača nakon "Odbij" zaključavalo zauvijek. Sada sme poslati
--    novu cijenu, uz pravila protiv spama:
--      - najviše jedna ponuda na čekanju po poslu (staru mijenja "Izmijeni ponudu"),
--      - nova cijena mora biti drugačija od odbijene,
--      - najviše 3 nove cijene nakon odbijanja (4 ukupno) i 8 ponuda ukupno po poslu.
--    Obavijest o odbijanju dok je posao još otvoren sada kaže "pošalji novu cijenu"
--    i vodi na posao (ranije: "Klijent je izabrao drugog izvođača" i link na pretragu).
--    Kad klijent prihvati nekog drugog, poruka ostaje stara.
--
-- Slijepe ponude iz booking/04 ostaju: izvođač i dalje vidi samo svoje ponude.
-- Idempotentno: može se pustiti više puta, prije ili poslije ostalih fajlova.
-- =============================================================================

-- ------------------------------------------------------------ 1a. Planovi
create table if not exists public.promotion_plans (
  tier     text primary key check (tier in ('hitno', 'vip')),
  label    text not null,
  price_km numeric(8, 2) not null check (price_km > 0),
  days     integer not null check (days between 1 and 60),
  rank     smallint not null
);
insert into public.promotion_plans (tier, label, price_km, days, rank) values
  ('hitno', 'Hitno', 5, 3, 1),
  ('vip', 'VIP', 15, 7, 2)
on conflict (tier) do nothing;

alter table public.promotion_plans enable row level security;
drop policy if exists promotion_plans_read on public.promotion_plans;
create policy promotion_plans_read on public.promotion_plans for select using (true);
drop policy if exists promotion_plans_admin on public.promotion_plans;
create policy promotion_plans_admin on public.promotion_plans for all using (public.is_admin()) with check (public.is_admin());
grant select on public.promotion_plans to anon, authenticated;

-- ------------------------------------------------------- 1b. Kolone na poslu
alter table public.listings add column if not exists promotion_tier text not null default 'standard';
alter table public.listings add column if not exists promoted_until timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_promotion_tier_check') then
    alter table public.listings add constraint listings_promotion_tier_check check (promotion_tier in ('standard', 'hitno', 'vip'));
  end if;
end $$;
create index if not exists listings_promoted_idx on public.listings (promoted_until) where promotion_tier <> 'standard';

create or replace function public.is_promoted(l public.listings)
returns boolean language sql stable set search_path = public
as $$ select l.promotion_tier <> 'standard' and l.promoted_until is not null and l.promoted_until > now() $$;
grant execute on function public.is_promoted(public.listings) to anon, authenticated;

-- izdvajanje se kupuje samo kroz promote_listing(); klijent ga ne može sam upisati
create or replace function public.guard_listing_promotion()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.promotion_tier := 'standard';
    new.promoted_until := null;
  else
    new.promotion_tier := old.promotion_tier;
    new.promoted_until := old.promoted_until;
  end if;
  return new;
end $$;
drop trigger if exists listings_promotion_guard on public.listings;
create trigger listings_promotion_guard before insert or update of promotion_tier, promoted_until on public.listings
  for each row execute function public.guard_listing_promotion();

-- ------------------------------------------------- 1c. Zapis svake kupovine
create table if not exists public.listing_promotions (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tier       text not null,
  price_km   numeric(8, 2) not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null
);
create index if not exists listing_promotions_listing_idx on public.listing_promotions (listing_id);
create index if not exists listing_promotions_user_idx on public.listing_promotions (user_id, starts_at desc);
alter table public.listing_promotions enable row level security;
drop policy if exists listing_promotions_read on public.listing_promotions;
create policy listing_promotions_read on public.listing_promotions for select using (user_id = auth.uid() or public.is_staff());
grant select on public.listing_promotions to authenticated;

-- ------------------------------------------------------ 1d. Kupovina
create or replace function public.promote_listing(p_listing_id uuid, p_tier text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.promotion_plans;
  v_listing public.listings;
  v_current_rank smallint;
  v_balance numeric;
  v_until timestamptz;
begin
  if v_uid is null then raise exception 'PRIJAVA_POTREBNA' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;

  select * into v_plan from public.promotion_plans where tier = p_tier;
  if v_plan.tier is null then raise exception 'IZDVAJANJE_NEPOZNATO: nepoznat paket' using errcode = 'P0001'; end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if v_listing.id is null or v_listing.user_id <> v_uid then
    raise exception 'IZDVAJANJE_NIJE_TVOJ: izdvojiti možeš samo svoj posao' using errcode = '42501';
  end if;
  if v_listing.status <> 'published' or (v_listing.due_date is not null and v_listing.due_date < public.today_ba()) then
    raise exception 'IZDVAJANJE_ZATVOREN: posao više ne prima ponude' using errcode = 'P0001';
  end if;
  if v_listing.invited_provider is not null then
    raise exception 'IZDVAJANJE_PRIVATNI: privatni zahtjev vidi samo jedan izvođač' using errcode = 'P0001';
  end if;
  if v_listing.promoted_until is not null and v_listing.promoted_until > now() then
    select rank into v_current_rank from public.promotion_plans where tier = v_listing.promotion_tier;
    if coalesce(v_current_rank, 0) >= v_plan.rank then
      raise exception 'IZDVAJANJE_VEC_AKTIVNO: posao je već izdvojen' using errcode = 'P0001';
    end if;
  end if;

  -- skida tačno cijenu paketa; INSUFFICIENT ako nema dovoljno (cijela kupovina se poništava)
  v_balance := public.wallet_move(v_uid, -v_plan.price_km, 'purchase',
    'Izdvojeni oglas (' || v_plan.label || ', ' || v_plan.days || ' dana) · ' || left(v_listing.title, 80), v_uid);
  v_until := now() + make_interval(days => v_plan.days);

  update public.listings set promotion_tier = v_plan.tier, promoted_until = v_until where id = v_listing.id;
  insert into public.listing_promotions (listing_id, user_id, tier, price_km, ends_at)
  values (v_listing.id, v_uid, v_plan.tier, v_plan.price_km, v_until);

  return jsonb_build_object('tier', v_plan.tier, 'promoted_until', v_until, 'balance', v_balance);
end $$;
revoke all on function public.promote_listing(uuid, text) from public, anon;
grant execute on function public.promote_listing(uuid, text) to authenticated;

-- paketi + moj balans u jednom pozivu (forma za objavu; ujedno provjera da je ovaj fajl na bazi)
create or replace function public.promotion_options()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object('tier', tier, 'label', label, 'price_km', price_km, 'days', days) order by rank)
                         from public.promotion_plans), '[]'::jsonb),
    'balance', (select balance from public.profiles where user_id = auth.uid())
  );
$$;
grant execute on function public.promotion_options() to anon, authenticated;

-- ------------------------------------------- 1e. Izdvojeni u radijusu pretrage
-- Isti filteri kao search_listings_core (tekst, kategorija, grad + radijus, online, budžet),
-- samo nad malim skupom aktivnih izdvojenih oglasa. VIP prije Hitno, pa bliži, pa noviji.
create or replace function public.promoted_listings(
  p_query text default '', p_category text default '', p_lat double precision default null, p_lng double precision default null,
  p_radius_km double precision default null, p_include_remote boolean default true,
  p_min_price numeric default null, p_max_price numeric default null, p_has_budget boolean default false, p_no_offers boolean default false,
  p_limit integer default 6)
returns table(id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text, status text,
  created_at timestamptz, lat double precision, lng double precision, is_remote boolean, cover_url text, image_count integer, offers integer,
  distance_km double precision, date_type text, due_date date, time_of_day text[], travel_allowance numeric,
  promotion_tier text, promoted_until timestamptz)
language sql stable security definer set search_path = public
as $$
  with pa as (
    select public.search_tsquery(p_query) as q,
           public.fold_text(coalesce(p_query, '')) as folded,
           nullif(btrim(coalesce(p_category, '')), '') as cat,
           (p_lat is not null and p_lng is not null) as has_origin,
           coalesce(p_radius_km, 0) as radius,
           public.today_ba() as today
  ),
  base as (
    select l.*,
           (public.fold_text(coalesce(l.location, '')) like '%online%' or public.fold_text(coalesce(l.location, '')) like '%daljin%') as remote
    from public.listings l cross join pa
    where l.promotion_tier <> 'standard' and l.promoted_until > now()
      and l.status = 'published' and l.invited_provider is null
      and (l.due_date is null or l.due_date >= pa.today)
      and (pa.q is null or l.search_tsv @@ pa.q or pa.folded operator(extensions.<%) public.fold_text(l.title))
      and (pa.cat is null or l.category = pa.cat)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (not coalesce(p_has_budget, false) or l.price is not null)
      and (not coalesce(p_no_offers, false) or l.bid_count = 0)
  ),
  measured as (
    select b.*, case when pa.has_origin and not b.remote then public.distance_km(p_lat, p_lng, b.lat, b.lng) end as dist
    from base b cross join pa
  )
  select m.id, m.user_id, m.title, m.description, m.category, m.location, m.price, m.currency, m.status, m.created_at,
         m.lat, m.lng, m.remote,
         (select li.url from public.listing_images li where li.listing_id = m.id order by li.position limit 1),
         (select count(*)::int from public.listing_images li where li.listing_id = m.id),
         m.bid_count, m.dist, m.date_type, m.due_date, m.time_of_day, m.travel_allowance,
         m.promotion_tier, m.promoted_until
  from measured m cross join pa
  where not pa.has_origin or pa.radius = 0
     or (m.remote and coalesce(p_include_remote, true))
     or (not m.remote and m.dist is not null and m.dist <= pa.radius)
  order by (select pp.rank from public.promotion_plans pp where pp.tier = m.promotion_tier) desc nulls last,
           coalesce(m.dist, 0) asc, m.created_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;
grant execute on function public.promoted_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, integer) to anon, authenticated;

-- ------------------------------------- 2a. Nova cijena nakon odbijene ponude
create or replace function public.guard_bid_rebid()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_pending int; v_accepted int; v_rejected int; v_total int;
  v_last_rejected numeric;
begin
  -- dvije ponude istog izvođača na isti posao u istom trenutku: jedna čeka drugu
  perform pg_advisory_xact_lock(hashtextextended(new.listing_id::text || ':' || new.bidder_id::text, 0));

  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'accepted'),
         count(*) filter (where status = 'rejected'),
         count(*)
    into v_pending, v_accepted, v_rejected, v_total
    from public.bids where listing_id = new.listing_id and bidder_id = new.bidder_id;

  if v_accepted > 0 then
    raise exception 'POSAO_VEC_TVOJ: tvoja ponuda je već prihvaćena' using errcode = 'P0001';
  end if;
  if v_pending > 0 then
    raise exception 'PONUDA_VEC_CEKA: već imaš ponudu na čekanju; izmijeni nju' using errcode = 'P0001';
  end if;
  if v_rejected >= 3 or v_total >= 8 then
    raise exception 'PREVISE_PONUDA: na ovaj posao si poslao/la previše ponuda' using errcode = 'P0001';
  end if;

  select amount into v_last_rejected from public.bids
   where listing_id = new.listing_id and bidder_id = new.bidder_id and status = 'rejected'
   order by created_at desc limit 1;
  if v_last_rejected is not null and new.amount = v_last_rejected then
    raise exception 'ISTA_CIJENA: klijent je već odbio % KM; pošalji drugačiju cijenu', rtrim(rtrim(v_last_rejected::text, '0'), '.') using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bids_rebid_guard on public.bids;
create trigger bids_rebid_guard before insert on public.bids
  for each row execute function public.guard_bid_rebid();

-- ------------------------------------------ 2b. Obavijest o odbijenoj ponudi
create or replace function public.on_bid_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_title text; v_status text; v_name text; v_amount text; v_taken boolean;
begin
  select user_id, title, status into v_owner, v_title, v_status from public.listings where id = new.listing_id;
  v_amount := case when new.amount is null then '?' else rtrim(rtrim(new.amount::text, '0'), '.') end;
  if TG_OP = 'INSERT' then
    if v_owner is null or v_owner = new.bidder_id then return new; end if;
    select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.bidder_id;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (v_owner, 'offer', 'Nova ponuda: ' || v_amount || ' KM', coalesce(v_name, 'Izvođač') || ' · ' || coalesce(v_title, ''), '/listings/' || new.listing_id::text, 'bid:' || new.id::text);
  elsif TG_OP = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.bidder_id, 'offer_accepted', 'Ponuda prihvaćena 🎉', coalesce(v_title, 'Posao') || ' — uplata je osigurana, možeš početi.', '/listings/' || new.listing_id::text, 'bidacc:' || new.id::text)
    on conflict do nothing;
  elsif TG_OP = 'UPDATE' and new.status = 'rejected' and old.status = 'pending' then
    v_taken := v_status is distinct from 'published'
      or exists (select 1 from public.bids b where b.listing_id = new.listing_id and b.status = 'accepted');
    if v_taken then
      insert into public.notifications (user_id, type, title, message, link, dedupe_key)
      values (new.bidder_id, 'offer_rejected', 'Klijent je izabrao drugog izvođača', coalesce(v_title, 'Posao') || ' — hvala na ponudi. Novi poslovi stižu svaki dan.', '/search', 'bidrej:' || new.id::text)
      on conflict do nothing;
    else
      insert into public.notifications (user_id, type, title, message, link, dedupe_key)
      values (new.bidder_id, 'offer_rejected', 'Klijent je odbio ponudu od ' || v_amount || ' KM', coalesce(v_title, 'Posao') || ' — posao je još otvoren. Pošalji novu cijenu.', '/listings/' || new.listing_id::text, 'bidrej:' || new.id::text)
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

-- trigger funkcije se ne zovu direktno (isto kao security/09)
revoke execute on function public.guard_listing_promotion() from public, anon, authenticated;
revoke execute on function public.guard_bid_rebid() from public, anon, authenticated;
revoke execute on function public.on_bid_notify() from public, anon, authenticated;
