-- ============================================================================
-- Jednostavan način za majstore (40+)
--
-- Majstor u jednostavnom načinu vidi velika dugmad i šalje prijavu na posao bez
-- kucanja: cijena je unaprijed izabrana (budžet klijenta), poruka se sama napiše.
--
-- profiles.simple_mode:
--   null  = automatski: uključen kad osoba ima 40 ili više godina
--   true  = majstor ga je sam uključio
--   false = majstor ga je sam isključio
-- Godine se računaju iz datuma rođenja iz odobrene verifikacije identiteta (JMBG),
-- a ako je nema, iz datuma rođenja u profilu.
-- ============================================================================

alter table public.profiles add column if not exists simple_mode boolean;

comment on column public.profiles.simple_mode is
  'Jednostavan način prijave na posao: null = automatski (40+ godina), true/false = izbor korisnika.';

create or replace function public.my_simple_mode()
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_choice boolean;
  v_birth date;
  v_age int;
begin
  if v_uid is null then
    return jsonb_build_object('enabled', false, 'choice', null, 'age', null, 'auto', false);
  end if;

  select p.simple_mode, p.birth_date into v_choice, v_birth from public.profiles p where p.user_id = v_uid;

  select coalesce(
    (select iv.birth_date from public.identity_verifications iv
      where iv.user_id = v_uid and iv.state = 'approved' and iv.birth_date is not null
      order by iv.approved_at desc nulls last limit 1),
    v_birth) into v_birth;

  v_age := case when v_birth is null then null else extract(year from age(current_date, v_birth))::int end;

  return jsonb_build_object(
    'enabled', coalesce(v_choice, v_age >= 40, false),
    'choice', v_choice,
    'age', v_age,
    'auto', coalesce(v_age >= 40, false)
  );
end $fn$;

create or replace function public.set_simple_mode(p_on boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public as $fn$
begin
  if auth.uid() is null then
    raise exception 'Prijavi se' using errcode = '42501';
  end if;
  update public.profiles set simple_mode = p_on where user_id = auth.uid();
  return public.my_simple_mode();
end $fn$;

revoke execute on function public.my_simple_mode() from public, anon;
revoke execute on function public.set_simple_mode(boolean) from public, anon;
grant execute on function public.my_simple_mode() to authenticated;
grant execute on function public.set_simple_mode(boolean) to authenticated;
