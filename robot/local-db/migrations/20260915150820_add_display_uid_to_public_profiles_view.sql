create or replace view public.public_profiles as
select user_id, full_name, city, bio, avatar_url, created_at, display_uid
from public.profiles
where account_status = 'active';

grant select on public.public_profiles to anon, authenticated;;
