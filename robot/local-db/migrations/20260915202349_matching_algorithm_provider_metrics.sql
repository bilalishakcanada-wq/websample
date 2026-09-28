-- Per-provider signals used by every ranking surface.
-- Ratings use Bayesian shrinkage towards the platform mean so a single
-- 5-star review cannot outrank an established provider, and a provider
-- with no reviews yet starts at a neutral prior instead of zero.
create or replace function public.provider_metrics()
returns table (
  user_id uuid,
  full_name text,
  city text,
  avatar_url text,
  display_uid text,
  avg_rating numeric,
  review_count bigint,
  weighted_rating numeric,
  total_bids bigint,
  accepted_bids bigint,
  acceptance_rate numeric,
  portfolio_count bigint,
  badge_count bigint,
  is_verified boolean,
  days_since_activity numeric,
  days_since_joined numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with prior as (
    -- platform mean, with a sane default while there are no reviews at all
    select coalesce(avg(rating), 4.5) as mean_rating, 5::numeric as weight
    from public.reviews
  ),
  rev as (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews
    group by reviewee_id
  ),
  bid as (
    select bidder_id,
           count(*) as total_bids,
           count(*) filter (where status = 'accepted') as accepted_bids,
           max(created_at) as last_bid_at
    from public.bids
    group by bidder_id
  ),
  port as (
    select user_id, count(*) as portfolio_count
    from public.portfolio_items
    group by user_id
  ),
  badge as (
    select ub.user_id,
           count(*) as badge_count,
           bool_or(b.code = 'verified') as is_verified
    from public.user_badges ub
    join public.badges b on b.id = ub.badge_id
    group by ub.user_id
  )
  select
    p.user_id,
    p.full_name,
    p.city,
    p.avatar_url,
    p.display_uid,
    round(coalesce(rev.avg_rating, 0), 2) as avg_rating,
    coalesce(rev.review_count, 0) as review_count,
    round(
      ((coalesce(rev.avg_rating, 0) * coalesce(rev.review_count, 0)) + (prior.mean_rating * prior.weight))
      / (coalesce(rev.review_count, 0) + prior.weight)
    , 3) as weighted_rating,
    coalesce(bid.total_bids, 0) as total_bids,
    coalesce(bid.accepted_bids, 0) as accepted_bids,
    case
      when coalesce(bid.total_bids, 0) = 0 then null
      else round(bid.accepted_bids::numeric / bid.total_bids, 3)
    end as acceptance_rate,
    coalesce(port.portfolio_count, 0) as portfolio_count,
    coalesce(badge.badge_count, 0) as badge_count,
    coalesce(badge.is_verified, false) as is_verified,
    round(extract(epoch from now() - coalesce(bid.last_bid_at, p.created_at)) / 86400.0, 2) as days_since_activity,
    round(extract(epoch from now() - p.created_at) / 86400.0, 2) as days_since_joined
  from public.profiles p
  cross join prior
  left join rev on rev.reviewee_id = p.user_id
  left join bid on bid.bidder_id = p.user_id
  left join port on port.user_id = p.user_id
  left join badge on badge.user_id = p.user_id
  where p.account_status = 'active';
$$;

revoke execute on function public.provider_metrics() from public;
grant execute on function public.provider_metrics() to authenticated;;
