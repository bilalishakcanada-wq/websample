-- Signup now asks how the person wants to use Poso.ba and, for tradespeople,
-- which trades they offer. Verification is tied to a specific trade so a
-- profile can say "Verifikovan majstor — Električar" rather than a generic
-- "verified" stamp.

alter table public.profiles
  add column if not exists account_type text not null default 'client',
  add column if not exists trades text[] not null default '{}',
  add column if not exists verified_trade text;

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('client', 'provider', 'both'));

alter table public.verification_requests
  add column if not exists trade text;

-- Carry the signup choices from auth metadata into the profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  meta_type text;
  meta_trades text[];
begin
  meta_type := coalesce(new.raw_user_meta_data->>'account_type', 'client');
  if meta_type not in ('client', 'provider', 'both') then
    meta_type := 'client';
  end if;

  begin
    meta_trades := coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'trades')), '{}');
  exception when others then
    meta_trades := '{}';
  end;

  insert into public.profiles (user_id, full_name, email, city, phone, account_type, trades)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    meta_type,
    meta_trades
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;

-- Approving a request stamps the trade onto the profile, promotes a pure
-- client account to provider, and awards the verified badge. Reverting an
-- approval to rejected undoes all three.
create or replace function public.handle_verification_approved()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    update public.profiles
      set verified_trade = coalesce(new.trade, verified_trade),
          account_type = case when account_type = 'client' then 'provider' else account_type end
      where user_id = new.user_id;

    insert into public.user_badges (user_id, badge_id)
    select new.user_id, b.id from public.badges b where b.code = 'verified'
    on conflict do nothing;
  end if;

  if new.status = 'rejected' and coalesce(old.status, '') = 'approved' then
    update public.profiles set verified_trade = null where user_id = new.user_id;
    delete from public.user_badges ub
      using public.badges b
      where ub.badge_id = b.id and b.code = 'verified' and ub.user_id = new.user_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_verification_approved() from anon, authenticated;

drop trigger if exists verification_approved on public.verification_requests;
create trigger verification_approved
  after update on public.verification_requests
  for each row execute function public.handle_verification_approved();

create or replace view public.public_profiles as
  select user_id, full_name, city, bio, avatar_url, created_at, display_uid,
         account_type, trades, verified_trade
  from public.profiles
  where account_status = 'active';
