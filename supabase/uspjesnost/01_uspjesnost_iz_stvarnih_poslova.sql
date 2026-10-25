-- Uspješnost izvođača iz stvarnih poslova (uplate na Zadatku), ne iz statusa oglasa.
-- Oglas se poslije posla arhivira, pa je stari broj (listings.status = 'completed') ostajao 0.
--
-- Uspješan:   posao završen i isplaćen (i kad tim nakon spora isplati cijeli iznos).
-- Neuspješan: izvođač odgovoran za prekid, ili spor završen povratom ili podjelom novca.
-- Ne broji se: posao u toku, prekid za koji je odgovoran klijent, povrat od tima bez spora.
-- Stari poslovi bez uplate na Zadatku broje se kao i do sada, po statusu oglasa.

create or replace function public.provider_job_outcomes()
returns table (provider_id uuid, completed_jobs bigint, failed_jobs bigint)
language sql stable security definer set search_path to 'public' as $$
  with paid as (
    select jp.provider_id,
      (jp.status = 'released' and (jp.disputed_at is null or jp.fee_amount + jp.net_amount >= jp.amount)) as ok,
      (
        (jp.status = 'released' and jp.disputed_at is not null and jp.fee_amount + jp.net_amount < jp.amount)
        or (jp.status = 'refunded' and (
          jp.disputed_at is not null
          or l.cancel_reason = 'provider'
          or exists (
            select 1 from public.cancellation_requests c
             where c.payment_id = jp.id and c.state = 'accepted'
               and coalesce(c.responsible, case when c.requested_by = jp.client_id then 'client' else 'provider' end) = 'provider'
          )
        ))
      ) as bad
    from public.job_payments jp
    left join public.listings l on l.id = jp.listing_id
  ),
  legacy as (
    select b.bidder_id as provider_id,
      (l.status = 'completed') as ok,
      (l.status = 'cancelled' and l.cancel_reason = 'provider') as bad
    from public.bids b
    join public.listings l on l.id = b.listing_id
    where b.status = 'accepted'
      and not exists (select 1 from public.job_payments jp where jp.listing_id = l.id)
  )
  select provider_id, count(*) filter (where ok), count(*) filter (where bad)
  from (select * from paid union all select * from legacy) o
  group by provider_id;
$$;
revoke execute on function public.provider_job_outcomes() from public, anon, authenticated;

create or replace function public.provider_metrics()
 returns table(user_id uuid, display_name text, city text, avatar_url text, account_type text, avg_rating numeric, review_count bigint, weighted_rating numeric, total_bids bigint, accepted_bids bigint, acceptance_rate numeric, completed_jobs bigint, failed_jobs bigint, success_rate numeric, portfolio_count bigint, badge_count bigint, is_verified boolean, days_since_activity numeric, days_since_joined numeric)
 language sql stable security definer set search_path to 'public'
as $function$
  with prior as (
    select coalesce(avg(rating), 4.5) as mean_rating, 5::numeric as weight
    from public.reviews
  ),
  rev as (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews
    group by reviewee_id
  ),
  bid as (
    select b.bidder_id,
           count(*) as total_bids,
           count(*) filter (where b.status = 'accepted') as accepted_bids,
           max(b.created_at) as last_bid_at
    from public.bids b
    group by b.bidder_id
  ),
  outcome as (
    select * from public.provider_job_outcomes()
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
    public.display_name_of(p.full_name) as display_name,
    p.city,
    p.avatar_url,
    p.account_type,
    round(coalesce(rev.avg_rating, 0), 2) as avg_rating,
    coalesce(rev.review_count, 0) as review_count,
    round(
      ((coalesce(rev.avg_rating, 0) * coalesce(rev.review_count, 0)) + (prior.mean_rating * prior.weight))
      / (coalesce(rev.review_count, 0) + prior.weight)
    , 3) as weighted_rating,
    coalesce(bid.total_bids, 0) as total_bids,
    coalesce(bid.accepted_bids, 0) as accepted_bids,
    case when coalesce(bid.total_bids, 0) = 0 then null
         else round(bid.accepted_bids::numeric / bid.total_bids, 3) end as acceptance_rate,
    coalesce(outcome.completed_jobs, 0) as completed_jobs,
    coalesce(outcome.failed_jobs, 0) as failed_jobs,
    case when coalesce(outcome.completed_jobs, 0) + coalesce(outcome.failed_jobs, 0) = 0 then null
         else round(outcome.completed_jobs::numeric / (outcome.completed_jobs + outcome.failed_jobs) * 100) end as success_rate,
    coalesce(port.portfolio_count, 0) as portfolio_count,
    coalesce(badge.badge_count, 0) as badge_count,
    coalesce(badge.is_verified, false) as is_verified,
    round(extract(epoch from now() - coalesce(bid.last_bid_at, p.created_at)) / 86400.0, 2) as days_since_activity,
    round(extract(epoch from now() - p.created_at) / 86400.0, 2) as days_since_joined
  from public.profiles p
  cross join prior
  left join rev on rev.reviewee_id = p.user_id
  left join bid on bid.bidder_id = p.user_id
  left join outcome on outcome.provider_id = p.user_id
  left join port on port.user_id = p.user_id
  left join badge on badge.user_id = p.user_id
  where p.account_status = 'active';
$function$;
