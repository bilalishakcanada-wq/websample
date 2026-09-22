-- ============================================================================
-- BOOKING ENGINE 01 — ugovor kao state machine
-- ----------------------------------------------------------------------------
-- Poso.ba VEĆ ima escrow: accept_offer_and_fund skine novac klijentu i drži ga
-- na platformi, release/cancel ga puštaju. Ovaj fajl NE pravi escrow ponovo —
-- dodaje ono što nedostaje da bi escrow bio pošten prema obje strane:
--
--   nedostajalo                           posljedica dok nema
--   ─────────────────────────────────────────────────────────────────────────
--   1. stanje ugovora (rad u toku…)       posao je bio ili "plaćen" ili "gotov"
--   2. dokaz o radu                        izvođač tvrdi da je završio, bez dokaza
--   3. rok od 72 h                         klijent nestane, novac zaglavi
--   4. sporazumni prekid                   BILO KOJA strana je mogla jednostrano
--                                          otkazati i vratiti novac klijentu
--   5. zaštita statusa posla               vlasnik je mogao mijenjati listings.status
--                                          direktno kroz API
--
--  Tačka 4 je bila prava rupa: cancel_job_payment je dozvoljavao i klijentu i
--  izvođaču da sami otkažu dok je novac u escrowu. Izvođač odradi posao, klijent
--  klikne "Otkaži", novac se vrati klijentu. Od sada to traži pristanak druge
--  strane ili odluku podrške.
-- ============================================================================

do $$ begin
  create type work_state as enum (
    'in_progress',      -- novac osiguran, rad traje
    'submitted',        -- izvođač predao rad sa dokazima; teče 72 h
    'revision',         -- klijent traži ispravku; novac ostaje zaključan
    'cancel_requested', -- jedna strana traži prekid, čeka se druga
    'disputed',         -- spor: sve zamrznuto, odlučuje podrška
    'completed',        -- odobreno (ručno ili automatski) → novac izvođaču
    'cancelled'         -- sporazumno ili odlukom podrške → novac klijentu
  );
exception when duplicate_object then null; end $$;

alter table public.job_payments
  add column if not exists work_state work_state not null default 'in_progress',
  add column if not exists submitted_at timestamptz,
  add column if not exists review_deadline timestamptz,   -- submitted_at + 72 h
  add column if not exists revision_count smallint not null default 0,
  add column if not exists auto_released boolean not null default false;

create index if not exists job_payments_deadline_idx on public.job_payments (review_deadline)
  where work_state = 'submitted';

-- ---------------------------------------------------- 1.1 Matrica prelaza
-- Dozvoljeni prelazi su PODACI, ne if-ovi razbacani po kodu. Novo pravilo je
-- jedan INSERT, i uvijek se vidi cijela istina o tome ko šta smije.
create table if not exists public.work_transitions (
  from_state work_state not null,
  to_state   work_state not null,
  actor      text not null check (actor in ('client', 'provider', 'either', 'support', 'system')),
  note       text not null,
  primary key (from_state, to_state, actor)
);

insert into public.work_transitions (from_state, to_state, actor, note) values
  ('in_progress',      'submitted',        'provider', 'Izvođač predaje rad (obavezan dokaz)'),
  ('in_progress',      'cancel_requested', 'either',   'Traži se sporazumni prekid'),
  ('in_progress',      'disputed',         'either',   'Otvara se spor'),
  ('submitted',        'completed',        'client',   'Klijent odobrava rad'),
  ('submitted',        'completed',        'system',   'Automatsko odobrenje nakon 72 h'),
  ('submitted',        'revision',         'client',   'Klijent traži ispravku'),
  ('submitted',        'disputed',         'either',   'Otvara se spor'),
  ('submitted',        'cancel_requested', 'either',   'Sporazumni prekid i nakon predaje rada (traži pristanak druge strane)'),
  ('revision',         'submitted',        'provider', 'Izvođač predaje ispravljen rad'),
  ('revision',         'disputed',         'either',   'Otvara se spor'),
  ('revision',         'cancel_requested', 'either',   'Traži se sporazumni prekid'),
  ('cancel_requested', 'cancelled',        'either',   'Druga strana pristaje na prekid'),
  ('cancel_requested', 'in_progress',      'either',   'Druga strana odbija prekid, rad se nastavlja'),
  ('cancel_requested', 'submitted',        'either',   'Odbijen prekid: rad je već bio predat, vraća se na pregled'),
  ('cancel_requested', 'revision',         'either',   'Odbijen prekid: vraća se u ispravku'),
  ('cancel_requested', 'disputed',         'either',   'Nema dogovora → spor'),
  ('disputed',         'completed',        'support',  'Podrška presudila u korist izvođača'),
  ('disputed',         'cancelled',        'support',  'Podrška presudila u korist klijenta')
on conflict do nothing;

-- ------------------------------------------------------ 1.2 Dnevnik ugovora
-- Append-only: svaka promjena stanja ostavlja trag. Ovo je ono što podrška čita
-- kad presuđuje, zajedno sa chatom.
create table if not exists public.job_events (
  id         bigserial primary key,
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  from_state work_state,
  to_state   work_state not null,
  actor_id   uuid references auth.users(id),
  actor_role text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists job_events_payment_idx on public.job_events (payment_id, created_at);

alter table public.job_events enable row level security;
drop policy if exists job_events_party on public.job_events;
create policy job_events_party on public.job_events for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

-- ---------------------------------------------------- 1.3 Dokaz o radu
create table if not exists public.work_submissions (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.job_payments(id) on delete cascade,
  provider_id  uuid not null references auth.users(id),
  revision_no  smallint not null default 0,
  report       text not null,
  evidence_urls text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  constraint submission_has_proof check (
    length(btrim(report)) >= 20 or array_length(evidence_urls, 1) >= 1
  )
);

create index if not exists work_submissions_payment_idx on public.work_submissions (payment_id, revision_no desc);

alter table public.work_submissions enable row level security;
drop policy if exists submissions_party on public.work_submissions;
create policy submissions_party on public.work_submissions for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

-- ------------------------------------------------ 1.4 Zahtjev za prekid
create table if not exists public.cancellation_requests (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.job_payments(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  prev_state   work_state,           -- stanje prije zahtjeva; odbijanje vraća TAČNO tu
  restore_deadline timestamptz,      -- i rok od 72 h, da se stalnim zahtjevima ne kupuje vrijeme
  reason_code  text not null,
  detail       text,
  state        text not null default 'pending' check (state in ('pending','accepted','declined','withdrawn')),
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists cancellation_one_open_idx on public.cancellation_requests (payment_id)
  where state = 'pending';

alter table public.cancellation_requests enable row level security;
drop policy if exists cancel_req_party on public.cancellation_requests;
create policy cancel_req_party on public.cancellation_requests for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

-- --------------------------------------------------------- 1.5 Sporovi
create table if not exists public.disputes (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.job_payments(id) on delete cascade,
  opened_by    uuid not null references auth.users(id),
  opened_role  text not null check (opened_role in ('client','provider')),
  reason_code  text not null,
  claim        text not null,
  evidence_urls text[] not null default '{}',
  state        text not null default 'open' check (state in ('open','reviewing','resolved')),
  assigned_to  uuid references auth.users(id),
  verdict      text,
  verdict_note text,
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists disputes_one_open_idx on public.disputes (payment_id) where state <> 'resolved';

alter table public.disputes enable row level security;
drop policy if exists disputes_party on public.disputes;
create policy disputes_party on public.disputes for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

-- ==========================================================================
-- 1.6 JEDINA vrata za promjenu stanja
-- ==========================================================================
-- Sve ide kroz ovu funkciju: ona zaključa red, provjeri je li prelaz uopšte
-- dozvoljen i je li ga smije napraviti baš ovaj korisnik, pa upiše dnevnik.
-- Nijedna druga funkcija ne dira work_state direktno.
create or replace function public.job_transition(
  p_payment uuid, p_to work_state, p_detail jsonb default '{}'
) returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_role text; v_allowed boolean; v_from work_state;
begin
  select * into v_row from public.job_payments where id = p_payment for update;   -- lock (v. security/01)
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;

  v_role := case
    when auth.uid() = v_row.client_id then 'client'
    when auth.uid() = v_row.provider_id then 'provider'
    when public.is_staff() then 'support'
    else null end;
  if v_role is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select exists (
    select 1 from public.work_transitions t
     where t.from_state = v_row.work_state and t.to_state = p_to
       and (t.actor = v_role or (t.actor = 'either' and v_role in ('client','provider')))
  ) into v_allowed;

  if not v_allowed then
    raise exception 'NEDOZVOLJEN_PRELAZ: % → % za ulogu %', v_row.work_state, p_to, v_role
      using errcode = 'P0001';
  end if;

  -- staro stanje se pamti PRIJE UPDATE-a: `returning * into v_row` bi ga prepisalo
  -- novim, pa bi dnevnik bilježio "submitted → submitted" i bio bezvrijedan u sporu
  v_from := v_row.work_state;
  update public.job_payments set work_state = p_to where id = p_payment returning * into v_row;
  insert into public.job_events (payment_id, from_state, to_state, actor_id, actor_role, detail)
  values (p_payment, v_from, p_to, auth.uid(), v_role, p_detail);
  return v_row;
end $fn$;

-- Sistemski prelaz (samo za cron; ne prolazi kroz auth.uid())
create or replace function public.job_transition_system(p_payment uuid, p_to work_state, p_detail jsonb default '{}')
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_from work_state;
begin
  select work_state into v_from from public.job_payments where id = p_payment for update;
  if not exists (select 1 from public.work_transitions
                 where from_state = v_from and to_state = p_to and actor = 'system') then
    raise exception 'NEDOZVOLJEN_SISTEMSKI_PRELAZ: % → %', v_from, p_to;
  end if;
  update public.job_payments set work_state = p_to where id = p_payment;
  insert into public.job_events (payment_id, from_state, to_state, actor_role, detail)
  values (p_payment, v_from, p_to, 'system', p_detail);
end $fn$;

revoke execute on function public.job_transition_system(uuid, work_state, jsonb) from anon, authenticated;
