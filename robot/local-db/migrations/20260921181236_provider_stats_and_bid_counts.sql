-- Denormalised offer count on listings (kept by trigger) so ranking never counts bids per row.
alter table public.listings add column if not exists bid_count integer not null default 0;
update public.listings l set bid_count = coalesce((select count(*) from public.bids b where b.listing_id = l.id and b.status in ('pending', 'accepted')), 0);

create or replace function public.sync_listing_bid_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  v_ids := array_remove(array[coalesce(new.listing_id, null), coalesce(old.listing_id, null)], null);
  update public.listings l
     set bid_count = (select count(*) from public.bids b where b.listing_id = l.id and b.status in ('pending', 'accepted'))
   where l.id = any (v_ids);
  return null;
end $$;
drop trigger if exists sync_listing_bid_count on public.bids;
create trigger sync_listing_bid_count after insert or update of status or delete on public.bids
for each row execute function public.sync_listing_bid_count();

-- ============================================================================
-- provider_stats: everything the ranking needs about a provider, precomputed
-- (rating with a Bayesian prior, acceptance / success history, response speed
-- from bids and message replies, home coordinates). Refreshed every 10 minutes.
-- ============================================================================
drop materialized view if exists public.provider_stats;
create materialized view public.provider_stats as
with base as (select * from public.provider_metrics()),
bid_speed as (
  select b.bidder_id,
         percentile_cont(0.5) within group (order by extract(epoch from b.created_at - l.created_at) / 3600.0) as median_bid_hours,
         count(*) as bids_180d
  from public.bids b join public.listings l on l.id = b.listing_id
  where b.created_at > now() - interval '180 days'
  group by b.bidder_id
),
reply_speed as (
  select m.receiver_id as user_id,
         percentile_cont(0.5) within group (order by extract(epoch from r.created_at - m.created_at) / 60.0) as median_reply_min,
         count(*) as replies_180d
  from public.messages m
  join lateral (
    select r.created_at from public.messages r
    where r.conversation_id = m.conversation_id and r.sender_id = m.receiver_id and r.created_at > m.created_at
    order by r.created_at limit 1
  ) r on true
  where m.created_at > now() - interval '180 days'
  group by m.receiver_id
),
coords as (
  select p.user_id, c.lat, c.lng
  from public.profiles p left join lateral public.coords_for_location(p.city) c on true
)
select base.*,
       bs.median_bid_hours, bs.bids_180d, rs.median_reply_min, rs.replies_180d,
       -- 0..1: replies within minutes and offers within hours score high; unknown sits in the middle
       round((
         0.5 * (case when rs.median_reply_min is null then 0.5 else greatest(0, 1 - rs.median_reply_min / 240.0) end)
       + 0.5 * (case when bs.median_bid_hours is null then 0.5 else greatest(0, 1 - bs.median_bid_hours / 24.0) end)
       )::numeric, 3) as response_score,
       coords.lat, coords.lng,
       now() as refreshed_at
from base
left join bid_speed bs on bs.bidder_id = base.user_id
left join reply_speed rs on rs.user_id = base.user_id
left join coords on coords.user_id = base.user_id;
create unique index provider_stats_user_idx on public.provider_stats (user_id);
create index provider_stats_type_idx on public.provider_stats (account_type);
revoke all on public.provider_stats from anon, authenticated;

create or replace function public.refresh_provider_stats()
returns void language sql security definer set search_path = public as $$
  refresh materialized view concurrently public.provider_stats;
$$;
revoke all on function public.refresh_provider_stats() from public, anon, authenticated;

select cron.schedule('refresh-provider-stats', '*/10 * * * *', $$select public.refresh_provider_stats()$$);;
