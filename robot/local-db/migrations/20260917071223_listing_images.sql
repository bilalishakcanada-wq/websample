create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  path text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists listing_images_listing_idx on public.listing_images (listing_id, position);
alter table public.listing_images enable row level security;

drop policy if exists listing_images_read on public.listing_images;
create policy listing_images_read on public.listing_images for select using (
  user_id = auth.uid() or public.is_staff()
  or exists (select 1 from public.listings l where l.id = listing_id and l.status in ('published', 'completed'))
);
drop policy if exists listing_images_insert_own on public.listing_images;
create policy listing_images_insert_own on public.listing_images for insert with check (
  user_id = auth.uid() and not public.is_suspended()
  and exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  and (select count(*) from public.listing_images i where i.listing_id = listing_images.listing_id) < 8
);
drop policy if exists listing_images_delete_own on public.listing_images;
create policy listing_images_delete_own on public.listing_images for delete using (user_id = auth.uid() or public.is_staff());

-- Rule #1: every job photo goes through the same AI check as avatars / portfolio
create or replace function public.enqueue_media_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'profiles' then
    if coalesce(new.avatar_url, '') <> '' and new.avatar_url is distinct from old.avatar_url then
      insert into public.moderation_queue (user_id, kind, media_url, source_id)
      values (new.user_id, 'avatar', new.avatar_url, new.id);
    end if;
  elsif TG_TABLE_NAME = 'portfolio_items' then
    if coalesce(new.media_type, 'image') <> 'video' and coalesce(new.media_url, '') <> '' then
      insert into public.moderation_queue (user_id, kind, media_url, source_id)
      values (new.user_id, 'portfolio', new.media_url, new.id);
    end if;
  elsif TG_TABLE_NAME = 'listing_images' then
    insert into public.moderation_queue (user_id, kind, media_url, source_id)
    values (new.user_id, 'listing', new.url, new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists enqueue_listing_image_moderation on public.listing_images;
create trigger enqueue_listing_image_moderation after insert on public.listing_images
for each row execute function public.enqueue_media_moderation();

alter publication supabase_realtime add table public.listing_images;;
