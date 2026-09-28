-- Admins get masked like everyone else but are never auto-suspended.
create or replace function public.apply_moderation_strike(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strikes int;
  v_until timestamptz;
  v_reason text;
  v_current_until timestamptz;
  v_current_status text;
begin
  if exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user_id and r.name = 'ADMIN') then
    return;
  end if;

  select count(*) into v_strikes
  from public.moderation_events
  where user_id = p_user_id
    and action in ('masked','removed')
    and not dismissed
    and created_at > now() - interval '30 days';

  if v_strikes < 3 then return; end if;

  if v_strikes >= 7 then
    v_until := null;
    v_reason := 'Trajna suspenzija: ' || v_strikes || ' kršenja Pravila #1 u 30 dana.';
  elsif v_strikes >= 5 then
    v_until := now() + interval '30 days';
    v_reason := 'Suspenzija 30 dana: ' || v_strikes || ' kršenja Pravila #1 u 30 dana.';
  else
    v_until := now() + interval '7 days';
    v_reason := 'Suspenzija 7 dana: ' || v_strikes || ' kršenja Pravila #1 u 30 dana.';
  end if;

  select account_status, suspended_until into v_current_status, v_current_until
  from public.profiles where user_id = p_user_id;

  if v_current_status = 'suspended' and (v_current_until is null or (v_until is not null and v_current_until >= v_until)) then
    return;
  end if;

  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'suspended', suspended_until = v_until, suspension_reason = v_reason
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);

  insert into public.moderation_events (user_id, source_table, fields, kinds, snippet, action)
  values (p_user_id, 'profiles', '{}', '{}', v_reason, 'suspended');
end;
$$;

-- ============================================================
-- Public profile: everything the page needs in one call
-- ============================================================
create or replace function public.public_profile_bundle(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when pp.user_id is null then null else jsonb_build_object(
    'profile', to_jsonb(pp),
    'trust', (select to_jsonb(t) from public.trust_summary(p_user_id) t),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.code, 'label', b.label, 'description', b.description, 'icon', b.icon, 'awarded_at', ub.awarded_at) order by ub.awarded_at)
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
      from (select * from public.listings where user_id = p_user_id and status = 'published' order by created_at desc limit 6) l
    ), '[]'::jsonb),
    'portfolio', coalesce((
      select jsonb_agg(jsonb_build_object('id', pi.id, 'media_url', pi.media_url, 'media_type', pi.media_type, 'caption', pi.caption) order by pi.created_at desc)
      from (select * from public.portfolio_items where user_id = p_user_id order by created_at desc limit 12) pi
    ), '[]'::jsonb)
  ) end
  from (select null::uuid as user_id) dummy
  left join public.public_profiles pp on pp.user_id = p_user_id;
$$;
grant execute on function public.public_profile_bundle(uuid) to anon, authenticated;

-- ============================================================
-- Own profile: private data + strikes, one call
-- ============================================================
create or replace function public.my_profile_bundle()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'email' || jsonb_build_object('email', p.email) from public.profiles p where p.user_id = auth.uid()),
    'portfolio', coalesce((
      select jsonb_agg(jsonb_build_object('id', pi.id, 'media_url', pi.media_url, 'media_type', pi.media_type, 'caption', pi.caption, 'created_at', pi.created_at) order by pi.created_at desc)
      from public.portfolio_items pi where pi.user_id = auth.uid()
    ), '[]'::jsonb),
    'verification', (select jsonb_build_object('status', v.status, 'trade', v.trade, 'created_at', v.created_at)
                     from public.verification_requests v where v.user_id = auth.uid() order by v.created_at desc limit 1),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.code, 'label', b.label, 'description', b.description, 'icon', b.icon) order by ub.awarded_at)
      from public.user_badges ub join public.badges b on b.id = ub.badge_id where ub.user_id = auth.uid()
    ), '[]'::jsonb),
    'trust', (select to_jsonb(t) from public.trust_summary(auth.uid()) t),
    'strikes', (select count(*) from public.moderation_events
                where user_id = auth.uid() and action in ('masked','removed') and not dismissed and created_at > now() - interval '30 days'),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'kinds', e.kinds, 'source_table', e.source_table, 'snippet', e.snippet, 'created_at', e.created_at) order by e.created_at desc)
      from (select * from public.moderation_events where user_id = auth.uid() order by created_at desc limit 10) e
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.my_profile_bundle() from public, anon;
grant execute on function public.my_profile_bundle() to authenticated;;
