delete from public.user_roles ur where not exists (select 1 from public.roles r where r.id = ur.role_id);
alter table public.user_roles drop constraint if exists user_roles_role_id_fkey;
alter table public.user_roles add constraint user_roles_role_id_fkey foreign key (role_id) references public.roles(id) on delete cascade;

-- service-role / admin helper: is this user an admin?
create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.name = 'ADMIN'
  );
$$;
revoke execute on function public.is_admin_user(uuid) from public, anon, authenticated;;
