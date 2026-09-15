-- Phase 1: advanced bidding, badges, portfolio, verification, unique UID, contact protection.
-- Run after migration_moderation_and_support.sql and migration_public_profiles.sql.

-- 1. Unique human-readable UID on profiles (e.g. UID-10001)
alter table public.profiles add column if not exists display_uid text unique;

create sequence if not exists public.uid_seq start 10000;

create or replace function public.assign_display_uid()
returns trigger as $$
begin
  if new.display_uid is null then
    new.display_uid := 'UID-' || nextval('public.uid_seq');
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists set_display_uid on public.profiles;
create trigger set_display_uid before insert on public.profiles
  for each row execute function public.assign_display_uid();

-- backfill existing profiles that don't have one yet
update public.profiles set display_uid = 'UID-' || nextval('public.uid_seq') where display_uid is null;

-- expose display_uid through the public profile view (created in migration_public_profiles.sql)
create or replace view public.public_profiles as
select user_id, full_name, city, bio, avatar_url, created_at, display_uid
from public.profiles
where account_status = 'active';

grant select on public.public_profiles to anon, authenticated;

-- 2. Real bidding system (amount + written justification per bid)
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  bidder_id uuid not null,
  amount numeric(10,2) not null check (amount >= 0),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bids_listing_id on public.bids(listing_id);
create index if not exists idx_bids_bidder_id on public.bids(bidder_id);

alter table public.bids enable row level security;

drop trigger if exists set_updated_at_bids on public.bids;
create trigger set_updated_at_bids before update on public.bids for each row execute function public.handle_updated_at();

drop policy if exists "bids_bidder_manage" on public.bids;
create policy "bids_bidder_manage" on public.bids for all
  using (auth.uid() = bidder_id) with check (auth.uid() = bidder_id);

drop policy if exists "bids_listing_owner_view" on public.bids;
create policy "bids_listing_owner_view" on public.bids for select
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));

drop policy if exists "bids_listing_owner_update" on public.bids;
create policy "bids_listing_owner_update" on public.bids for update
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));

drop policy if exists "bids_admin_manage" on public.bids;
create policy "bids_admin_manage" on public.bids for all using (public.is_admin()) with check (public.is_admin());

-- 3. Badges
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

alter table public.badges enable row level security;
drop policy if exists "badges_readable" on public.badges;
create policy "badges_readable" on public.badges for select using (true);
drop policy if exists "badges_admin_manage" on public.badges;
create policy "badges_admin_manage" on public.badges for all using (public.is_admin()) with check (public.is_admin());

insert into public.badges (code, label, description, icon) values
  ('verified', 'Verifikovan', 'Identitet i stručnost su provjereni od strane našeg tima.', 'shield-check'),
  ('top_rated', 'Najbolje ocijenjen', 'Prosječna ocjena 4.8+ uz najmanje 10 recenzija.', 'star'),
  ('fast_responder', 'Brz odgovor', 'Odgovara na upite u prosjeku ispod 1 sat.', 'zap'),
  ('rising_talent', 'U usponu', 'Novi izvođač sa odličnim prvim recenzijama.', 'trending-up'),
  ('reliable', 'Pouzdan', 'Visoka stopa završenih poslova bez otkazivanja.', 'badge-check')
on conflict (code) do nothing;

create table if not exists public.user_badges (
  user_id uuid not null,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;
drop policy if exists "user_badges_readable" on public.user_badges;
create policy "user_badges_readable" on public.user_badges for select using (true);
drop policy if exists "user_badges_admin_manage" on public.user_badges;
create policy "user_badges_admin_manage" on public.user_badges for all using (public.is_admin()) with check (public.is_admin());

-- 4. Portfolio (past work — images/video)
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists idx_portfolio_items_user_id on public.portfolio_items(user_id);
alter table public.portfolio_items enable row level security;

drop policy if exists "portfolio_readable" on public.portfolio_items;
create policy "portfolio_readable" on public.portfolio_items for select using (true);
drop policy if exists "portfolio_manage_own" on public.portfolio_items;
create policy "portfolio_manage_own" on public.portfolio_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "portfolio_admin_manage" on public.portfolio_items;
create policy "portfolio_admin_manage" on public.portfolio_items for all using (public.is_admin()) with check (public.is_admin());

-- Public bucket for portfolio + listing media
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_insert_own" on storage.objects;
drop policy if exists "media_update_own" on storage.objects;
drop policy if exists "media_delete_own" on storage.objects;
drop policy if exists "media_read_public" on storage.objects;

create policy "media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_read_public" on storage.objects for select to public using (bucket_id = 'media');

-- 5. Verification requests (documents for "Verified" badge)
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_url text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.verification_requests enable row level security;
drop trigger if exists set_updated_at_verification on public.verification_requests;
create trigger set_updated_at_verification before update on public.verification_requests for each row execute function public.handle_updated_at();

drop policy if exists "verification_own_insert_select" on public.verification_requests;
create policy "verification_own_insert_select" on public.verification_requests for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "verification_own_insert" on public.verification_requests;
create policy "verification_own_insert" on public.verification_requests for insert with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "verification_admin_review" on public.verification_requests;
create policy "verification_admin_review" on public.verification_requests for update using (public.is_admin()) with check (public.is_admin());

-- Auto-award the "verified" badge when admin approves a request
create or replace function public.award_verified_badge()
returns trigger as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.user_badges (user_id, badge_id)
    select new.user_id, id from public.badges where code = 'verified'
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists award_verified_badge_trigger on public.verification_requests;
create trigger award_verified_badge_trigger after update on public.verification_requests
  for each row execute function public.award_verified_badge();

-- 6. Contact protection: block phone numbers / emails in messages until a bid is accepted
create or replace function public.check_message_contact_info()
returns trigger as $$
declare
  conv record;
  has_accepted_bid boolean;
begin
  select listing_id, participant_one, participant_two into conv
  from public.conversations where id = new.conversation_id;

  if conv.listing_id is null then
    has_accepted_bid := true;
  else
    select exists(
      select 1 from public.bids
      where listing_id = conv.listing_id
        and status = 'accepted'
        and bidder_id in (conv.participant_one, conv.participant_two)
    ) into has_accepted_bid;
  end if;

  if not has_accepted_bid and new.content ~* '(\+?387[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4})|(\y0\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}\y)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})' then
    raise exception 'CONTACT_INFO_BLOCKED: contact details can only be shared after a bid is accepted' using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists check_message_contact_trigger on public.messages;
create trigger check_message_contact_trigger
  before insert on public.messages
  for each row execute function public.check_message_contact_info();

-- Auto-create/reuse a conversation when a bid is accepted, so messaging can open immediately
create or replace function public.handle_bid_accepted()
returns trigger as $$
declare
  poster_id uuid;
  convo_id uuid;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select user_id into poster_id from public.listings where id = new.listing_id;

    select id into convo_id from public.conversations
    where listing_id = new.listing_id
      and ((participant_one = poster_id and participant_two = new.bidder_id)
        or (participant_one = new.bidder_id and participant_two = poster_id))
    limit 1;

    if convo_id is null then
      insert into public.conversations (listing_id, participant_one, participant_two)
      values (new.listing_id, poster_id, new.bidder_id);
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists handle_bid_accepted_trigger on public.bids;
create trigger handle_bid_accepted_trigger
  after update on public.bids
  for each row execute function public.handle_bid_accepted();
