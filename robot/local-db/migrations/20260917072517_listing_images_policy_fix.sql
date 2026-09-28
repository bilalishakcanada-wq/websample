create or replace function public.listing_image_count(p_listing_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.listing_images where listing_id = p_listing_id;
$$;
drop policy if exists listing_images_insert_own on public.listing_images;
create policy listing_images_insert_own on public.listing_images for insert with check (
  user_id = auth.uid() and not public.is_suspended()
  and exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  and public.listing_image_count(listing_id) < 8
);
delete from public.listings where user_id = (select id from auth.users where email = 'audit.user@posoba.dev');;
