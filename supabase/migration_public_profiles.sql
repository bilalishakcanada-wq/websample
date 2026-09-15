-- Run this once in the Supabase SQL editor (after schema.sql and
-- migration_moderation_and_support.sql). Adds a public-safe profile view so anyone can view
-- a provider's profile page (name, city, bio, avatar, rating) without exposing private
-- fields like email/phone/account_status, plus a public "avatars" bucket for profile photos.

create or replace view public.public_profiles as
select user_id, full_name, city, bio, avatar_url, created_at
from public.profiles
where account_status = 'active';

grant select on public.public_profiles to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
drop policy if exists "avatars_read_public" on storage.objects;

create policy "avatars_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_read_public" on storage.objects
for select to public
using (bucket_id = 'avatars');
