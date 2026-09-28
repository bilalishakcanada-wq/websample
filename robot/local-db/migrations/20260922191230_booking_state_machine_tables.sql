do $$ begin
  create type work_state as enum (
    'in_progress','submitted','revision','cancel_requested','disputed','completed','cancelled'
  );
exception when duplicate_object then null; end $$;

alter table public.job_payments
  add column if not exists work_state work_state not null default 'in_progress',
  add column if not exists submitted_at timestamptz,
  add column if not exists review_deadline timestamptz,
  add column if not exists revision_count smallint not null default 0,
  add column if not exists auto_released boolean not null default false;

create index if not exists job_payments_deadline_idx on public.job_payments (review_deadline)
  where work_state = 'submitted';

-- postojeci ugovori dobijaju stanje koje odgovara njihovom statusu novca
update public.job_payments set work_state = 'completed' where status = 'released' and work_state = 'in_progress';
update public.job_payments set work_state = 'cancelled' where status = 'refunded' and work_state = 'in_progress';

create table if not exists public.work_transitions (
  from_state work_state not null,
  to_state   work_state not null,
  actor      text not null check (actor in ('client','provider','either','support','system')),
  note       text not null,
  primary key (from_state, to_state, actor)
);

insert into public.work_transitions (from_state, to_state, actor, note) values
  ('in_progress',      'submitted',        'provider', 'Izvodjac predaje rad (obavezan dokaz)'),
  ('in_progress',      'cancel_requested', 'either',   'Trazi se sporazumni prekid'),
  ('in_progress',      'disputed',         'either',   'Otvara se spor'),
  ('submitted',        'completed',        'client',   'Klijent odobrava rad'),
  ('submitted',        'completed',        'system',   'Automatsko odobrenje nakon 72 h'),
  ('submitted',        'revision',         'client',   'Klijent trazi ispravku'),
  ('submitted',        'disputed',         'either',   'Otvara se spor'),
  ('submitted',        'cancel_requested', 'either',   'Sporazumni prekid i nakon predaje rada'),
  ('revision',         'submitted',        'provider', 'Izvodjac predaje ispravljen rad'),
  ('revision',         'disputed',         'either',   'Otvara se spor'),
  ('revision',         'cancel_requested', 'either',   'Trazi se sporazumni prekid'),
  ('cancel_requested', 'cancelled',        'either',   'Druga strana pristaje na prekid'),
  ('cancel_requested', 'in_progress',      'either',   'Druga strana odbija prekid'),
  ('cancel_requested', 'submitted',        'either',   'Odbijen prekid: rad je bio predat, vraca se na pregled'),
  ('cancel_requested', 'revision',         'either',   'Odbijen prekid: vraca se u ispravku'),
  ('cancel_requested', 'disputed',         'either',   'Nema dogovora -> spor'),
  ('disputed',         'completed',        'support',  'Podrska presudila u korist izvodjaca'),
  ('disputed',         'cancelled',        'support',  'Podrska presudila u korist klijenta')
on conflict do nothing;

create table if not exists public.job_events (
  id bigserial primary key,
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  from_state work_state,
  to_state work_state not null,
  actor_id uuid references auth.users(id),
  actor_role text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists job_events_payment_idx on public.job_events (payment_id, created_at);
alter table public.job_events enable row level security;
drop policy if exists job_events_party on public.job_events;
create policy job_events_party on public.job_events for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

create table if not exists public.work_submissions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  provider_id uuid not null references auth.users(id),
  revision_no smallint not null default 0,
  report text not null,
  evidence_urls text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  constraint submission_has_proof check (length(btrim(report)) >= 20 or array_length(evidence_urls, 1) >= 1)
);
create index if not exists work_submissions_payment_idx on public.work_submissions (payment_id, revision_no desc);
alter table public.work_submissions enable row level security;
drop policy if exists submissions_party on public.work_submissions;
create policy submissions_party on public.work_submissions for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

create table if not exists public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  prev_state work_state,
  restore_deadline timestamptz,
  reason_code text not null,
  detail text,
  state text not null default 'pending' check (state in ('pending','accepted','declined','withdrawn')),
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists cancellation_one_open_idx on public.cancellation_requests (payment_id) where state = 'pending';
alter table public.cancellation_requests enable row level security;
drop policy if exists cancel_req_party on public.cancellation_requests;
create policy cancel_req_party on public.cancellation_requests for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  opened_by uuid not null references auth.users(id),
  opened_role text not null check (opened_role in ('client','provider')),
  reason_code text not null,
  claim text not null,
  evidence_urls text[] not null default '{}',
  state text not null default 'open' check (state in ('open','reviewing','resolved')),
  assigned_to uuid references auth.users(id),
  verdict text,
  verdict_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists disputes_one_open_idx on public.disputes (payment_id) where state <> 'resolved';
alter table public.disputes enable row level security;
drop policy if exists disputes_party on public.disputes;
create policy disputes_party on public.disputes for select to authenticated
  using (exists (select 1 from public.job_payments p
                 where p.id = payment_id and (p.client_id = auth.uid() or p.provider_id = auth.uid()))
         or public.is_staff());;
