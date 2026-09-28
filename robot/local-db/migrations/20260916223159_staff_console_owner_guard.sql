-- the first admin ever granted is the owner: nobody can take that role away
create or replace function public.owner_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id
  where r.name = 'ADMIN' order by ur.created_at, ur.user_id limit 1;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_role not in ('ADMIN', 'MODERATOR') then raise exception 'BAD_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF' using errcode = '42501'; end if;
  if not p_grant and p_role = 'ADMIN' and p_user_id = public.owner_user_id() then raise exception 'OWNER' using errcode = '42501'; end if;
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

-- the owner is also immune to suspension by anyone else
create or replace function public.staff_guard_target(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF' using errcode = '42501'; end if;
  if p_user_id = public.owner_user_id() then raise exception 'OWNER' using errcode = '42501'; end if;
  if public.is_staff_user(p_user_id) and not public.is_admin() then raise exception 'FORBIDDEN_STAFF' using errcode = '42501'; end if;
end;
$$;

drop function if exists public.admin_list_staff();
create or replace function public.admin_list_staff()
returns table (user_id uuid, full_name text, email text, member_id text, avatar_url text, roles text[], last_seen_at timestamptz, actions_30d bigint, joined_staff_at timestamptz, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.full_name, p.email, p.member_id, p.avatar_url,
         array_agg(r.name order by r.name),
         p.last_seen_at,
         (select count(*) from public.staff_actions a where a.actor_id = p.user_id and a.created_at > now() - interval '30 days'),
         min(ur.created_at),
         p.user_id = public.owner_user_id()
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.name in ('ADMIN', 'MODERATOR')
  join public.profiles p on p.user_id = ur.user_id
  where public.is_admin()
  group by p.user_id, p.full_name, p.email, p.member_id, p.avatar_url, p.last_seen_at
  order by min(ur.created_at);
$$;
select public.owner_user_id() = 'c269e221-c8c8-48fb-a1d1-0761340c04c8' as owner_is_you;;
