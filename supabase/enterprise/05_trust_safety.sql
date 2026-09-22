-- ============================================================================
-- MODUL 5 — Trust & Safety: bedž povjerenja, strajkovi, raskid ugovora
-- ----------------------------------------------------------------------------
-- Pravilo: strajk NIKAD ne nastaje automatski iz pritiska na dugme. Prijava ide
-- Support timu; tek njihova potvrda pretvara prijavu u zvaničan strajk.
-- 2. strajk -> javno upozorenje na profilu. 3. strajk -> suspenzija.
-- ============================================================================

do $$ begin
  create type termination_state as enum ('reported', 'under_review', 'upheld', 'dismissed', 'withdrawn');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------ 5.1 Šifarnik razloga raskida
-- Korisnik bira razlog iz liste (nema slobodnog teksta kao jedinog unosa),
-- jer po razlogu idu težina strajka i rok za odgovor druge strane.
create table if not exists public.termination_reasons (
  code            text primary key,
  label_bs        text not null,
  applies_to      text not null check (applies_to in ('client', 'provider', 'both')),
  strike_weight   smallint not null default 1 check (strike_weight between 0 and 3),
  requires_proof  boolean not null default false,
  sort            smallint not null default 0,
  is_active       boolean not null default true
);

insert into public.termination_reasons (code, label_bs, applies_to, strike_weight, requires_proof, sort) values
  ('no_show',           'Nije se pojavio/la na dogovorenom terminu',       'both',     1, false, 10),
  ('abandoned',         'Napustio/la posao prije završetka',               'provider', 2, false, 20),
  ('quality',           'Posao nije urađen po dogovoru',                   'provider', 1, true,  30),
  ('scope_change',      'Klijent je promijenio obim posla bez dogovora',   'client',   1, false, 40),
  ('payment_refused',   'Klijent odbija platiti dogovoreno',               'client',   2, true,  50),
  ('off_platform',      'Traži plaćanje mimo Poso.ba',                     'both',     3, true,  60),
  ('harassment',        'Neprimjereno ponašanje ili uznemiravanje',        'both',     3, true,  70),
  ('false_identity',    'Lažni identitet ili podaci',                      'both',     3, true,  80),
  ('mutual',            'Sporazumni raskid (bez strajka)',                 'both',     0, false, 90)
on conflict (code) do update set label_bs = excluded.label_bs, strike_weight = excluded.strike_weight;

-- ------------------------------------------------------- 5.2 Prijava raskida
create table if not exists public.contract_terminations (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid references public.listings(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  reporter_id    uuid not null references auth.users(id),
  accused_id     uuid not null references auth.users(id),
  reason_code    text not null references public.termination_reasons(code),
  detail         text,
  evidence_urls  text[] not null default '{}',
  state          termination_state not null default 'reported',
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  constraint termination_has_subject check (listing_id is not null or consultation_id is not null),
  constraint termination_not_self check (reporter_id <> accused_id)
);

create index if not exists terminations_queue_idx on public.contract_terminations (state, created_at)
  where state in ('reported', 'under_review');
create index if not exists terminations_accused_idx on public.contract_terminations (accused_id);

-- ista osoba ne može dva puta prijaviti isti posao
create unique index if not exists terminations_once_idx
  on public.contract_terminations (coalesce(listing_id, consultation_id), reporter_id, accused_id)
  where state <> 'withdrawn';

-- Dokaz je obavezan kad ga razlog traži — provjerava baza, ne samo forma.
create or replace function public.validate_termination() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_requires boolean;
begin
  select requires_proof into v_requires from public.termination_reasons
   where code = new.reason_code and is_active;
  if v_requires is null then raise exception 'NEPOZNAT_RAZLOG'; end if;
  if v_requires and coalesce(array_length(new.evidence_urls, 1), 0) = 0 then
    raise exception 'DOKAZ_JE_OBAVEZAN za razlog %', new.reason_code;
  end if;
  return new;
end $fn$;

drop trigger if exists terminations_validate on public.contract_terminations;
create trigger terminations_validate before insert on public.contract_terminations
  for each row execute function public.validate_termination();

-- --------------------------------------------------------------- 5.3 Strajkovi
create table if not exists public.strikes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  termination_id  uuid unique references public.contract_terminations(id) on delete cascade,
  reason_code     text not null references public.termination_reasons(code),
  weight          smallint not null default 1,
  issued_by       uuid references auth.users(id),
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz,                  -- strajkovi blijede nakon 24 mjeseca
  revoked_by      uuid references auth.users(id),
  revoked_at      timestamptz,
  revoke_reason   text
);

create index if not exists strikes_user_active_idx on public.strikes (user_id)
  where revoked_at is null;

create or replace function public.active_strike_count(p_user uuid) returns integer
language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(weight), 0)::int from public.strikes
   where user_id = p_user and revoked_at is null
     and (expires_at is null or expires_at > now());
$fn$;

alter table public.profiles
  add column if not exists strike_count smallint not null default 0,
  add column if not exists public_warning_at timestamptz,
  add column if not exists trust_badge_at timestamptz;

comment on column public.profiles.public_warning_at is
  'Postavljeno na 2. strajku: na javnom profilu stoji upozorenje da je osoba ranije prekršila ugovor.';

-- Posljedice strajka na jednom mjestu: 2 = javno upozorenje, 3 = suspenzija.
create or replace function public.apply_strike_effects() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_user uuid; v_count integer;
begin
  v_user := coalesce(new.user_id, old.user_id);
  v_count := public.active_strike_count(v_user);

  update public.profiles
     set strike_count = v_count,
         public_warning_at = case when v_count >= 2 then coalesce(public_warning_at, now()) else null end,
         account_status = case when v_count >= 3 then 'suspended' else account_status end,
         suspended_until = case when v_count >= 3 then now() + interval '90 days' else suspended_until end,
         suspension_reason = case when v_count >= 3 then 'Tri potvrđena kršenja ugovora' else suspension_reason end,
         -- bedž povjerenja pada čim postoji ijedan aktivan strajk
         trust_badge_at = case when v_count > 0 then null else trust_badge_at end,
         updated_at = now()
   where user_id = v_user;

  perform public.audit('strike.effects', 'profile', v_user, null, jsonb_build_object('strikes', v_count));
  return null;
end $fn$;

drop trigger if exists strikes_effects on public.strikes;
create trigger strikes_effects after insert or update or delete on public.strikes
  for each row execute function public.apply_strike_effects();

-- --------------------------------------------- 5.4 Odluka Supporta o prijavi
create or replace function public.review_termination(
  p_termination uuid, p_uphold boolean, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
declare v_t public.contract_terminations; v_weight smallint;
begin
  if not public.has_permission('strike.review') then
    raise exception 'FORBIDDEN: nedostaje strike.review' using errcode = '42501';
  end if;

  select * into v_t from public.contract_terminations where id = p_termination for update;
  if v_t.id is null then raise exception 'NOT_FOUND'; end if;
  if v_t.state in ('upheld', 'dismissed') then raise exception 'VEC_RIJESENO'; end if;

  update public.contract_terminations
     set state = case when p_uphold then 'upheld' else 'dismissed' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
   where id = p_termination;

  if p_uphold then
    select strike_weight into v_weight from public.termination_reasons where code = v_t.reason_code;
    if v_weight > 0 then
      insert into public.strikes (user_id, termination_id, reason_code, weight, issued_by, expires_at)
      values (v_t.accused_id, p_termination, v_t.reason_code, v_weight, auth.uid(), now() + interval '24 months')
      on conflict (termination_id) do nothing;
    end if;
  end if;

  perform public.audit(case when p_uphold then 'termination.uphold' else 'termination.dismiss' end,
                       'contract_termination', p_termination, 'strike.review',
                       jsonb_build_object('accused', v_t.accused_id, 'reason', v_t.reason_code));
end $fn$;

create or replace function public.revoke_strike(p_strike uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.has_permission('strike.revoke') then
    raise exception 'FORBIDDEN: nedostaje strike.revoke' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'RAZLOG_JE_OBAVEZAN'; end if;
  update public.strikes set revoked_by = auth.uid(), revoked_at = now(), revoke_reason = p_reason
   where id = p_strike and revoked_at is null;
  perform public.audit('strike.revoke', 'strike', p_strike, 'strike.revoke', jsonb_build_object('reason', p_reason));
end $fn$;

-- ---------------------------------------------------------- 5.5 Bedž povjerenja
-- Uslovi: KYC odobren, depozit pokriven, bez aktivnih strajkova, najmanje N
-- završenih poslova i ocjena iznad praga. Računa se, ne dodjeljuje ručno.
create table if not exists public.trust_badge_rules (
  id              boolean primary key default true check (id),
  min_completed   smallint not null default 3,
  min_avg_rating  numeric(3,2) not null default 4.30,
  updated_at      timestamptz not null default now()
);
insert into public.trust_badge_rules (id) values (true) on conflict do nothing;

create or replace function public.recompute_trust_badge(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $fn$
declare v_ok boolean; v_rule public.trust_badge_rules;
begin
  select * into v_rule from public.trust_badge_rules where id;
  select public.is_kyc_verified(p_user)
     and public.has_deposit(p_user)
     and public.active_strike_count(p_user) = 0
     and (select count(*) from public.listings l
           where l.status = 'completed'
             and exists (select 1 from public.job_payments jp
                          where jp.listing_id = l.id and jp.provider_id = p_user and jp.status = 'released')
         ) >= v_rule.min_completed
     and coalesce((select avg(rating) from public.reviews where reviewee_id = p_user), 0) >= v_rule.min_avg_rating
    into v_ok;

  update public.profiles
     set trust_badge_at = case when v_ok then coalesce(trust_badge_at, now()) else null end,
         updated_at = now()
   where user_id = p_user;
  return v_ok;
end $fn$;

-- ----------------------------------------------------------------- 5.6 RLS
alter table public.termination_reasons    enable row level security;
alter table public.contract_terminations  enable row level security;
alter table public.strikes                enable row level security;
alter table public.trust_badge_rules      enable row level security;

drop policy if exists reasons_read on public.termination_reasons;
create policy reasons_read on public.termination_reasons for select to authenticated using (is_active);

drop policy if exists terminations_party_read on public.contract_terminations;
create policy terminations_party_read on public.contract_terminations for select to authenticated
  using (reporter_id = auth.uid() or accused_id = auth.uid() or public.has_permission('strike.review'));

drop policy if exists terminations_report on public.contract_terminations;
create policy terminations_report on public.contract_terminations for insert to authenticated
  with check (reporter_id = auth.uid());
-- bez UPDATE politike: odluka ide isključivo kroz review_termination()

-- Strajkovi su javni po dizajnu (drugi klijenti moraju vidjeti upozorenje),
-- ali samo brojka i razlog — ne i dokazi ni prepiska.
drop policy if exists strikes_read on public.strikes;
create policy strikes_read on public.strikes for select to authenticated
  using (user_id = auth.uid() or public.has_permission('strike.review'));

create or replace view public.public_trust_signals
with (security_invoker = true) as
  select p.user_id,
         p.trust_badge_at is not null as has_trust_badge,
         p.public_warning_at is not null as has_contract_warning,
         p.strike_count >= 2 as warning_visible
  from public.profiles p;

grant select on public.public_trust_signals to authenticated, anon;

drop policy if exists badge_rules_read on public.trust_badge_rules;
create policy badge_rules_read on public.trust_badge_rules for select to authenticated using (true);
