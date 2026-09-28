-- ============================================================
-- 1. Private profile fields for the account panel
-- ============================================================
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists tax_id text;              -- JMBG / JIB, private, never in the public view
alter table public.profiles add column if not exists languages text[] not null default '{}';
alter table public.profiles add column if not exists phone_verified_at timestamptz;
alter table public.profiles add column if not exists notify_email boolean not null default true;
alter table public.profiles add column if not exists notify_push boolean not null default true;

-- ============================================================
-- 2. Badge catalog: verification + licence badges
-- ============================================================
insert into public.badges (code, label, description, icon) values
  ('mobile_verified',      'Telefon verifikovan',          'Broj telefona potvrđen SMS kodom.', 'phone'),
  ('id_verified',          'Lična karta verifikovana',     'Identitet potvrđen ličnim dokumentom koji je pregledao Poso.ba tim.', 'id-card'),
  ('police_check',         'Uvjerenje o nekažnjavanju',    'Priloženo važeće uvjerenje o nekažnjavanju.', 'shield-check'),
  ('payment_verified',     'Način plaćanja verifikovan',   'Dodani su podaci za primanje uplata.', 'credit-card'),
  ('licence_electrician',  'Električarska licenca',        'Važeća licenca za elektroinstalaterske radove.', 'zap'),
  ('licence_plumber',      'Vodoinstalaterska licenca',    'Važeća licenca za vodoinstalaterske radove.', 'droplets'),
  ('licence_gas',          'Plinska licenca',              'Važeća licenca za rad na plinskim instalacijama.', 'flame'),
  ('licence_hvac',         'Licenca za klimatizaciju i grijanje', 'Važeća licenca za klimatizaciju, ventilaciju i grijanje.', 'thermometer'),
  ('licence_construction', 'Građevinska licenca',          'Važeća licenca za građevinske radove.', 'hard-hat'),
  ('licence_driver',       'Vozačka dozvola',              'Važeća vozačka dozvola (prevoz, dostava, selidbe).', 'car')
on conflict (code) do update set label = excluded.label, description = excluded.description, icon = excluded.icon;

-- ============================================================
-- 3. Verification requests: identity / licence / police check
-- ============================================================
alter table public.verification_requests add column if not exists kind text not null default 'trade';
alter table public.verification_requests drop constraint if exists verification_requests_kind_check;
alter table public.verification_requests add constraint verification_requests_kind_check
  check (kind in ('trade','identity','licence','police_check'));
alter table public.verification_requests add column if not exists licence_type text;
alter table public.verification_requests drop constraint if exists verification_requests_licence_type_check;
alter table public.verification_requests add constraint verification_requests_licence_type_check
  check (licence_type is null or licence_type in ('electrician','plumber','gas','hvac','construction','driver'));

drop trigger if exists award_verified_badge_trigger on public.verification_requests;
drop function if exists public.award_verified_badge();

create or replace function public.handle_verification_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := case new.kind
    when 'identity' then 'id_verified'
    when 'police_check' then 'police_check'
    when 'licence' then 'licence_' || coalesce(new.licence_type, 'unknown')
    else 'verified'
  end;

  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    if new.kind = 'trade' then
      update public.profiles
        set verified_trade = coalesce(new.trade, verified_trade),
            account_type = case when account_type = 'client' then 'provider' else account_type end
        where user_id = new.user_id;
    end if;
    perform public.set_badge(new.user_id, v_code, true);
    insert into public.notifications (user_id, type, title, message)
    values (new.user_id, 'badge', 'Nova značka na tvom profilu',
            (select label from public.badges where code = v_code) || ' — zahtjev je odobren.');
  end if;

  if new.status = 'rejected' and coalesce(old.status, '') = 'approved' then
    if new.kind = 'trade' then
      update public.profiles set verified_trade = null where user_id = new.user_id;
    end if;
    perform public.set_badge(new.user_id, v_code, false);
  end if;

  if new.status = 'rejected' and coalesce(old.status, '') = 'pending' then
    insert into public.notifications (user_id, type, title, message)
    values (new.user_id, 'badge', 'Zahtjev za verifikaciju odbijen', coalesce(new.note, 'Pošalji jasniji dokument pa pokušaj ponovo.'));
  end if;

  return new;
end;
$$;
revoke execute on function public.handle_verification_approved() from public, anon, authenticated;

-- ============================================================
-- 4. Payout / billing details (private) -> payment badge
-- ============================================================
create table if not exists public.payout_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  holder_name text not null,
  bank_name text,
  iban text not null,
  billing_address text,
  billing_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists payout_accounts_own on public.payout_accounts;
create policy payout_accounts_own on public.payout_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists payout_accounts_admin_read on public.payout_accounts;
create policy payout_accounts_admin_read on public.payout_accounts for select using (public.is_admin());

create or replace function public.on_payout_account_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.set_badge(old.user_id, 'payment_verified', false);
    return old;
  end if;
  perform public.set_badge(new.user_id, 'payment_verified', coalesce(new.iban, '') <> '' and coalesce(new.holder_name, '') <> '');
  return new;
end;
$$;
revoke execute on function public.on_payout_account_change() from public, anon, authenticated;
drop trigger if exists payout_account_badge on public.payout_accounts;
create trigger payout_account_badge after insert or update or delete on public.payout_accounts
  for each row execute function public.on_payout_account_change();

-- ============================================================
-- 5. Phone verification -> mobile badge (auth.users mirror)
-- ============================================================
create or replace function public.on_auth_phone_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone_confirmed_at is not null and old.phone_confirmed_at is distinct from new.phone_confirmed_at then
    perform set_config('poso.system_write', '1', true);
    update public.profiles set phone_verified_at = new.phone_confirmed_at, phone = coalesce(nullif(new.phone, ''), phone) where user_id = new.id;
    perform set_config('poso.system_write', '', true);
    perform public.set_badge(new.id, 'mobile_verified', true);
  end if;
  return new;
end;
$$;
revoke execute on function public.on_auth_phone_confirmed() from public, anon, authenticated;
drop trigger if exists on_auth_phone_confirmed on auth.users;
create trigger on_auth_phone_confirmed after update of phone_confirmed_at on auth.users
  for each row execute function public.on_auth_phone_confirmed();

-- ============================================================
-- 6. Fee tiers (editable table) + earnings dashboard
-- ============================================================
create table if not exists public.fee_tiers (
  code text primary key,
  label text not null,
  min_30d_km numeric not null,
  fee_percent numeric not null,
  sort int not null
);
alter table public.fee_tiers enable row level security;
drop policy if exists fee_tiers_read on public.fee_tiers;
create policy fee_tiers_read on public.fee_tiers for select using (true);
drop policy if exists fee_tiers_admin on public.fee_tiers;
create policy fee_tiers_admin on public.fee_tiers for all using (public.is_admin()) with check (public.is_admin());
insert into public.fee_tiers (code, label, min_30d_km, fee_percent, sort) values
  ('bronze',   'Bronza',   0,    15,   1),
  ('silver',   'Srebro',   500,  13,   2),
  ('gold',     'Zlato',    1500, 11,   3),
  ('platinum', 'Platina',  3000, 9,    4)
on conflict (code) do nothing;

-- money earned as a provider in the last 30 days (accepted bid amount on completed jobs)
create or replace function public.provider_earnings_30d(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(b.amount), 0)
  from public.bids b join public.listings l on l.id = b.listing_id
  where b.bidder_id = p_user_id and b.status = 'accepted' and l.status = 'completed'
    and l.completed_at > now() - interval '30 days';
$$;
revoke execute on function public.provider_earnings_30d(uuid) from public, anon, authenticated;

create or replace function public.my_tier_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with e as (select public.provider_earnings_30d(auth.uid()) as earned),
  cur as (select t.* from public.fee_tiers t, e where t.min_30d_km <= e.earned order by t.sort desc limit 1),
  nxt as (select t.* from public.fee_tiers t, cur where t.sort = cur.sort + 1)
  select jsonb_build_object(
    'earned_30d', (select earned from e),
    'current', (select to_jsonb(cur) from cur),
    'next', (select to_jsonb(nxt) from nxt),
    'tiers', (select jsonb_agg(to_jsonb(t) order by t.sort) from public.fee_tiers t),
    'completed_30d', (select count(*) from public.bids b join public.listings l on l.id = b.listing_id
                      where b.bidder_id = auth.uid() and b.status = 'accepted' and l.status = 'completed' and l.completed_at > now() - interval '30 days'),
    'cancelled_30d', (select count(*) from public.bids b join public.listings l on l.id = b.listing_id
                      where b.bidder_id = auth.uid() and b.status = 'accepted' and l.status = 'cancelled' and l.cancel_reason = 'provider' and l.cancelled_at > now() - interval '30 days')
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.my_tier_dashboard() from public, anon;
grant execute on function public.my_tier_dashboard() to authenticated;

-- payment history: jobs I completed (earned) or had done (paid)
create or replace function public.my_payment_history()
returns table (
  listing_id uuid, title text, role text, other_name text, amount numeric, fee_percent numeric,
  net numeric, completed_at timestamptz, status text
)
language sql
stable
security definer
set search_path = public
as $$
  with fee as (
    select t.fee_percent from public.fee_tiers t where t.min_30d_km <= public.provider_earnings_30d(auth.uid()) order by t.sort desc limit 1
  )
  select l.id, l.title,
         case when b.bidder_id = auth.uid() then 'earned' else 'paid' end,
         case when b.bidder_id = auth.uid() then public.display_name_of(po.full_name) else public.display_name_of(pb.full_name) end,
         b.amount,
         case when b.bidder_id = auth.uid() then (select fee_percent from fee) else null end,
         case when b.bidder_id = auth.uid() then round(b.amount * (1 - (select fee_percent from fee) / 100), 2) else b.amount end,
         coalesce(l.completed_at, l.cancelled_at, l.updated_at),
         l.status
  from public.bids b
  join public.listings l on l.id = b.listing_id
  left join public.profiles po on po.user_id = l.user_id
  left join public.profiles pb on pb.user_id = b.bidder_id
  where b.status = 'accepted' and l.status in ('completed','cancelled')
    and (b.bidder_id = auth.uid() or l.user_id = auth.uid())
  order by coalesce(l.completed_at, l.cancelled_at, l.updated_at) desc;
$$;
revoke execute on function public.my_payment_history() from public, anon;
grant execute on function public.my_payment_history() to authenticated;

-- ============================================================
-- 7. Verification progress ("Tvoje verifikacije su X% završene")
-- ============================================================
create or replace function public.my_verification_progress()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select array_agg(bg.code) as codes from public.user_badges ub join public.badges bg on bg.id = ub.badge_id where ub.user_id = auth.uid()
  ),
  p as (select * from public.profiles where user_id = auth.uid()),
  checks as (
    select jsonb_build_array(
      jsonb_build_object('key','email','label','Email potvrđen','done', (select email_confirmed_at is not null from auth.users where id = auth.uid())),
      jsonb_build_object('key','mobile','label','Telefon verifikovan','done', 'mobile_verified' = any(coalesce((select codes from b),'{}'))),
      jsonb_build_object('key','id','label','Lična karta','done', 'id_verified' = any(coalesce((select codes from b),'{}'))),
      jsonb_build_object('key','payment','label','Način plaćanja','done', 'payment_verified' = any(coalesce((select codes from b),'{}'))),
      jsonb_build_object('key','avatar','label','Profilna slika','done', coalesce((select avatar_url from p),'') <> ''),
      jsonb_build_object('key','bio','label','O meni','done', length(coalesce((select bio from p),'')) >= 20)
    ) as items
  )
  select jsonb_build_object(
    'items', items,
    'percent', (select round(100.0 * count(*) filter (where (i->>'done')::boolean) / count(*)) from jsonb_array_elements(items) i)
  ) from checks
  where auth.uid() is not null;
$$;
revoke execute on function public.my_verification_progress() from public, anon;
grant execute on function public.my_verification_progress() to authenticated;

-- ============================================================
-- 8. Public view unchanged (no birth_date / tax_id); languages exposed
-- ============================================================
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false) as
  select
    user_id,
    public.display_name_of(full_name) as display_name,
    city, bio, avatar_url, created_at, account_type, trades, verified_trade, last_seen_at,
    education, work_experience, specialties, transportation, languages,
    (phone_verified_at is not null) as phone_verified
  from public.profiles
  where account_status = 'active';
grant select on public.public_profiles to anon, authenticated;

-- verification badges are instant on approval; keep the daily refresh from touching them:
-- (refresh_user_badges only manages activity badges — unchanged);
