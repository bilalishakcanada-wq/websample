-- roles must never outlive the account they were granted to
delete from public.user_roles ur where not exists (select 1 from auth.users u where u.id = ur.user_id);
alter table public.user_roles drop constraint if exists user_roles_user_id_fkey;
alter table public.user_roles add constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;;
