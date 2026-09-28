-- 1. Content moderation trigger (enforced in the database, not just the app layer)
create or replace function public.check_listing_content()
returns trigger as $$
declare
  combined text;
begin
  combined := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  if combined ~* '(pi[sš]tolj|pu[sš]k[ae]?|oru[zž]j[ae]|municij|granat[ae]|eksploziv|\mgun\M|firearm|\mpistol\M|\mrifle\M|ammunition|explosive|drog[aeu]|kokain|heroin|mari[hj]uana|kanabis|canabis|ecstasy|amfetamin|metamfetamin|cocaine)' then
    raise exception 'PROHIBITED_CONTENT: listing violates the content policy' using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists check_listing_content_trigger on public.listings;
create trigger check_listing_content_trigger
  before insert or update on public.listings
  for each row execute function public.check_listing_content();

-- 2. Admin helper (mirrors is_email_verified()'s security definer pattern)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'ADMIN'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 3. Admin-wide policies (additive: owners keep their existing access, admins get full access)
drop policy if exists "listings_admin_manage" on public.listings;
create policy "listings_admin_manage" on public.listings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reports_admin_manage" on public.reports;
create policy "reports_admin_manage" on public.reports for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_admin_view" on public.profiles;
create policy "profiles_admin_view" on public.profiles for select using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- 3b. Let admins change subscription_status / account_status
create or replace function public.protect_profile_system_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.subscription_status = old.subscription_status;
    new.account_status = old.account_status;
  end if;
  return new;
end;
$$ language plpgsql;

-- 4. Support chat
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sender text not null default 'user' check (sender in ('user', 'admin')),
  message text not null check (char_length(message) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_messages_user_id on public.support_messages(user_id);

alter table public.support_messages enable row level security;

drop trigger if exists set_updated_at_support_messages on public.support_messages;
create trigger set_updated_at_support_messages before update on public.support_messages for each row execute function public.handle_updated_at();

drop policy if exists "support_messages_select" on public.support_messages;
create policy "support_messages_select" on public.support_messages for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "support_messages_user_insert" on public.support_messages;
create policy "support_messages_user_insert" on public.support_messages for insert with check (auth.uid() = user_id and sender = 'user');

drop policy if exists "support_messages_admin_insert" on public.support_messages;
create policy "support_messages_admin_insert" on public.support_messages for insert with check (public.is_admin() and sender = 'admin');

drop policy if exists "support_messages_admin_update" on public.support_messages;
create policy "support_messages_admin_update" on public.support_messages for update using (public.is_admin()) with check (public.is_admin());;
