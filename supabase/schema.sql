-- Poso.ba production-ready schema foundation
-- IMPORTANT: Payment tables are prepared but provider remains unimplemented.

create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null,
  full_name text,
  email text not null,
  phone text,
  city text,
  bio text,
  avatar_url text,
  subscription_status text not null default 'free' check (subscription_status in ('free', 'plus', 'premium')),
  account_status text not null default 'active' check (account_status in ('active', 'pending', 'suspended', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists subscription_status text not null default 'free';
alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check check (subscription_status in ('free', 'plus', 'premium'));

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  category text,
  location text,
  price numeric(10,2),
  currency text not null default 'BAM',
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_tags (
  listing_id uuid not null references public.listings(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (listing_id, tag_id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  user_id uuid not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  participant_one uuid not null,
  participant_two uuid not null,
  status text not null default 'active' check (status in ('active', 'archived', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid not null,
  receiver_id uuid,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'info',
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  reviewer_id uuid not null,
  reviewee_id uuid not null,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan text not null default 'free' check (plan in ('free', 'plus', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'pending', 'cancelled', 'expired')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subscription_id uuid,
  provider text,
  provider_reference text,
  amount numeric(10,2),
  currency text default 'BAM',
  payment_type text not null default 'subscription' check (payment_type in ('subscription', 'credit_pack', 'featured_listing', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  bucket_name text not null default 'uploads',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_email_verified()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  );
$$;

grant execute on function public.is_email_verified() to authenticated;

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_listings_user_id on public.listings(user_id);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_tags_created_by on public.tags(created_by);
create index if not exists idx_listing_tags_tag_id on public.listing_tags(tag_id);

alter table public.listings drop constraint if exists listings_title_length;
alter table public.listings add constraint listings_title_length check (char_length(title) between 3 and 120);
alter table public.listings drop constraint if exists listings_description_length;
alter table public.listings add constraint listings_description_length check (description is null or char_length(description) <= 5000);
create index if not exists idx_applications_listing_id on public.applications(listing_id);
create index if not exists idx_applications_user_id on public.applications(user_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_payment_records_user_id on public.payment_records(user_id);
create index if not exists idx_uploaded_files_user_id on public.uploaded_files(user_id);

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.listings enable row level security;
alter table public.tags enable row level security;
alter table public.listing_tags enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_records enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.reports enable row level security;

drop policy if exists "uploads_insert_own" on storage.objects;
drop policy if exists "uploads_select_own" on storage.objects;
drop policy if exists "uploads_delete_own" on storage.objects;

create policy "uploads_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profiles_view_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "listings_view_public_or_own" on public.listings;
drop policy if exists "listings_manage_own" on public.listings;
drop policy if exists "tags_readable" on public.tags;
drop policy if exists "tags_manage_own" on public.tags;
drop policy if exists "listing_tags_readable" on public.listing_tags;
drop policy if exists "listing_tags_manage_own" on public.listing_tags;
drop policy if exists "applications_manage_own" on public.applications;
drop policy if exists "applications_view_listing_owner" on public.applications;
drop policy if exists "applications_update_listing_owner" on public.applications;
drop policy if exists "conversations_view_own" on public.conversations;
drop policy if exists "messages_view_own" on public.messages;
drop policy if exists "notifications_view_own" on public.notifications;
drop policy if exists "subscriptions_manage_own" on public.subscriptions;
drop policy if exists "payment_records_manage_own" on public.payment_records;
drop policy if exists "uploaded_files_manage_own" on public.uploaded_files;
drop policy if exists "reports_manage_own" on public.reports;
drop policy if exists "user_roles_manage_own" on public.user_roles;
drop policy if exists "roles_readable" on public.roles;
drop policy if exists "reviews_readable" on public.reviews;
drop policy if exists "reviews_manage_own" on public.reviews;
drop policy if exists "conversations_manage_own" on public.conversations;
drop policy if exists "messages_manage_own" on public.messages;

create policy "profiles_view_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "listings_view_public_or_own" on public.listings for select using (status = 'published' or auth.uid() = user_id);
create policy "listings_insert_own" on public.listings for insert
  with check (auth.uid() = user_id and (status <> 'published' or public.is_email_verified()));
create policy "listings_update_own" on public.listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (status <> 'published' or public.is_email_verified()));
create policy "listings_delete_own" on public.listings for delete using (auth.uid() = user_id);

create policy "tags_readable" on public.tags for select using (true);
create policy "tags_manage_own" on public.tags for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "listing_tags_readable" on public.listing_tags for select using (
  exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'published' or l.user_id = auth.uid()))
);
create policy "listing_tags_manage_own" on public.listing_tags for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

create policy "applications_manage_own" on public.applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "applications_view_listing_owner" on public.applications for select using (
  auth.uid() = user_id or exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
);
create policy "applications_update_listing_owner" on public.applications for update using (
  exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
);
create policy "conversations_view_own" on public.conversations for select using (auth.uid() in (participant_one, participant_two));
create policy "conversations_manage_own" on public.conversations for all using (auth.uid() in (participant_one, participant_two)) with check (auth.uid() in (participant_one, participant_two));
create policy "messages_view_own" on public.messages for select using (auth.uid() in (sender_id, receiver_id));
create policy "messages_manage_own" on public.messages for all using (auth.uid() = sender_id) with check (auth.uid() = sender_id);
create policy "notifications_view_own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions_manage_own" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_records_manage_own" on public.payment_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "uploaded_files_manage_own" on public.uploaded_files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reports_manage_own" on public.reports for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);
create policy "user_roles_manage_own" on public.user_roles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "roles_readable" on public.roles for select using (true);
create policy "reviews_readable" on public.reviews for select using (true);
create policy "reviews_manage_own" on public.reviews for all using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.protect_profile_system_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    new.subscription_status = old.subscription_status;
    new.account_status = old.account_status;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_profiles on public.profiles;
drop trigger if exists protect_profile_system_fields on public.profiles;
drop trigger if exists set_updated_at_roles on public.roles;
drop trigger if exists set_updated_at_user_roles on public.user_roles;
drop trigger if exists set_updated_at_listings on public.listings;
drop trigger if exists set_updated_at_tags on public.tags;
drop trigger if exists set_updated_at_applications on public.applications;
drop trigger if exists set_updated_at_conversations on public.conversations;
drop trigger if exists set_updated_at_messages on public.messages;
drop trigger if exists set_updated_at_notifications on public.notifications;
drop trigger if exists set_updated_at_reviews on public.reviews;
drop trigger if exists set_updated_at_subscriptions on public.subscriptions;
drop trigger if exists set_updated_at_payment_records on public.payment_records;
drop trigger if exists set_updated_at_uploaded_files on public.uploaded_files;
drop trigger if exists set_updated_at_reports on public.reports;

create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.handle_updated_at();
create trigger protect_profile_system_fields before update on public.profiles for each row execute function public.protect_profile_system_fields();
create trigger set_updated_at_roles before update on public.roles for each row execute function public.handle_updated_at();
create trigger set_updated_at_user_roles before update on public.user_roles for each row execute function public.handle_updated_at();
create trigger set_updated_at_listings before update on public.listings for each row execute function public.handle_updated_at();
create trigger set_updated_at_tags before update on public.tags for each row execute function public.handle_updated_at();
create trigger set_updated_at_applications before update on public.applications for each row execute function public.handle_updated_at();
create trigger set_updated_at_conversations before update on public.conversations for each row execute function public.handle_updated_at();
create trigger set_updated_at_messages before update on public.messages for each row execute function public.handle_updated_at();
create trigger set_updated_at_notifications before update on public.notifications for each row execute function public.handle_updated_at();
create trigger set_updated_at_reviews before update on public.reviews for each row execute function public.handle_updated_at();
create trigger set_updated_at_subscriptions before update on public.subscriptions for each row execute function public.handle_updated_at();
create trigger set_updated_at_payment_records before update on public.payment_records for each row execute function public.handle_updated_at();
create trigger set_updated_at_uploaded_files before update on public.uploaded_files for each row execute function public.handle_updated_at();
create trigger set_updated_at_reports before update on public.reports for each row execute function public.handle_updated_at();
