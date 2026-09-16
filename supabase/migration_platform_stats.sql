-- Public aggregate counters for the homepage hero. Returns only totals,
-- never rows, so it is safe to expose to anonymous visitors.
create or replace function public.platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users',              (select count(*) from public.profiles),
    'providers',          (select count(*) from public.profiles where account_type in ('provider', 'both')),
    'verified_providers', (select count(*) from public.profiles where verified_trade is not null),
    'open_listings',      (select count(*) from public.listings where status = 'published'),
    'total_listings',     (select count(*) from public.listings where status <> 'draft'),
    'accepted_bids',      (select count(*) from public.bids where status = 'accepted'),
    'reviews',            (select count(*) from public.reviews),
    'avg_rating',         (select round(avg(rating)::numeric, 1) from public.reviews),
    'cities',             (select count(distinct public.city_key(location)) from public.listings where location is not null and status = 'published')
  );
$$;

revoke execute on function public.platform_stats() from public, anon, authenticated;
grant execute on function public.platform_stats() to anon, authenticated;
