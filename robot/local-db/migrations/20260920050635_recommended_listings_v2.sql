create or replace function public.recommended_listings(limit_count integer default 8)
returns table(id uuid, title text, category text, location text, price numeric, currency text, created_at timestamptz, bid_count bigint, match_score numeric, reasons text[])
language sql stable security definer set search_path to 'public' as $$
  with me as (
    select p.user_id, p.city, coalesce(p.trades, '{}'::text[]) as trades
    from public.profiles p
    where p.user_id = auth.uid()
  ),
  my_categories as (
    select l.category, count(*) as bids_in_category
    from public.bids b
    join public.listings l on l.id = b.listing_id
    where b.bidder_id = auth.uid()
    group by l.category
  ),
  candidates as (
    select
      l.id, l.title, l.category, l.location, l.price, l.currency, l.created_at,
      (select count(*) from public.bids b where b.listing_id = l.id) as bid_count,
      round(extract(epoch from now() - l.created_at) / 86400.0, 2) as days_old,
      (select count(*) from public.listing_images li where li.listing_id = l.id) as photos
    from public.listings l
    cross join me
    where l.status = 'published'
      and l.user_id <> me.user_id
      and not exists (select 1 from public.bids b where b.listing_id = l.id and b.bidder_id = me.user_id)
  ),
  scored as (
    select
      c.*,
      coalesce(mc.bids_in_category, 0) as bids_in_category,
      public.cities_match(me.city, c.location) as city_match,
      exists (select 1 from unnest(me.trades) t where lower(t) = lower(c.category) or lower(c.category) like '%' || lower(t) || '%' or lower(t) like '%' || lower(c.category) || '%') as trade_match
    from candidates c
    cross join me
    left join my_categories mc on mc.category = c.category
  ),
  raw as (
    select s.*,
      (case when s.trade_match then 25 else 0 end)
      + least(s.bids_in_category, 4) * 8
      + (case when s.city_match then 22 else 0 end)
      + greatest(0, 18 - s.days_old * 2)
      + greatest(0, 15 - s.bid_count * 5)
      + (case when s.price is not null then 5 else 0 end)
      + (case when s.photos > 0 then 3 else 0 end) as points   -- max 120
    from scored s
  )
  select
    r.id, r.title, r.category, r.location, r.price, r.currency, r.created_at, r.bid_count,
    round(least(100, r.points / 1.2), 0) as match_score,
    array_remove(array[
      case when r.trade_match then 'Odgovara tvojim vještinama' end,
      case when r.bids_in_category > 0 then 'Slično poslovima na koje si nudio/la' end,
      case when r.city_match then 'U tvom gradu' end,
      case when r.days_old <= 2 then 'Objavljeno nedavno' end,
      case when r.bid_count = 0 then 'Još nema ponuda — budi prvi' end,
      case when r.bid_count between 1 and 2 then 'Malo konkurencije' end,
      case when r.price is not null then 'Budžet je naveden' end,
      case when r.photos > 0 then 'Ima slike' end
    ], null) as reasons
  from raw r
  order by match_score desc, r.created_at desc
  limit greatest(1, least(limit_count, 30));
$$;;
