-- ------------------------------------------------------------ last seen
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where user_id = auth.uid();
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

create or replace view public.public_profiles as
  select user_id, full_name, city, bio, avatar_url, created_at, display_uid,
         account_type, trades, verified_trade, last_seen_at
  from public.profiles
  where account_status = 'active';

-- ------------------------------------------------- per-user instant badges
-- Same rules as the nightly job, but for one user, so a badge can land the
-- moment the qualifying review or bid arrives instead of the next morning.
create or replace function public.refresh_user_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_count bigint;
  v_joined timestamptz;
  v_accepted bigint;
  v_resolved bigint;
  v_resp_count bigint;
  v_resp_avg numeric;
begin
  select avg(rating), count(*) into v_avg, v_count
  from public.reviews where reviewee_id = p_user_id;

  select created_at into v_joined from public.profiles where user_id = p_user_id;

  select count(*) filter (where status = 'accepted'),
         count(*) filter (where status in ('accepted','rejected','withdrawn'))
    into v_accepted, v_resolved
  from public.bids where bidder_id = p_user_id;

  select count(*), avg(response_minutes) into v_resp_count, v_resp_avg
  from (
    select extract(epoch from (m.created_at - lag(m.created_at) over (partition by m.conversation_id order by m.created_at))) / 60 as response_minutes,
           m.sender_id,
           lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender
    from public.messages m
    where m.conversation_id in (select conversation_id from public.messages where sender_id = p_user_id)
  ) pairs
  where sender_id = p_user_id and prev_sender is not null and prev_sender <> p_user_id;

  -- top_rated: 4.8+ across 10+ reviews
  if coalesce(v_count,0) >= 10 and coalesce(v_avg,0) >= 4.8 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where code = 'top_rated' on conflict do nothing;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = 'top_rated' and ub.user_id = p_user_id;
  end if;

  -- rising_talent: joined in the last 30 days, 1–9 reviews averaging 4.5+
  if v_joined > now() - interval '30 days' and coalesce(v_count,0) between 1 and 9 and coalesce(v_avg,0) >= 4.5 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where code = 'rising_talent' on conflict do nothing;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = 'rising_talent' and ub.user_id = p_user_id;
  end if;

  -- reliable: 3+ accepted and 80%+ of resolved bids accepted
  if coalesce(v_accepted,0) >= 3 and coalesce(v_resolved,0) > 0 and v_accepted::numeric / v_resolved >= 0.8 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where code = 'reliable' on conflict do nothing;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = 'reliable' and ub.user_id = p_user_id;
  end if;

  -- fast_responder: 3+ replies averaging under an hour
  if coalesce(v_resp_count,0) >= 3 and coalesce(v_resp_avg, 9999) <= 60 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where code = 'fast_responder' on conflict do nothing;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = 'fast_responder' and ub.user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.refresh_user_badges(uuid) from public, anon, authenticated;

-- Fire immediately on the events that can change a badge.
create or replace function public.on_review_changed_refresh_badges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_user_badges(coalesce(new.reviewee_id, old.reviewee_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.on_bid_status_changed_refresh_badges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.refresh_user_badges(new.bidder_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.on_review_changed_refresh_badges() from public, anon, authenticated;
revoke execute on function public.on_bid_status_changed_refresh_badges() from public, anon, authenticated;

drop trigger if exists review_changed_refresh_badges on public.reviews;
create trigger review_changed_refresh_badges
  after insert or update or delete on public.reviews
  for each row execute function public.on_review_changed_refresh_badges();

drop trigger if exists bid_status_changed_refresh_badges on public.bids;
create trigger bid_status_changed_refresh_badges
  after update on public.bids
  for each row execute function public.on_bid_status_changed_refresh_badges();

-- Nightly job becomes a safety net that walks every active provider.
create or replace function public.refresh_provider_badges()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare r record;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Nedozvoljen pristup.' using errcode = '42501';
  end if;
  for r in select user_id from public.profiles where account_status = 'active' loop
    perform public.refresh_user_badges(r.user_id);
  end loop;
end;
$$;

-- --------------------------------------------------------- trust summary
-- One explainable answer to "how much can I trust this person", derived from
-- verification, reviews (Bayesian-shrunk), bid reliability and activity.
create or replace function public.trust_summary(p_user_id uuid)
returns table (
  tier text,
  label text,
  score integer,
  verified_trade text,
  avg_rating numeric,
  review_count bigint,
  completed_jobs bigint,
  badges text[],
  reasons text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select * from public.provider_metrics() where user_id = p_user_id
  ),
  p as (
    select verified_trade, created_at, last_seen_at from public.profiles where user_id = p_user_id
  ),
  b as (
    select coalesce(array_agg(bg.code order by bg.code), '{}') as codes
    from public.user_badges ub join public.badges bg on bg.id = ub.badge_id
    where ub.user_id = p_user_id
  ),
  s as (
    select
      m.*, p.verified_trade, p.last_seen_at, b.codes,
      (
        (case when m.is_verified then 35 else 0 end)
        + least(round(greatest(0, (m.weighted_rating - 3)) * 12)::int, 24)
        + least(m.review_count::int, 15)
        + (case when m.acceptance_rate >= 0.7 and m.accepted_bids >= 3 then 10 else 0 end)
        + (case when m.portfolio_count > 0 then 6 else 0 end)
        + (case when 'top_rated' = any(b.codes) then 10 else 0 end)
      )::int as raw_score
    from m cross join p cross join b
  )
  select
    case
      when s.is_verified and s.review_count >= 10 and s.avg_rating >= 4.8 then 'top'
      when s.is_verified and s.review_count >= 3 and s.avg_rating >= 4.5 then 'trusted'
      when s.is_verified then 'verified'
      when s.days_since_joined <= 7 and s.review_count = 0 then 'new'
      else 'unverified'
    end as tier,
    case
      when s.is_verified and s.review_count >= 10 and s.avg_rating >= 4.8 then 'Top majstor'
      when s.is_verified and s.review_count >= 3 and s.avg_rating >= 4.5 then 'Pouzdan majstor'
      when s.is_verified then 'Verifikovan majstor'
      when s.days_since_joined <= 7 and s.review_count = 0 then 'Novi korisnik'
      else 'Nije verifikovan'
    end as label,
    least(100, s.raw_score) as score,
    s.verified_trade,
    s.avg_rating,
    s.review_count,
    s.accepted_bids as completed_jobs,
    s.codes as badges,
    array_remove(array[
      case when s.is_verified then 'Identitet i struka provjereni' else 'Struka još nije provjerena' end,
      case when s.review_count >= 3 then s.avg_rating::text || ' prosjek iz ' || s.review_count || ' recenzija' end,
      case when s.review_count between 1 and 2 then 'Tek nekoliko recenzija' end,
      case when s.review_count = 0 then 'Još nema recenzija' end,
      case when s.accepted_bids >= 3 then s.accepted_bids || ' prihvaćenih poslova' end,
      case when s.portfolio_count > 0 then 'Ima portfolio radova' end,
      case when s.last_seen_at > now() - interval '7 days' then 'Aktivan ove sedmice' end
    ], null) as reasons
  from s;
$$;

revoke execute on function public.trust_summary(uuid) from public;
grant execute on function public.trust_summary(uuid) to anon, authenticated;;
