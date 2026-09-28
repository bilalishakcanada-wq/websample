-- Ranking algorithm for "recommended providers": rewards verified identity, strong ratings,
-- review volume, badge count and recent platform activity. Handles the cold-start case
-- (no reviews yet) gracefully by falling back to activity/recency signals.
create or replace function public.ranked_providers(category_filter text default null, limit_count int default 6)
returns table (
  user_id uuid,
  full_name text,
  city text,
  avatar_url text,
  display_uid text,
  avg_rating numeric,
  review_count bigint,
  badge_count bigint,
  is_verified boolean,
  active_listings bigint,
  score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with review_stats as (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews
    group by reviewee_id
  ),
  badge_stats as (
    select ub.user_id, count(*) as badge_count,
      bool_or(b.code = 'verified') as is_verified
    from public.user_badges ub
    join public.badges b on b.id = ub.badge_id
    group by ub.user_id
  ),
  listing_stats as (
    select l.user_id, count(*) as active_listings, max(l.created_at) as last_activity
    from public.listings l
    where l.status = 'published'
      and (category_filter is null or l.category = category_filter)
    group by l.user_id
  )
  select
    p.user_id,
    p.full_name,
    p.city,
    p.avatar_url,
    p.display_uid,
    coalesce(round(rs.avg_rating, 1), 0) as avg_rating,
    coalesce(rs.review_count, 0) as review_count,
    coalesce(bs.badge_count, 0) as badge_count,
    coalesce(bs.is_verified, false) as is_verified,
    coalesce(ls.active_listings, 0) as active_listings,
    (
      coalesce(rs.avg_rating, 0) * 15
      + least(coalesce(rs.review_count, 0), 20) * 2
      + (case when coalesce(bs.is_verified, false) then 25 else 0 end)
      + coalesce(bs.badge_count, 0) * 5
      + least(coalesce(ls.active_listings, 0), 10) * 3
      + (case when ls.last_activity > now() - interval '14 days' then 10 else 0 end)
    ) as score
  from public.profiles p
  join listing_stats ls on ls.user_id = p.user_id
  left join review_stats rs on rs.reviewee_id = p.user_id
  left join badge_stats bs on bs.user_id = p.user_id
  where p.account_status = 'active'
  order by score desc, ls.last_activity desc
  limit limit_count;
$$;

grant execute on function public.ranked_providers(text, int) to anon, authenticated;;
