-- ============================================================
-- 1. Private member ID (PB-XXXX-XXXX), visible only to the owner and admins
-- ============================================================
alter table public.profiles add column if not exists member_id text;

create or replace function public.generate_member_id()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I to avoid confusion
  candidate text;
  bytes bytea;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    candidate := '';
    for i in 0..7 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    candidate := 'PB-' || left(candidate, 4) || '-' || right(candidate, 4);
    exit when not exists (select 1 from public.profiles where member_id = candidate);
  end loop;
  return candidate;
end;
$$;
revoke execute on function public.generate_member_id() from public, anon, authenticated;

update public.profiles set member_id = public.generate_member_id() where member_id is null;
alter table public.profiles alter column member_id set not null;
create unique index if not exists profiles_member_id_key on public.profiles (member_id);

-- Replace the old sequential public UID with the private member ID.
drop trigger if exists set_display_uid on public.profiles;
drop function if exists public.assign_display_uid();
drop sequence if exists public.uid_seq;

create or replace function public.assign_member_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.member_id is null then
    new.member_id := public.generate_member_id();
  end if;
  return new;
end;
$$;
revoke execute on function public.assign_member_id() from public, anon, authenticated;

create trigger set_member_id
  before insert on public.profiles
  for each row execute function public.assign_member_id();

-- ============================================================
-- 2. Display name: "Bilal I." — first name + initial of the last name
-- ============================================================
create or replace function public.display_name_of(p_name text)
returns text
language sql
immutable
as $$
  with n as (
    select btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')) as v
  )
  select case
    when n.v = '' then 'Korisnik Poso.ba'
    when position(' ' in n.v) = 0 then initcap(n.v)
    else initcap(split_part(n.v, ' ', 1)) || ' ' || upper(left(reverse(split_part(reverse(n.v), ' ', 1)), 1)) || '.'
  end
  from n;
$$;

-- ============================================================
-- 3. Real full name: first + last name, letters only (checked once onboarding is done)
-- ============================================================
create or replace function public.is_valid_full_name(p_name text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_name, '') ~ '^[[:alpha:]][[:alpha:]''’.-]*(\s+[[:alpha:]][[:alpha:]''’.-]*)+$'
     and length(coalesce(p_name, '')) between 3 and 120;
$$;

-- ============================================================
-- 4. System fields the user can never change themselves
-- ============================================================
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists suspension_reason text;

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.subscription_status := old.subscription_status;
    new.account_status := old.account_status;
    new.suspended_until := old.suspended_until;
    new.suspension_reason := old.suspension_reason;
    new.member_id := old.member_id;
    new.verified_trade := old.verified_trade;
    new.created_at := old.created_at;
    if new.onboarding_completed and not public.is_valid_full_name(new.full_name) then
      raise exception 'FULL_NAME_INVALID: full name must contain a first and a last name' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 5. Public view: no full name, no email/phone, no member ID
-- ============================================================
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false) as
  select
    user_id,
    public.display_name_of(full_name) as display_name,
    city,
    bio,
    avatar_url,
    created_at,
    account_type,
    trades,
    verified_trade,
    last_seen_at
  from public.profiles
  where account_status = 'active';

grant select on public.public_profiles to anon, authenticated;

alter table public.profiles drop column if exists display_uid;;
