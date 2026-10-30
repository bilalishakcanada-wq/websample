-- ============================================================
-- Zaključavanje zapisa koje korisnik ne smije sam pisati (30.10.2026.)
-- Nađeno provjerom žive baze kao običan prijavljen korisnik:
--   * user_roles: politika "user_roles_manage_own" (ALL, auth.uid() = user_id) dozvoljava
--     svakom korisniku da sebi upiše ulogu ADMIN. is_admin() tada vraća true i nalog vidi
--     sve profile, poruke, isplate... Uloge dijeli samo admin_set_role() (security definer).
--   * phone_verified_at: zaštita iz 11_phone_verification_guard.sql nije bila na bazi, pa
--     korisnik može sam označiti broj kao potvrđen (oznaka se vidi na javnom profilu).
--   * conversations: "conversations_manage_own" (ALL) dozvoljava da korisnik sam otvori
--     razgovor s bilo kim (bez posla) i piše mu, ili zamijeni drugog učesnika u postojećem.
--     Razgovore otvara samo handle_bid_accepted() (security definer); sajt ih samo čita.
--   * reports: prijavilac može promijeniti status svoje prijave (npr. "resolved") ili je obrisati.
--   * payment_records, subscriptions: korisnik može sam upisati "plaćanje" ili pretplatu.
--     Sajt ih ne koristi; ostaju samo za čitanje vlastitih redova.
--   * storage: bucket "avatars" prima bilo koji tip i veličinu fajla, "media" bilo koju veličinu.
-- Sve u jednoj transakciji; vraćanje je na dnu fajla.
-- ============================================================
begin;

-- 1. Uloge: korisnik vidi svoje, mijenja ih samo admin_set_role()
drop policy if exists "user_roles_manage_own" on public.user_roles;
drop policy if exists "user_roles_view_own" on public.user_roles;
create policy "user_roles_view_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;

-- 2. Potvrda broja telefona: isti okidač kao u 11_phone_verification_guard.sql
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

-- 3. Razgovori: učesnici samo čitaju (conversations_view_own ostaje), admin i dalje upravlja
drop policy if exists "conversations_manage_own" on public.conversations;
revoke insert, update, delete, truncate on public.conversations from anon;

-- 4. Prijave: korisnik prijavljuje i vidi svoje; status mijenja osoblje
drop policy if exists "reports_manage_own" on public.reports;
drop policy if exists "reports_insert_own" on public.reports;
drop policy if exists "reports_view_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id and status = 'open');
create policy "reports_view_own" on public.reports for select to authenticated using (auth.uid() = reporter_id);

-- 5. Plaćanja i pretplate: samo čitanje vlastitih redova
drop policy if exists "payment_records_manage_own" on public.payment_records;
drop policy if exists "payment_records_view_own" on public.payment_records;
create policy "payment_records_view_own" on public.payment_records for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.payment_records from anon, authenticated;

drop policy if exists "subscriptions_manage_own" on public.subscriptions;
drop policy if exists "subscriptions_view_own" on public.subscriptions;
create policy "subscriptions_view_own" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;

-- 6. Fajlovi: profilna slika samo JPG/PNG/WEBP do 5 MB (isto kao u sajtu), media do 25 MB (video za portfolio)
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';
update storage.buckets set file_size_limit = 26214400 where id = 'media';

commit;

-- Vraćanje (samo ako nešto zapne):
-- create policy "user_roles_manage_own" on public.user_roles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- grant insert, update, delete on public.user_roles to authenticated;
-- drop trigger if exists guard_profile_phone_verification on public.profiles;
-- create policy "conversations_manage_own" on public.conversations for all
--   using (auth.uid() in (participant_one, participant_two)) with check (auth.uid() in (participant_one, participant_two));
-- drop policy "reports_insert_own" on public.reports; drop policy "reports_view_own" on public.reports;
-- create policy "reports_manage_own" on public.reports for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);
-- update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'avatars';
-- update storage.buckets set file_size_limit = null where id = 'media';
