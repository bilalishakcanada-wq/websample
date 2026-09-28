-- Trigger functions fire as the table owner, so no client role ever needs to
-- call them over the REST API. Supabase's default privileges had granted anon
-- and authenticated EXECUTE on each of them; "revoke from public" does not
-- undo an explicit role grant, which is why they stayed reachable.
revoke execute on function public.check_message_contact_info() from anon, authenticated;
revoke execute on function public.handle_bid_accepted() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- The badge job rewrites badges for every user. It is called by pg_cron (as the
-- owner) and by the admin screen, so keep it callable for signed-in users but
-- refuse anyone who is not an admin, and drop anonymous access entirely.
create or replace function public.refresh_provider_badges()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- pg_cron runs as the function owner (no JWT); UI calls must be an admin.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Nedozvoljen pristup.' using errcode = '42501';
  end if;

  -- Top Rated: strong track record (4.8+ average across 10+ reviews)
  insert into public.user_badges (user_id, badge_id)
  select r.reviewee_id, b.id
  from (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews
    group by reviewee_id
  ) r
  cross join public.badges b
  where b.code = 'top_rated'
    and r.avg_rating >= 4.8
    and r.review_count >= 10
  on conflict do nothing;

  -- Rising Talent: new member (<= 30 days) with an early positive track record
  insert into public.user_badges (user_id, badge_id)
  select r.reviewee_id, b.id
  from (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews
    group by reviewee_id
  ) r
  join public.profiles p on p.user_id = r.reviewee_id
  cross join public.badges b
  where b.code = 'rising_talent'
    and p.created_at > now() - interval '30 days'
    and r.avg_rating >= 4.5
    and r.review_count between 1 and 9
  on conflict do nothing;

  -- Reliable: consistently sees bids through
  insert into public.user_badges (user_id, badge_id)
  select s.bidder_id, b.id
  from (
    select bidder_id,
      count(*) filter (where status = 'accepted') as accepted_count,
      count(*) filter (where status in ('accepted', 'rejected', 'withdrawn')) as resolved_count
    from public.bids
    group by bidder_id
  ) s
  cross join public.badges b
  where b.code = 'reliable'
    and s.accepted_count >= 3
    and s.resolved_count > 0
    and s.accepted_count::numeric / s.resolved_count >= 0.8
  on conflict do nothing;

  -- Fast Responder: replies in under an hour on average (3+ data points)
  insert into public.user_badges (user_id, badge_id)
  select rt.sender_id, b.id
  from (
    select sender_id, avg(response_minutes) as avg_response_minutes, count(*) as response_count
    from (
      select m.sender_id,
        extract(epoch from (m.created_at - lag(m.created_at) over (partition by m.conversation_id order by m.created_at))) / 60 as response_minutes,
        lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender
      from public.messages m
    ) pairs
    where prev_sender is not null and prev_sender <> sender_id
    group by sender_id
  ) rt
  cross join public.badges b
  where b.code = 'fast_responder'
    and rt.response_count >= 3
    and rt.avg_response_minutes <= 60
  on conflict do nothing;
end;
$function$;

revoke execute on function public.refresh_provider_badges() from anon;
grant execute on function public.refresh_provider_badges() to authenticated;;
