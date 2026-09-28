-- staff-only RPCs: not callable by anonymous visitors at all (they also check is_staff/is_admin inside)
revoke execute on function public.admin_badge_catalog() from public, anon;
revoke execute on function public.admin_delete_badge(text) from public, anon;
revoke execute on function public.admin_grant_badge(uuid, text, text) from public, anon;
revoke execute on function public.admin_revoke_badge(uuid, text) from public, anon;
revoke execute on function public.admin_save_badge(text, text, text, text, text, text) from public, anon;
revoke execute on function public.admin_list_staff() from public, anon;
revoke execute on function public.admin_set_role(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_staff_actions(integer) from public, anon;
revoke execute on function public.admin_suspend_for(uuid, integer, text) from public, anon;
revoke execute on function public.admin_user_dossier(uuid) from public, anon;
revoke execute on function public.staff_list_users(text, text, integer) from public, anon;
revoke execute on function public.staff_moderation_events(integer) from public, anon;
revoke execute on function public.staff_overview() from public, anon;
revoke execute on function public.staff_role() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_moderator() from public, anon;
revoke execute on function public.is_staff_user(uuid) from public, anon;
revoke execute on function public.owner_user_id() from public, anon, authenticated;
-- trigger function: never an RPC
revoke execute on function public.log_auth_session() from public, anon, authenticated;
create or replace function public.duration_label(p_hours integer)
returns text language sql immutable set search_path = public as $$
  select case
    when p_hours is null then 'trajno'
    when p_hours % 24 = 0 then (p_hours / 24)::text || case when p_hours / 24 = 1 then ' dan' else ' dana' end
    else p_hours::text || case
      when p_hours = 1 then ' sat'
      when p_hours % 10 in (2, 3, 4) and p_hours % 100 not in (12, 13, 14) then ' sata'
      else ' sati' end
  end;
$$;;
