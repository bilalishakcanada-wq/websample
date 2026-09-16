-- OAuth sign-ups (Google, Facebook) skip the registration form, so they never
-- choose an account type, trades, city or phone. Track whether a profile has
-- been completed once; the dashboard sends incomplete profiles to
-- /profile?setup=1 and the profile form flips the flag on first save.
-- The trigger also reads the fields Google actually sends (name / picture).

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Anyone who already came through the form has effectively onboarded.
update public.profiles set onboarding_completed = true
where full_name <> '' and (city <> '' or phone <> '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  meta_type text;
  meta_trades text[];
  meta_name text;
  meta_avatar text;
  via_form boolean;
begin
  via_form := (new.raw_user_meta_data ? 'account_type');

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

  meta_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''), '');
  meta_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', ''), '');

  insert into public.profiles (user_id, full_name, email, city, phone, avatar_url, account_type, trades, onboarding_completed)
  values (
    new.id, meta_name, new.email,
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    meta_avatar, meta_type, meta_trades, via_form
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;
