-- Job photos (migrations listing_images, listing_images_policy_fix, moderation_queue_listing_kind).
-- Up to 8 photos per listing, public for published/completed jobs, owner-managed,
-- every photo queued for the Rule #1 AI image check (moderate-media, kind 'listing').

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

-- security definer so the insert policy can count without recursing into its own select policy
create or replace function public.listing_image_count(p_listing_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.listing_images where listing_id = p_listing_id;
$$;

create policy listing_images_read on public.listing_images for select using (
  user_id = auth.uid() or public.is_staff()
  or exists (select 1 from public.listings l where l.id = listing_id and l.status in ('published', 'completed'))
);
create policy listing_images_insert_own on public.listing_images for insert with check (
  user_id = auth.uid() and not public.is_suspended()
  and exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  and public.listing_image_count(listing_id) < 8
);
create policy listing_images_delete_own on public.listing_images for delete using (user_id = auth.uid() or public.is_staff());

alter table public.moderation_queue drop constraint if exists moderation_queue_kind_check;
alter table public.moderation_queue add constraint moderation_queue_kind_check check (kind in ('avatar', 'portfolio', 'listing'));

-- enqueue_media_moderation() gained a listing_images branch (kind 'listing', media_url = new.url):
create trigger enqueue_listing_image_moderation after insert on public.listing_images
for each row execute function public.enqueue_media_moderation();

alter publication supabase_realtime add table public.listing_images;
