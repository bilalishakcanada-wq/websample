create or replace function public.staff_guard_target(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF' using errcode = '42501'; end if;
  if public.is_staff_user(p_user_id) and not public.is_admin() then raise exception 'FORBIDDEN_STAFF' using errcode = '42501'; end if;
end;
$$;
revoke execute on function public.staff_guard_target(uuid) from public, anon, authenticated;

create or replace function public.duration_label(p_hours integer)
returns text language sql immutable as $$
  select case
    when p_hours is null then 'trajno'
    when p_hours % 24 = 0 then (p_hours / 24)::text || case when p_hours / 24 = 1 then ' dan' else ' dana' end
    else p_hours::text || case
      when p_hours = 1 then ' sat'
      when p_hours % 10 in (2, 3, 4) and p_hours % 100 not in (12, 13, 14) then ' sata'
      else ' sati' end
  end;
$$;

create or replace function public.admin_suspend_for(p_user_id uuid, p_hours integer default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_reason text := coalesce(nullif(btrim(p_reason), ''), case when p_hours is null then 'Trajna suspenzija (Poso.ba tim).' else 'Suspenzija ' || public.duration_label(p_hours) || ' (Poso.ba tim).' end);
begin
  perform public.staff_guard_target(p_user_id);
  if p_hours is not null and p_hours < 1 then raise exception 'BAD_DURATION'; end if;
  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'suspended',
      suspended_until = case when p_hours is null then null else now() + make_interval(hours => p_hours) end,
      suspension_reason = v_reason
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);
  insert into public.moderation_events (user_id, source_table, snippet, action, reviewed_by, reviewed_at)
  values (p_user_id, 'profiles', v_reason, 'suspended', auth.uid(), now());
  perform public.log_staff_action('suspend', p_user_id, jsonb_build_object('hours', p_hours, 'reason', v_reason));
end;
$$;

create or replace function public.admin_suspend(p_user_id uuid, p_days integer default null, p_reason text default null)
returns void language sql security definer set search_path = public as $$
  select public.admin_suspend_for(p_user_id, case when p_days is null then null else p_days * 24 end, p_reason);
$$;

create or replace function public.admin_lift_suspension(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard_target(p_user_id);
  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'active', suspended_until = null, suspension_reason = null
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);
  insert into public.moderation_events (user_id, source_table, snippet, action, reviewed_by, reviewed_at)
  values (p_user_id, 'profiles', 'Suspenziju ukinuo Poso.ba tim.', 'lifted', auth.uid(), now());
  perform public.log_staff_action('lift', p_user_id, '{}'::jsonb);
end;
$$;

create or replace function public.admin_redact(p_kind text, p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_text constant text := '[uklonjeno od strane Poso.ba tima]';
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_kind = 'message' then
    select sender_id into v_user from public.messages where id = p_id;
  elsif p_kind = 'bid' then
    select bidder_id into v_user from public.bids where id = p_id;
  elsif p_kind = 'review' then
    select reviewer_id into v_user from public.reviews where id = p_id;
  elsif p_kind = 'listing' then
    select user_id into v_user from public.listings where id = p_id;
  else
    raise exception 'UNKNOWN_KIND';
  end if;
  if v_user is null then return; end if;
  if public.is_staff_user(v_user) and not public.is_admin() then raise exception 'FORBIDDEN_STAFF' using errcode = '42501'; end if;

  if p_kind = 'message' then
    update public.messages set content = v_text where id = p_id;
  elsif p_kind = 'bid' then
    update public.bids set message = v_text, status = case when status = 'pending' then 'rejected' else status end where id = p_id;
  elsif p_kind = 'review' then
    delete from public.reviews where id = p_id;
  elsif p_kind = 'listing' then
    update public.listings set status = 'archived' where id = p_id;
  end if;
  insert into public.moderation_events (user_id, source_table, source_id, snippet, action, reviewed_by, reviewed_at)
  values (v_user, p_kind, p_id, coalesce(nullif(btrim(p_note), ''), 'Uklonio Poso.ba tim'), 'removed', auth.uid(), now());
  perform public.log_staff_action('redact', v_user, jsonb_build_object('kind', p_kind, 'id', p_id, 'note', p_note));
end;
$$;

select cron.alter_job((select jobid from cron.job where jobname = 'moderation-lift-suspensions'), schedule := '*/10 * * * *');

create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_role not in ('ADMIN', 'MODERATOR') then raise exception 'BAD_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF' using errcode = '42501'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role_id)
    select p_user_id, id from public.roles where name = p_role
    on conflict (user_id, role_id) do nothing;
    insert into public.notifications (user_id, type, title, message)
    values (p_user_id, 'role', case when p_role = 'ADMIN' then 'Dobio/la si administratorska prava' else 'Dobio/la si moderatorska prava' end,
            case when p_role = 'ADMIN' then 'Admin panel je u meniju pod „Admin“.' else 'Mod panel je u meniju pod „Mod“. Hvala što pomažeš zajednici!' end);
  else
    delete from public.user_roles ur using public.roles r
    where ur.role_id = r.id and r.name = p_role and ur.user_id = p_user_id;
  end if;
  perform public.log_staff_action(lower(p_role) || case when p_grant then '_grant' else '_revoke' end, p_user_id, '{}'::jsonb);
end;
$$;

create or replace function public.admin_list_staff()
returns table (user_id uuid, full_name text, email text, member_id text, avatar_url text, roles text[], last_seen_at timestamptz, actions_30d bigint, joined_staff_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.full_name, p.email, p.member_id, p.avatar_url,
         array_agg(r.name order by r.name),
         p.last_seen_at,
         (select count(*) from public.staff_actions a where a.actor_id = p.user_id and a.created_at > now() - interval '30 days'),
         min(ur.created_at)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.name in ('ADMIN', 'MODERATOR')
  join public.profiles p on p.user_id = ur.user_id
  where public.is_admin()
  group by p.user_id, p.full_name, p.email, p.member_id, p.avatar_url, p.last_seen_at
  order by min(ur.created_at);
$$;

create or replace function public.admin_staff_actions(p_limit integer default 100)
returns table (id uuid, actor_id uuid, actor_name text, action text, target_user_id uuid, target_name text, target_member text, details jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.actor_id, ap.full_name, a.action, a.target_user_id, tp.full_name, tp.member_id, a.details, a.created_at
  from public.staff_actions a
  left join public.profiles ap on ap.user_id = a.actor_id
  left join public.profiles tp on tp.user_id = a.target_user_id
  where public.is_admin() or a.actor_id = auth.uid()
  order by a.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.staff_list_users(p_term text default '', p_status text default null, p_limit integer default 100)
returns table (
  user_id uuid, member_id text, full_name text, email text, city text, avatar_url text, account_type text,
  account_status text, suspended_until timestamptz, suspension_reason text, created_at timestamptz, last_seen_at timestamptz,
  roles text[], strikes bigint, listings bigint, bids bigint, ai_risk text, ai_score integer, ai_assessed_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select public.is_admin() as admin, public.is_staff() as staff),
  term as (select nullif(lower(btrim(coalesce(p_term, ''))), '') as t)
  select p.user_id, p.member_id, p.full_name,
         case when me.admin then p.email end,
         p.city, p.avatar_url, p.account_type, p.account_status, p.suspended_until, p.suspension_reason, p.created_at, p.last_seen_at,
         (select coalesce(array_agg(r.name order by r.name), '{}') from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.user_id and r.name in ('ADMIN', 'MODERATOR')),
         (select count(*) from public.moderation_events e where e.user_id = p.user_id and e.action in ('masked', 'removed') and not e.dismissed and e.created_at > now() - interval '30 days'),
         (select count(*) from public.listings l where l.user_id = p.user_id),
         (select count(*) from public.bids b where b.bidder_id = p.user_id),
         p.ai_assessment ->> 'risk_level',
         (p.ai_assessment ->> 'trust_score')::integer,
         p.ai_assessed_at
  from public.profiles p, me, term
  where me.staff
    and (p_status is null or p.account_status = p_status)
    and (term.t is null
         or lower(p.full_name) like '%' || term.t || '%'
         or lower(p.member_id) like '%' || term.t || '%'
         or (me.admin and lower(p.email) like '%' || term.t || '%')
         or p.user_id::text = term.t
         or lower(coalesce(p.city, '')) like '%' || term.t || '%')
  order by p.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.staff_moderation_events(p_limit integer default 200)
returns table (id uuid, user_id uuid, source_table text, source_id uuid, fields text[], kinds text[], snippet text, action text, dismissed boolean, created_at timestamptz, full_name text, member_id text, email text, account_status text)
language sql stable security definer set search_path = public as $$
  select e.id, e.user_id, e.source_table, e.source_id, e.fields, e.kinds, e.snippet, e.action, e.dismissed, e.created_at,
         p.full_name, p.member_id, case when public.is_admin() then p.email end, p.account_status
  from public.moderation_events e
  left join public.profiles p on p.user_id = e.user_id
  where public.is_staff()
  order by e.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.admin_activity_feed(p_limit integer default 100, p_kind text default null, p_user uuid default null)
returns table (kind text, id uuid, user_id uuid, member_id text, full_name text, account_status text, title text, body text, status text, created_at timestamptz, ref_id uuid)
language sql stable security definer set search_path = public as $$
  with feed as (
    select 'listing' as kind, l.id, l.user_id, l.title, left(coalesce(l.description, ''), 240) as body, l.status, l.created_at, l.id as ref_id
    from public.listings l
    union all
    select 'bid', b.id, b.bidder_id, 'Ponuda ' || b.amount || ' KM', left(coalesce(b.message, ''), 240), b.status, b.created_at, b.listing_id
    from public.bids b
    union all
    select 'message', m.id, m.sender_id, 'Poruka', left(coalesce(m.content, ''), 240), null, m.created_at, m.conversation_id
    from public.messages m
    union all
    select 'review', r.id, r.reviewer_id, 'Recenzija ' || r.rating || '/5', left(coalesce(r.comment, ''), 240), null, r.created_at, r.reviewee_id
    from public.reviews r
    union all
    select 'profile', p.id, p.user_id, 'Novi nalog', coalesce(p.city, ''), p.account_type, p.created_at, p.user_id
    from public.profiles p
    union all
    select 'moderation', e.id, e.user_id, 'Pravilo #1 · ' || e.action, left(coalesce(e.snippet, ''), 240), array_to_string(e.kinds, ', '), e.created_at, e.source_id
    from public.moderation_events e
    union all
    select 'report', rp.id, rp.reporter_id, 'Prijava: ' || rp.target_type, left(coalesce(rp.reason, ''), 240), rp.status, rp.created_at, rp.target_id
    from public.reports rp
    union all
    select 'login', s.id, s.user_id, 'Prijava na nalog', coalesce(s.ip, '') || ' · ' || left(coalesce(s.user_agent, ''), 80), null, s.created_at, null
    from public.session_log s
  )
  select f.kind, f.id, f.user_id, pr.member_id, pr.full_name, pr.account_status, f.title, f.body, f.status, f.created_at, f.ref_id
  from feed f
  left join public.profiles pr on pr.user_id = f.user_id
  where public.is_staff()
    and (p_kind is null or f.kind = p_kind)
    and (p_user is null or f.user_id = p_user)
    and (p_kind is not null or p_user is not null or f.kind <> 'login')
  order by f.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.admin_support_threads()
returns table (user_id uuid, full_name text, member_id text, email text, last_message text, last_sender text, last_at timestamptz, unread bigint)
language sql stable security definer set search_path = public as $$
  select s.user_id, p.full_name, p.member_id, case when public.is_admin() then p.email end,
         (select message from public.support_messages x where x.user_id = s.user_id order by created_at desc limit 1),
         (select sender from public.support_messages x where x.user_id = s.user_id order by created_at desc limit 1),
         max(s.created_at),
         count(*) filter (where s.sender = 'user' and s.read_at is null)
  from public.support_messages s
  left join public.profiles p on p.user_id = s.user_id
  where public.is_staff()
  group by s.user_id, p.full_name, p.member_id, p.email
  order by max(s.created_at) desc;
$$;

create or replace function public.on_support_message_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text;
  v_member text;
  v_staff uuid;
begin
  select public.display_name_of(full_name), member_id into v_name, v_member from public.profiles where user_id = new.user_id;

  if new.sender = 'user' then
    for v_staff in
      select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name in ('ADMIN', 'MODERATOR')
    loop
      insert into public.notifications (user_id, type, title, message)
      values (v_staff, 'support', 'Nova poruka podrške — ' || coalesce(v_name, 'korisnik'), left(new.message, 200));
    end loop;

    if (select value from public.moderation_settings where key = 'notify_admin_external') = 'true' then
      perform net.http_post(
        url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/notify-admin',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
        body := jsonb_build_object('kind', 'support', 'user_id', new.user_id, 'name', v_name, 'member_id', v_member, 'message', left(new.message, 500)),
        timeout_milliseconds := 15000
      );
    end if;
  elsif new.sender = 'admin' then
    insert into public.notifications (user_id, type, title, message)
    values (new.user_id, 'support_reply', 'Podrška je odgovorila', left(new.message, 200));
  end if;
  return new;
end;
$$;;
