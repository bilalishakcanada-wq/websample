create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, full_name, email, city, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public;

-- Backfill: create profile rows for existing auth users who don't have one yet
insert into public.profiles (user_id, full_name, email, city, phone)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), u.email,
       coalesce(u.raw_user_meta_data->>'city', ''), coalesce(u.raw_user_meta_data->>'phone', '')
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;;
