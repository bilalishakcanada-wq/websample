-- ============================================================================
-- "Zatraži ponudu": a client sends a job privately to one provider (Airtasker's
-- "Request a quote").
--
--  * listings.invited_provider (added in 01) = the only provider who sees the job and may
--    send an offer. Nobody else sees it: not in search, the feed, job alerts or the
--    client's public profile.
--  * The provider gets a notification. They can send an offer (distance reach does not
--    apply, the client picked them) or decline, which tells the client.
--  * The client can "Otvori svima" at any time: invited_provider goes back to null, the
--    job becomes a normal public job and job alerts go out then.
--  * Limits: not to yourself, only to an active account, at most 10 requests a day.
--
-- Needs 01–04 first. Idempotent: safe to run more than once.
-- ============================================================================

-- Only the client, the invited provider and staff can read a private job. Restrictive, so
-- it narrows every existing select policy instead of replacing them.
drop policy if exists listings_private_quote on public.listings;
create policy listings_private_quote on public.listings
  as restrictive for select
  using (invited_provider is null or user_id = auth.uid() or invited_provider = auth.uid() or public.is_staff());

-- Who may set or change the invitation
create or replace function public.guard_listing_invite()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.invite_declined_at := null;
    if new.invited_provider is null then return new; end if;
    if new.invited_provider = new.user_id then
      raise exception 'ZAHTJEV_SEBI: ne možeš tražiti ponudu od sebe' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.profiles p where p.user_id = new.invited_provider and p.account_status = 'active') then
      raise exception 'IZVODJAC_NEDOSTUPAN: ovaj izvođač trenutno ne prima zahtjeve' using errcode = 'P0001';
    end if;
    if (select count(*) from public.listings l
        where l.user_id = new.user_id and l.invited_provider is not null and l.created_at > now() - interval '24 hours') >= 10 then
      raise exception 'PREVISE_ZAHTJEVA: danas si poslao/la 10 zahtjeva za ponudu, pokušaj sutra ili objavi posao svima' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE: an invitation can only be withdrawn (open the job to everyone), never moved
  if new.invited_provider is not null and new.invited_provider is distinct from old.invited_provider then
    raise exception 'ZAHTJEV_SE_NE_MIJENJA: zahtjev za ponudu se ne može preusmjeriti, objavi ga svima ili pošalji novi' using errcode = 'P0001';
  end if;
  if new.invited_provider is null then
    new.invite_declined_at := null;
  elsif new.invite_declined_at is distinct from old.invite_declined_at
        and auth.uid() is distinct from old.invited_provider then
    new.invite_declined_at := old.invite_declined_at;  -- only the provider declines, via decline_quote_request
  end if;
  return new;
end $$;

revoke execute on function public.guard_listing_invite() from public, anon, authenticated;

drop trigger if exists listings_invite_guard on public.listings;
create trigger listings_invite_guard
  before insert or update of invited_provider, invite_declined_at on public.listings
  for each row execute function public.guard_listing_invite();

-- Only the invited provider can offer on a private job
create or replace function public.guard_bid_quote_request()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_invited uuid;
begin
  select invited_provider into v_invited from public.listings where id = new.listing_id;
  if v_invited is not null and v_invited <> new.bidder_id then
    raise exception 'SAMO_POZVANI: ovaj posao je privatni zahtjev za drugog izvođača' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke execute on function public.guard_bid_quote_request() from public, anon, authenticated;

drop trigger if exists bids_quote_guard on public.bids;
create trigger bids_quote_guard
  before insert on public.bids
  for each row execute function public.guard_bid_quote_request();

-- The invited provider says no; the client is told and can open the job to everyone
create or replace function public.decline_quote_request(p_listing uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  l record;
  v_name text;
begin
  select id, user_id, title, status, invited_provider, invite_declined_at into l
  from public.listings where id = p_listing for update;
  if l.id is null or l.invited_provider is distinct from auth.uid() then
    raise exception 'NEMA_ZAHTJEVA: ovaj zahtjev za ponudu nije za tebe' using errcode = 'P0001';
  end if;
  if l.invite_declined_at is not null then return; end if;
  if l.status <> 'published' then
    raise exception 'POSAO_ZATVOREN: posao više ne prima ponude' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bids b where b.listing_id = l.id and b.bidder_id = auth.uid() and b.status = 'pending') then
    raise exception 'PONUDA_POSLANA: već si poslao/la ponudu; povuci je ako ne možeš preuzeti posao' using errcode = 'P0001';
  end if;
  update public.listings set invite_declined_at = now() where id = l.id;
  select coalesce(nullif(btrim(full_name), ''), 'Izvođač') into v_name from public.profiles where user_id = auth.uid();
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (l.user_id, 'quote_declined', v_name || ' ne može preuzeti posao',
          left(l.title, 120) || ' — otvori ga svima i ponude stižu od drugih izvođača.',
          '/listings/' || l.id::text, 'quote_declined:' || l.id::text)
  on conflict do nothing;
end $$;

revoke execute on function public.decline_quote_request(uuid) from public, anon;
grant execute on function public.decline_quote_request(uuid) to authenticated;

-- Job alerts and "posao objavljen" (same as live, plus): a private request only notifies the
-- invited provider; opening it to everyone later sends the normal alerts.
create or replace function public.on_listing_published_alerts()
returns trigger language plpgsql security definer set search_path = public
as $function$
declare a record;
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published'
     and not (old.invited_provider is not null and new.invited_provider is null) then
    return new;
  end if;

  if new.invited_provider is not null then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.user_id, 'task_live', 'Zahtjev za ponudu je poslan', left(new.title, 120) || ' — javićemo ti čim izvođač pošalje ponudu.', '/listings/' || new.id::text, 'live:' || new.id::text)
    on conflict do nothing;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    select new.invited_provider, 'quote_request',
           coalesce(nullif(btrim(p.full_name), ''), 'Klijent') || ' traži ponudu od tebe',
           left(new.title, 120) || coalesce(' · ' || new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end,
           '/listings/' || new.id::text, 'quote:' || new.id::text
    from public.profiles p where p.user_id = new.user_id
    on conflict do nothing;
    return new;
  end if;

  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.user_id, 'task_live', 'Tvoj posao je objavljen 🎉', left(new.title, 120) || ' — izvođači u blizini su obaviješteni. Ponude stižu ovdje.', '/listings/' || new.id::text, 'live:' || new.id::text)
  on conflict do nothing;
  if new.title like '[E2E]%' then return new; end if;
  for a in
    select distinct t.user_id from public.task_alerts t
    where t.user_id <> new.user_id
      and (t.keyword is null or t.keyword = '' or (new.title || ' ' || coalesce(new.description, '')) ilike '%' || t.keyword || '%')
      and (t.category is null or t.category = '' or t.category = new.category)
      and (t.city is null or t.city = '' or public.cities_match(t.city, new.location))
    union
    select p.user_id from public.profiles p
    where p.user_id <> new.user_id
      and p.account_status = 'active'
      and p.account_type in ('provider', 'both')
      and p.notify_push is distinct from false
      and new.category = any(coalesce(p.trades, '{}'))
      and (coalesce(p.city, '') = '' or public.cities_match(p.city, new.location) or new.location ilike '%online%')
  loop
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (a.user_id, 'task_alert', 'Novi posao: ' || new.title, coalesce(new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end, '/listings/' || new.id::text, 'alert:' || new.id::text || ':' || a.user_id::text)
    on conflict do nothing;
  end loop;
  return new;
end;
$function$;

drop trigger if exists listing_published_alerts on public.listings;
create trigger listing_published_alerts
  after insert or update of status, invited_provider on public.listings
  for each row execute function public.on_listing_published_alerts();

-- Public profile (same as live): private requests are not listed among the client's jobs
create or replace function public.public_profile_bundle(p_user_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when pp.user_id is null then null else jsonb_build_object(
    'profile', to_jsonb(pp),
    'trust', (select to_jsonb(t) from public.trust_summary(p_user_id) t),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.code, 'label', b.label, 'description', b.description, 'icon', b.icon, 'kind', b.kind, 'color', b.color, 'awarded_at', ub.awarded_at) order by ub.awarded_at)
      from public.user_badges ub join public.badges b on b.id = ub.badge_id where ub.user_id = p_user_id
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'rating', r.rating, 'comment', r.comment, 'created_at', r.created_at, 'listing_id', r.listing_id,
        'reviewer', jsonb_build_object('user_id', rp.user_id, 'display_name', rp.display_name, 'avatar_url', rp.avatar_url)
      ) order by r.created_at desc)
      from (select * from public.reviews where reviewee_id = p_user_id order by created_at desc limit 30) r
      left join public.public_profiles rp on rp.user_id = r.reviewer_id
    ), '[]'::jsonb),
    'review_count', (select count(*) from public.reviews where reviewee_id = p_user_id),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'category', l.category, 'location', l.location, 'price', l.price, 'currency', l.currency, 'created_at', l.created_at) order by l.created_at desc)
      from (select * from public.listings where user_id = p_user_id and status = 'published' and invited_provider is null order by created_at desc limit 6) l
    ), '[]'::jsonb),
    'portfolio', coalesce((
      select jsonb_agg(jsonb_build_object('id', pi.id, 'media_url', pi.media_url, 'media_type', pi.media_type, 'caption', pi.caption) order by pi.created_at desc)
      from (select * from public.portfolio_items where user_id = p_user_id order by created_at desc limit 12) pi
    ), '[]'::jsonb)
  ) end
  from (select null::uuid as user_id) dummy
  left join public.public_profiles pp on pp.user_id = p_user_id;
$function$;
