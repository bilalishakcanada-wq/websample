create or replace function public.protect_profile_identity_fields() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.identity_state := 'draft';
      new.identity_approved_at := null;
    else
      new.identity_state := old.identity_state;
      new.identity_approved_at := old.identity_approved_at;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists protect_profile_identity_fields on public.profiles;
create trigger protect_profile_identity_fields before insert or update on public.profiles
  for each row execute function public.protect_profile_identity_fields();

revoke execute on function public.protect_profile_identity_fields() from public, anon, authenticated;

create or replace function public.identity_ok(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select p.identity_state = 'approved'
           or p.created_at < (select grandfather_before from public.verification_policy where id)
           or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                      where ur.user_id = p_user and r.name in ('ADMIN', 'MODERATOR'))
    from public.profiles p where p.user_id = p_user
  ), false);
$fn$;;
