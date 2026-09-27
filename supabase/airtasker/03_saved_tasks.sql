-- ============================================================================
-- Saved jobs ("Sačuvano"): a tasker bookmarks a job to come back to it.
-- Private to the person who saved it. Idempotent.
-- ============================================================================

create table if not exists public.saved_listings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists saved_listings_listing_idx on public.saved_listings (listing_id);

alter table public.saved_listings enable row level security;

drop policy if exists saved_listings_own_select on public.saved_listings;
create policy saved_listings_own_select on public.saved_listings
  for select to authenticated using (user_id = auth.uid());

drop policy if exists saved_listings_own_insert on public.saved_listings;
create policy saved_listings_own_insert on public.saved_listings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists saved_listings_own_delete on public.saved_listings;
create policy saved_listings_own_delete on public.saved_listings
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.saved_listings from anon;
grant select, insert, delete on public.saved_listings to authenticated;
