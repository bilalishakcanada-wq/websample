-- ============================================================================
-- Rok čuvanja dokumenata.
--
-- Slika lične karte je najosjetljiviji podatak na platformi i nema razloga da
-- stoji zauvijek: kad je predmet riješen, dokaz o odluci ostaje (ko, kada, koji
-- broj), a sama slika se briše.
--
--   odobren predmet   -> slike se brišu nakon 90 dana
--   odbijen/istekao   -> nakon 30 dana
--
-- Sam JMBG (šifrovan) ostaje dok traje nalog — bez njega se ne može spriječiti
-- da se isti broj verifikuje na drugom nalogu.
-- ============================================================================
alter table public.identity_verifications
  add column if not exists docs_purge_after timestamptz,
  add column if not exists docs_purged_at timestamptz;

-- rok se postavlja u trenutku odluke
create or replace function public.set_docs_retention() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.state in ('approved','rejected','expired') and old.state not in ('approved','rejected','expired') then
    new.docs_purge_after := now() + case when new.state = 'approved'
                                         then interval '90 days' else interval '30 days' end;
  end if;
  return new;
end $fn$;

drop trigger if exists idv_set_retention on public.identity_verifications;
create trigger idv_set_retention before update on public.identity_verifications
  for each row execute function public.set_docs_retention();

-- red za brisanje iz Storage-a (samu datoteku briše Edge funkcija/cron)
create table if not exists public.identity_purge_queue (
  path       text primary key,
  case_id    uuid,
  queued_at  timestamptz not null default now(),
  purged_at  timestamptz
);
alter table public.identity_purge_queue enable row level security;
-- namjerno bez politika: red vidi samo service_role

create or replace function public.identity_purge_due() returns integer
language plpgsql security definer set search_path = public as $fn$
declare r record; v int := 0;
begin
  for r in
    select id, doc_front_path, doc_back_path, selfie_path
      from public.identity_verifications
     where docs_purge_after is not null and docs_purge_after < now()
       and docs_purged_at is null
     limit 200
  loop
    insert into public.identity_purge_queue (path, case_id)
    select p, r.id from unnest(array[r.doc_front_path, r.doc_back_path, r.selfie_path]) p
     where p is not null
    on conflict (path) do nothing;

    update public.identity_verifications
       set doc_front_path = null, doc_back_path = null, selfie_path = null,
           docs_purged_at = now(), updated_at = now()
     where id = r.id;
    v := v + 1;
  end loop;
  return v;
end $fn$;

select cron.schedule('identity-purge-docs', '30 3 * * *', $$ select public.identity_purge_due(); $$)
where not exists (select 1 from cron.job where jobname = 'identity-purge-docs');

comment on function public.identity_purge_due() is
  'Briše putanje do dokumenata kad istekne rok čuvanja i stavlja ih u red za brisanje '
  'iz Storage-a. Odluka i dokaz o njoj ostaju; slika ne.';;
