-- ============================================================
-- Phone verification stays true to the number.
--   * a user can't mark their own number verified (phone_verified_at is set only by
--     on_auth_phone_confirmed, after the SMS code is checked)
--   * changing the number in the profile drops the "verified" mark and the mobile_verified
--     badge, unless the new number is the one already confirmed by SMS
-- ============================================================
create or replace function public.guard_profile_phone_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_auth_phone text;
  v_confirmed timestamptz;
begin
  if coalesce(current_setting('poso.system_write', true), '') = '1' or auth.role() = 'service_role' then
    return new;
  end if;
  new.phone_verified_at := old.phone_verified_at;
  if new.phone is distinct from old.phone then
    -- "061 234 567" / "+387 61 234 567" / "0038761234567" -> "38761234567" (the form auth.users keeps)
    v_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
    if v_phone like '00387%' then v_phone := substr(v_phone, 3);
    elsif v_phone like '0%' then v_phone := '387' || substr(v_phone, 2);
    end if;
    select phone, phone_confirmed_at into v_auth_phone, v_confirmed from auth.users where id = new.user_id;
    new.phone_verified_at := case when v_phone <> '' and v_confirmed is not null and v_phone = v_auth_phone then v_confirmed end;
    if (new.phone_verified_at is null) is distinct from (old.phone_verified_at is null) then
      perform public.set_badge(new.user_id, 'mobile_verified', new.phone_verified_at is not null);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_phone_verification() from public, anon, authenticated;
drop trigger if exists guard_profile_phone_verification on public.profiles;
create trigger guard_profile_phone_verification before update on public.profiles
  for each row execute function public.guard_profile_phone_verification();

-- ============================================================
-- Verified by SMS: the person gets a notification that the number is verified, and so do the
-- admins (who see phone numbers). Otherwise the same as before: profile mark + mobile_verified badge.
-- ============================================================
create or replace function public.on_auth_phone_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shown text;
  v_name text;
  v_admin uuid;
begin
  if new.phone_confirmed_at is not null and old.phone_confirmed_at is distinct from new.phone_confirmed_at then
    perform set_config('poso.system_write', '1', true);
    update public.profiles set phone_verified_at = new.phone_confirmed_at, phone = coalesce(nullif(new.phone, ''), phone) where user_id = new.id;
    perform set_config('poso.system_write', '', true);
    perform public.set_badge(new.id, 'mobile_verified', true);

    -- "38761234567" -> "+387 61 234 567"
    v_shown := case when new.phone like '387%'
      then '+387 ' || regexp_replace(substr(new.phone, 4), '^(\d{2})(\d{3})(\d{3})(\d*)$', '\1 \2 \3\4')
      else '+' || coalesce(new.phone, '') end;
    select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.id;

    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.id, 'badge', 'Broj telefona je potvrđen ✅',
            v_shown || ' je verifikovan. Dobio/la si značku „Telefon verifikovan“, vidi se na tvom profilu.',
            '/account/postavke#telefon', 'phone_verified:' || new.id || ':' || coalesce(new.phone, ''))
    on conflict do nothing;

    for v_admin in
      select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name = 'ADMIN'
    loop
      insert into public.notifications (user_id, type, title, message, link)
      values (v_admin, 'moderation', 'Telefon verifikovan — ' || coalesce(v_name, 'korisnik'),
              coalesce(v_name, 'Korisnik') || ' je potvrdio/la broj ' || v_shown || ' SMS kodom.', '/admin');
    end loop;
  end if;
  return new;
end;
$$;
revoke execute on function public.on_auth_phone_confirmed() from public, anon, authenticated;
