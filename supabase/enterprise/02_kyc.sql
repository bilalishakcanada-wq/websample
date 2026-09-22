-- ============================================================================
-- MODUL 2 — KYC i verifikacija identiteta
-- ----------------------------------------------------------------------------
-- Tok: korisnik pošalje dokument -> automatske provjere (OCR, liveness, ime na
-- računu, AI-detekcija slike) -> SVE ide u ručni red -> Support donosi odluku.
-- Automatika nikad sama ne odobrava; ona samo priprema dokaze i rangira predmet.
--
-- Podaci su osjetljivi (lični dokumenti, biometrija). Zato:
--   * u bazi stoji SAMO putanja ka enkriptovanom objektu, nikad sama slika,
--   * pristup dokumentu ide kroz funkciju koja obavezno upisuje audit trag,
--   * postoji rok čuvanja i posao koji briše istekle dokumente.
-- ============================================================================

do $$ begin
  create type kyc_state as enum (
    'draft', 'submitted', 'auto_checking', 'awaiting_review',
    'in_review', 'escalated', 'approved', 'rejected', 'expired'
  );
  create type kyc_doc_kind   as enum ('id_card', 'passport', 'drivers_licence', 'company_extract');
  create type check_outcome  as enum ('pass', 'warn', 'fail', 'error');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- 2.1 KYC predmet
create table if not exists public.kyc_cases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  party_kind    party_kind not null,
  state         kyc_state not null default 'draft',
  risk_score    smallint not null default 0 check (risk_score between 0 and 100),
  priority      smallint not null default 0,    -- veći broj = ranije u redu
  -- lease: koji operater trenutno drži predmet (7 operatera, nula kolizija)
  claimed_by    uuid references auth.users(id),
  claimed_until timestamptz,
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  reject_reason text,
  escalated_to  uuid references auth.users(id),
  submitted_at  timestamptz,
  expires_at    timestamptz,                    -- odobrenje vrijedi ograničeno
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- jedan otvoren predmet po korisniku
create unique index if not exists kyc_cases_one_open_idx on public.kyc_cases (user_id)
  where state not in ('approved', 'rejected', 'expired');
create index if not exists kyc_cases_queue_idx on public.kyc_cases (state, priority desc, submitted_at)
  where state in ('awaiting_review', 'escalated');

-- ------------------------------------------------------------- 2.2 Dokumenti
create table if not exists public.kyc_documents (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.kyc_cases(id) on delete cascade,
  kind          kyc_doc_kind not null,
  storage_path  text not null,                  -- privatni bucket 'kyc' (nije javan)
  sha256        text not null,                  -- otkriva ponovno slanje istog fajla
  mime_type     text not null,
  byte_size     integer not null,
  -- OCR rezultat; čuva se da operater ne mora prepisivati ručno
  mrz_name      text,
  mrz_number    text,
  mrz_expiry    date,
  ocr_confidence numeric(4,3),
  uploaded_at   timestamptz not null default now(),
  purge_after   timestamptz not null default (now() + interval '5 years')
);

create index if not exists kyc_documents_case_idx on public.kyc_documents (case_id);
create index if not exists kyc_documents_sha_idx  on public.kyc_documents (sha256);

-- --------------------------------------------------- 2.3 Automatske provjere
-- Jedna tabela za sve provjere: liveness, poklapanje imena, AI-detekcija slike,
-- provjera isteka dokumenta, sankcione liste. Dodavanje nove provjere = nova vrsta.
create table if not exists public.kyc_checks (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.kyc_cases(id) on delete cascade,
  kind       text not null,          -- 'liveness' | 'face_match' | 'name_match' | 'doc_authenticity' | 'sanctions'
  provider   text not null,          -- ime vanjskog servisa, radi sljedivosti
  outcome    check_outcome not null,
  score      numeric(5,4),           -- 0..1, kako ga vrati provajder
  threshold  numeric(5,4),           -- prag koji je vrijedio u trenutku provjere
  evidence   jsonb not null default '{}',
  ran_at     timestamptz not null default now()
);

create index if not exists kyc_checks_case_idx on public.kyc_checks (case_id, kind);

-- ----------------------------------------- 2.4 Poklapanje imena sa bankom/karticom
-- Zahtjev: ime na kartici/računu mora se 100% poklapati sa imenom na profilu.
-- "100%" se mjeri nad normalizovanim imenom (bez dijakritike, reda riječi i titula),
-- inače bi "Bilal Išak" i "ISAK BILAL" bili tretirani kao različite osobe.
-- Koristi postojeći public.fold_text() (isti onaj kojim radi pretraga), pa se
-- transliteracija naših slova drži na jednom mjestu u cijeloj bazi.
create or replace function public.normalize_person_name(p text) returns text
language sql immutable as $fn$
  select coalesce(array_to_string(
    (select array_agg(w order by w)
     from unnest(string_to_array(
       trim(regexp_replace(public.fold_text(coalesce(p, '')), '[^a-z0-9 ]', ' ', 'g')),
       ' ')) as w
     where w <> ''), ' '), '');
$fn$;

comment on function public.normalize_person_name(text) is
  'Poredi imena bez obzira na dijakritiku, velika slova, zareze i redoslijed riječi: '
  '"Išak, Bilal" = "BILAL ISAK". Prazan ulaz daje prazan string (nikad NULL), da '
  '"nepoznato ime" slučajno ne ispadne poklapanje.';

create table if not exists public.bank_name_matches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  case_id        uuid references public.kyc_cases(id) on delete set null,
  instrument     text not null,                  -- 'card' | 'iban'
  instrument_ref text not null,                  -- token/maska, NIKAD pun broj
  holder_name    text not null,                  -- kako ga je vratila banka/PSP
  profile_name   text not null,
  is_exact       boolean not null generated always as
                   (public.normalize_person_name(holder_name) = public.normalize_person_name(profile_name)) stored,
  checked_at     timestamptz not null default now()
);

create index if not exists bank_name_matches_user_idx on public.bank_name_matches (user_id, checked_at desc);

-- ----------------------------------------------- 2.5 AI-detekcija generisanih slika
-- Radi na profilnoj slici i portfoliju. Nadograđuje postojeći moderation_queue.
alter table public.moderation_queue
  add column if not exists ai_generated_score numeric(5,4),
  add column if not exists ai_verdict check_outcome,
  add column if not exists detector text,
  add column if not exists c2pa jsonb;           -- C2PA/Content Credentials ako postoje

comment on column public.moderation_queue.ai_generated_score is
  'Vjerovatnoća da je slika AI-generisana (0..1). Detektori nisu pouzdani 100%: '
  'iznad gornjeg praga -> odbij, između pragova -> ručni pregled, ispod -> propusti.';

create table if not exists public.moderation_thresholds (
  kind        text primary key,       -- 'avatar' | 'portfolio' | 'listing_image'
  auto_reject numeric(5,4) not null,
  review_from numeric(5,4) not null,
  updated_at  timestamptz not null default now()
);

insert into public.moderation_thresholds (kind, auto_reject, review_from) values
  ('avatar',        0.95, 0.60),
  ('portfolio',     0.97, 0.65),
  ('listing_image', 0.97, 0.70)
on conflict (kind) do nothing;

-- ------------------------------------------------------- 2.6 Stanje na profilu
alter table public.profiles
  add column if not exists kyc_state kyc_state not null default 'draft',
  add column if not exists kyc_approved_at timestamptz,
  add column if not exists liveness_passed_at timestamptz;

-- Profil je aktivan tek kad je KYC odobren. Ovo je jedina tačka istine;
-- i frontend i RLS je čitaju.
create or replace function public.is_kyc_verified(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.profiles
    where user_id = p_user and kyc_state = 'approved'
      and (kyc_approved_at is not null)
  );
$fn$;

create or replace function public.sync_profile_kyc() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.state is distinct from old.state then
    update public.profiles
       set kyc_state = new.state,
           kyc_approved_at = case when new.state = 'approved' then coalesce(new.decided_at, now())
                                  when new.state in ('rejected', 'expired') then null
                                  else kyc_approved_at end,
           updated_at = now()
     where user_id = new.user_id;
  end if;
  new.updated_at := now();
  return new;
end $fn$;

drop trigger if exists kyc_cases_sync_profile on public.kyc_cases;
create trigger kyc_cases_sync_profile before update on public.kyc_cases
  for each row execute function public.sync_profile_kyc();

-- ------------------------------------------------------- 2.7 Red za verifikaciju
-- Operater ne bira predmet ručno — sistem mu dodijeli sljedeći i zaključa ga na
-- 15 minuta. Zaključavanje ističe samo od sebe ako operater zatvori prozor.
create or replace function public.kyc_claim_next(p_minutes int default 15)
returns public.kyc_cases
language plpgsql security definer set search_path = public as $fn$
declare v_case public.kyc_cases;
begin
  if not public.has_permission('kyc.case.claim') then
    raise exception 'FORBIDDEN: nedostaje kyc.case.claim' using errcode = '42501';
  end if;

  update public.kyc_cases c
     set claimed_by = auth.uid(), claimed_until = now() + make_interval(mins => p_minutes),
         state = 'in_review'
   where c.id = (
     select id from public.kyc_cases
      where state in ('awaiting_review', 'escalated')
        and (claimed_until is null or claimed_until < now())
      order by priority desc, submitted_at
      for update skip locked
      limit 1
   )
  returning * into v_case;

  if v_case.id is not null then
    perform public.audit('kyc.claim', 'kyc_case', v_case.id, 'kyc.case.claim', '{}'::jsonb);
  end if;
  return v_case;
end $fn$;

-- Odluka. Odobrenje traži da su i liveness i poklapanje imena prošli —
-- operater ne može "preskočiti" tehničke provjere.
create or replace function public.kyc_decide(p_case uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_case public.kyc_cases; v_liveness boolean; v_name boolean;
begin
  select * into v_case from public.kyc_cases where id = p_case for update;
  if v_case.id is null then raise exception 'NOT_FOUND'; end if;

  if p_approve and not public.has_permission('kyc.decision.approve') then
    raise exception 'FORBIDDEN: nedostaje kyc.decision.approve' using errcode = '42501';
  end if;
  if not p_approve and not public.has_permission('kyc.decision.reject') then
    raise exception 'FORBIDDEN: nedostaje kyc.decision.reject' using errcode = '42501';
  end if;
  if v_case.claimed_by is distinct from auth.uid() then
    raise exception 'PREDMET_NIJE_TVOJ: prvo ga preuzmi' using errcode = '42501';
  end if;

  if p_approve then
    select exists (select 1 from public.kyc_checks where case_id = p_case and kind = 'liveness' and outcome = 'pass')
      into v_liveness;
    select exists (select 1 from public.bank_name_matches where case_id = p_case and is_exact)
      into v_name;
    if not v_liveness then raise exception 'LIVENESS_NIJE_PROSAO'; end if;
    if not v_name     then raise exception 'IME_SE_NE_POKLAPA_SA_RACUNOM'; end if;
  elsif coalesce(trim(p_reason), '') = '' then
    raise exception 'RAZLOG_ODBIJANJA_JE_OBAVEZAN';
  end if;

  update public.kyc_cases
     set state = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), reject_reason = p_reason,
         claimed_by = null, claimed_until = null,
         expires_at = case when p_approve then now() + interval '3 years' else null end
   where id = p_case;

  perform public.audit(
    case when p_approve then 'kyc.approve' else 'kyc.reject' end,
    'kyc_case', p_case,
    case when p_approve then 'kyc.decision.approve' else 'kyc.decision.reject' end,
    jsonb_build_object('reason', p_reason));
end $fn$;

-- Otvaranje dokumenta uvijek ostavlja trag (ko, kada, koji predmet).
create or replace function public.kyc_document_open(p_doc uuid)
returns text
language plpgsql security definer set search_path = public as $fn$
declare v_path text; v_case uuid;
begin
  if not public.has_permission('kyc.document.view') then
    raise exception 'FORBIDDEN: nedostaje kyc.document.view' using errcode = '42501';
  end if;
  select storage_path, case_id into v_path, v_case from public.kyc_documents where id = p_doc;
  if v_path is null then raise exception 'NOT_FOUND'; end if;
  perform public.audit('kyc.document.open', 'kyc_document', p_doc, 'kyc.document.view',
                       jsonb_build_object('case_id', v_case));
  return v_path;
end $fn$;

-- ----------------------------------------------------------------- 2.8 RLS
alter table public.kyc_cases          enable row level security;
alter table public.kyc_documents      enable row level security;
alter table public.kyc_checks         enable row level security;
alter table public.bank_name_matches  enable row level security;

drop policy if exists kyc_cases_own on public.kyc_cases;
create policy kyc_cases_own on public.kyc_cases for select to authenticated
  using (user_id = auth.uid() or public.has_permission('kyc.queue.read'));

drop policy if exists kyc_cases_submit on public.kyc_cases;
create policy kyc_cases_submit on public.kyc_cases for insert to authenticated
  with check (user_id = auth.uid());

-- Korisnik smije mijenjati svoj predmet samo dok je 'draft'; odluke ide isključivo
-- kroz kyc_decide(), nikad direktnim UPDATE-om.
drop policy if exists kyc_cases_draft_edit on public.kyc_cases;
create policy kyc_cases_draft_edit on public.kyc_cases for update to authenticated
  using (user_id = auth.uid() and state = 'draft')
  with check (user_id = auth.uid() and state in ('draft', 'submitted'));

drop policy if exists kyc_documents_own on public.kyc_documents;
create policy kyc_documents_own on public.kyc_documents for select to authenticated
  using (exists (select 1 from public.kyc_cases c where c.id = case_id and c.user_id = auth.uid()));
-- osoblje NE dobija SELECT politiku: dokument se otvara samo kroz kyc_document_open()

drop policy if exists kyc_documents_upload on public.kyc_documents;
create policy kyc_documents_upload on public.kyc_documents for insert to authenticated
  with check (exists (select 1 from public.kyc_cases c
                      where c.id = case_id and c.user_id = auth.uid() and c.state in ('draft', 'submitted')));

drop policy if exists kyc_checks_read on public.kyc_checks;
create policy kyc_checks_read on public.kyc_checks for select to authenticated
  using (public.has_permission('kyc.queue.read')
         or exists (select 1 from public.kyc_cases c where c.id = case_id and c.user_id = auth.uid()));

drop policy if exists bank_matches_read on public.bank_name_matches;
create policy bank_matches_read on public.bank_name_matches for select to authenticated
  using (user_id = auth.uid() or public.has_permission('kyc.queue.read'));

-- --------------------------------------------------------- 2.9 Rok čuvanja
-- Dokumenti se ne čuvaju vječno. Posao briše zapis; brisanje samog objekta iz
-- Storage-a radi Edge funkcija koja čita ovaj red prije brisanja.
create table if not exists public.kyc_purge_queue (
  storage_path text primary key,
  queued_at    timestamptz not null default now(),
  purged_at    timestamptz
);

create or replace function public.kyc_purge_expired() returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_count integer;
begin
  with gone as (
    delete from public.kyc_documents where purge_after < now() returning storage_path
  )
  insert into public.kyc_purge_queue (storage_path) select storage_path from gone
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;
