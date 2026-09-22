-- ============================================================================
-- MODUL 1 — Nalozi i RBAC (Role-Based Access Control)
-- ----------------------------------------------------------------------------
-- Nadogradnja postojećeg sistema (roles / user_roles / is_admin() / is_staff()).
-- Postojeće uloge USER, PROVIDER, MODERATOR, ADMIN ostaju i mapiraju se ispod,
-- pa nijedna postojeća RLS politika ne puca.
--
-- Model: uloga -> permisije (a NE uloga -> if/else po kodu). Dodavanje operatera
-- ili nove permisije je INSERT, ne deploy.
-- ============================================================================

-- ---------------------------------------------------------------- 1.1 Domeni
do $$ begin
  create type actor_kind as enum ('user', 'staff');          -- vanjski vs interni
  create type party_kind as enum ('individual', 'business');  -- fizičko vs pravno lice
exception when duplicate_object then null; end $$;

-- Tip stranke: firma ili fizičko lice. Odvojeno od account_type
-- (client/provider/both), jer firma takođe može biti i klijent i izvođač.
alter table public.profiles
  add column if not exists party_kind party_kind not null default 'individual',
  add column if not exists legal_name text,          -- zvanični naziv iz registra
  add column if not exists company_reg_no text,      -- JIB / matični broj
  add column if not exists vat_no text;              -- PDV broj

comment on column public.profiles.party_kind is
  'individual = fizičko lice (depozit 2.000 KM), business = pravno lice (4.000 KM)';

-- ------------------------------------------------------- 1.2 Katalog permisija
-- Jedan izvor istine. Isti kod stringova koristi i NestJS guard (server/src/rbac).
create table if not exists public.permissions (
  code        text primary key,
  module      text not null,
  description text not null
);

insert into public.permissions (code, module, description) values
  -- KYC / verifikacija
  ('kyc.queue.read',        'kyc',      'Vidi red za verifikaciju identiteta'),
  ('kyc.case.claim',        'kyc',      'Preuzima predmet iz reda (lease)'),
  ('kyc.document.view',     'kyc',      'Otvara skenirani dokument (osjetljivo!)'),
  ('kyc.decision.approve',  'kyc',      'Odobrava identitet'),
  ('kyc.decision.reject',   'kyc',      'Odbija identitet'),
  ('kyc.decision.escalate', 'kyc',      'Šalje predmet Team Leadu'),
  -- Korisnici
  ('user.read',             'users',    'Vidi korisnički dosije'),
  ('user.pii.read',         'users',    'Vidi lične podatke (datum rođenja, adresa)'),
  ('user.suspend',          'users',    'Suspenduje nalog'),
  ('user.delete',           'users',    'Briše nalog'),
  -- Sporovi i finansije
  ('dispute.read',          'finance',  'Vidi sporove'),
  ('dispute.resolve',       'finance',  'Rješava spor bez povrata novca'),
  ('refund.authorize',      'finance',  'Odobrava povrat nakon isplate (samo Team Lead)'),
  ('payout.release',        'finance',  'Ručno oslobađa escrow'),
  ('deposit.waive',         'finance',  'Umanjuje ili oprašta depozit'),
  ('finance.fees.read',     'finance',  'Vidi proviziju i naknade platforme'),
  -- Trust & safety
  ('strike.review',         'trust',    'Potvrđuje ili odbacuje prijavljeni strajk'),
  ('strike.revoke',         'trust',    'Poništava strajk'),
  ('moderation.review',     'trust',    'Pregleda AI-flagovan sadržaj'),
  -- Interno
  ('hr.staff.read',         'hr',       'Vidi listu zaposlenih i uloge'),
  ('hr.staff.manage',       'hr',       'Zapošljava, mijenja ulogu, deaktivira'),
  ('it.system.read',        'it',       'Vidi logove, greške, health'),
  ('it.system.manage',      'it',       'Mijenja sistemske postavke, feature flagove'),
  ('audit.read',            'it',       'Čita audit trag')
on conflict (code) do update set module = excluded.module, description = excluded.description;

-- --------------------------------------------------------- 1.3 Uloge i mapiranje
alter table public.roles
  add column if not exists actor_kind actor_kind not null default 'user',
  add column if not exists is_internal boolean not null default false;

insert into public.roles (name, description, actor_kind, is_internal) values
  ('SUPPORT',   'Customer Support operater (7 mjesta)', 'staff', true),
  ('TEAM_LEAD', 'Vođa tima — eskalacije, povrati, poništenje strajkova', 'staff', true),
  ('HR',        'Ljudski resursi — upravlja internim nalozima', 'staff', true),
  ('IT',        'IT programer — sistem, logovi, konfiguracija', 'staff', true)
on conflict (name) do update set description = excluded.description,
  actor_kind = excluded.actor_kind, is_internal = excluded.is_internal;

update public.roles set actor_kind = 'staff', is_internal = true where name in ('ADMIN', 'MODERATOR');

create table if not exists public.role_permissions (
  role_id         uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

-- Ko šta smije. Namjerno restriktivno: Support NE smije odobriti povrat novca
-- niti vidjeti proviziju; HR ne vidi KYC dokumente; IT ne dira novac.
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on true
where (r.name, p.code) in (
  ('SUPPORT','kyc.queue.read'), ('SUPPORT','kyc.case.claim'), ('SUPPORT','kyc.document.view'),
  ('SUPPORT','kyc.decision.approve'), ('SUPPORT','kyc.decision.reject'), ('SUPPORT','kyc.decision.escalate'),
  ('SUPPORT','user.read'), ('SUPPORT','dispute.read'), ('SUPPORT','strike.review'), ('SUPPORT','moderation.review'),

  ('TEAM_LEAD','kyc.queue.read'), ('TEAM_LEAD','kyc.case.claim'), ('TEAM_LEAD','kyc.document.view'),
  ('TEAM_LEAD','kyc.decision.approve'), ('TEAM_LEAD','kyc.decision.reject'), ('TEAM_LEAD','kyc.decision.escalate'),
  ('TEAM_LEAD','user.read'), ('TEAM_LEAD','user.pii.read'), ('TEAM_LEAD','user.suspend'),
  ('TEAM_LEAD','dispute.read'), ('TEAM_LEAD','dispute.resolve'), ('TEAM_LEAD','refund.authorize'),
  ('TEAM_LEAD','payout.release'), ('TEAM_LEAD','deposit.waive'), ('TEAM_LEAD','finance.fees.read'),
  ('TEAM_LEAD','strike.review'), ('TEAM_LEAD','strike.revoke'), ('TEAM_LEAD','moderation.review'),
  ('TEAM_LEAD','audit.read'),

  ('HR','hr.staff.read'), ('HR','hr.staff.manage'), ('HR','user.read'),

  ('IT','it.system.read'), ('IT','it.system.manage'), ('IT','audit.read'), ('IT','user.read')
)
on conflict do nothing;

-- ADMIN dobija sve, uvijek (i buduće permisije — vidi trigger niže).
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r cross join public.permissions p where r.name = 'ADMIN'
on conflict do nothing;

create or replace function public.sync_admin_permissions() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.role_permissions (role_id, permission_code)
  select r.id, new.code from public.roles r where r.name = 'ADMIN'
  on conflict do nothing;
  return new;
end $fn$;

drop trigger if exists permissions_grant_admin on public.permissions;
create trigger permissions_grant_admin after insert on public.permissions
  for each row execute function public.sync_admin_permissions();

-- ------------------------------------------------- 1.4 Interni nalozi (zaposleni)
-- Odvojeno od profiles: zaposleni ima radni identitet (broj, tim, status), i
-- gasi se jednim UPDATE-om kad ode iz firme — bez brisanja historije njegovih odluka.
create table if not exists public.staff_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  staff_no     text unique not null,
  display_name text not null,
  team         text,                                   -- npr. 'support-shift-a'
  manager_id   uuid references auth.users(id),
  hired_at     date not null default current_date,
  left_at      date,
  is_active    boolean not null generated always as (left_at is null) stored,
  created_at   timestamptz not null default now()
);

create index if not exists staff_members_active_idx on public.staff_members (is_active) where is_active;

-- ---------------------------------------------------------- 1.5 Helper funkcije
-- Sve su STABLE + SECURITY DEFINER da ih RLS može zvati bez rekurzije.

create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(distinct rp.permission_code), '{}')
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.staff_members sm on sm.user_id = ur.user_id and sm.is_active
  where ur.user_id = auth.uid();
$fn$;

create or replace function public.has_permission(p_code text) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    left join public.staff_members sm on sm.user_id = ur.user_id
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and rp.permission_code = p_code
      -- interna uloga vrijedi samo dok je zaposleni aktivan
      and (not r.is_internal or coalesce(sm.is_active, false))
  );
$fn$;

create or replace function public.is_internal() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.staff_members sm on sm.user_id = ur.user_id and sm.is_active
    where ur.user_id = auth.uid() and r.is_internal
  );
$fn$;

comment on function public.has_permission(text) is
  'Jedina provjera ovlaštenja u RLS politikama. Nikad ne provjeravaj ime uloge direktno.';

-- ------------------------------------------------------------- 1.6 Audit trag
-- Svaki dodir osjetljivog podatka ostavlja trag. Append-only: bez UPDATE/DELETE.
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id),
  permission  text,
  action      text not null,
  subject_type text not null,
  subject_id  uuid,
  ip          inet,
  user_agent  text,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_subject_idx on public.audit_log (subject_type, subject_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create or replace function public.audit(
  p_action text, p_subject_type text, p_subject_id uuid,
  p_permission text default null, p_details jsonb default '{}'
) returns void
language sql security definer set search_path = public as $fn$
  insert into public.audit_log (actor_id, permission, action, subject_type, subject_id, details)
  values (auth.uid(), p_permission, p_action, p_subject_type, p_subject_id, p_details);
$fn$;

-- ----------------------------------------------------------------- 1.7 RLS
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_members    enable row level security;
alter table public.audit_log        enable row level security;

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (public.is_internal());

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.is_internal());

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.has_permission('hr.staff.manage')) with check (public.has_permission('hr.staff.manage'));

drop policy if exists staff_self_read on public.staff_members;
create policy staff_self_read on public.staff_members for select to authenticated
  using (user_id = auth.uid() or public.has_permission('hr.staff.read'));

drop policy if exists staff_hr_write on public.staff_members;
create policy staff_hr_write on public.staff_members for all to authenticated
  using (public.has_permission('hr.staff.manage')) with check (public.has_permission('hr.staff.manage'));

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.has_permission('audit.read'));
-- namjerno: nema INSERT/UPDATE/DELETE politike — piše se isključivo kroz public.audit()

revoke update, delete on public.audit_log from authenticated, anon;
