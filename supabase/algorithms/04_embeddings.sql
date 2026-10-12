-- =============================================================================
-- Algoritmi 04: vektori značenja (pgvector) za oglase i majstore
-- =============================================================================
-- Oglas (naslov, kategorija, opis) i majstor (struke, specijalnosti, opis) dobiju vektor od 512 brojeva
-- (OpenAI text-embedding-3-small). Pretraga, uparivanje i preporuke ih koriste kad postoje; bez njih
-- sve radi kao do sada.
--
--   okidač na oglasu/profilu → red čekanja `embedding_queue` → pg_cron svake minute → Edge funkcija
--   `embed` (x-sweep-key) → OpenAI → `listing_embeddings` / `profile_embeddings`
--
-- Uključivanje: Supabase → Edge Functions → Secrets → OPENAI_API_KEY, pa deploy funkcija `embed` i
-- `embed-query`. Dok ključa nema, `embed` odgovori "not configured", a red čeka.
-- Smije se pokrenuti više puta.
-- =============================================================================

create table if not exists public.embedding_queue (
  kind text not null check (kind in ('listing', 'profile')),
  ref uuid not null,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  primary key (kind, ref)
);
alter table public.embedding_queue enable row level security;
revoke all on public.embedding_queue from anon, authenticated;

-- Keš vektora za upite iz pretrage (isti upit se ne plaća dvaput).
create table if not exists public.query_embeddings (
  query_key text primary key,
  embedding extensions.vector(512) not null,
  hits integer not null default 1,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
alter table public.query_embeddings enable row level security;
revoke all on public.query_embeddings from anon, authenticated;

create or replace function public.queue_listing_embedding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.title is not distinct from old.title and new.description is not distinct from old.description
     and new.category is not distinct from old.category then
    return new;
  end if;
  insert into public.embedding_queue (kind, ref) values ('listing', new.id)
  on conflict (kind, ref) do update set queued_at = now(), attempts = 0;
  return new;
end $$;
revoke execute on function public.queue_listing_embedding() from public, anon, authenticated;
drop trigger if exists queue_listing_embedding on public.listings;
create trigger queue_listing_embedding after insert or update of title, description, category on public.listings
for each row execute function public.queue_listing_embedding();

create or replace function public.queue_profile_embedding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_type not in ('provider', 'both') then return new; end if;
  if tg_op = 'UPDATE' and new.trades is not distinct from old.trades and new.bio is not distinct from old.bio
     and new.specialties is not distinct from old.specialties and new.account_type is not distinct from old.account_type then
    return new;
  end if;
  insert into public.embedding_queue (kind, ref) values ('profile', new.user_id)
  on conflict (kind, ref) do update set queued_at = now(), attempts = 0;
  return new;
end $$;
revoke execute on function public.queue_profile_embedding() from public, anon, authenticated;
drop trigger if exists queue_profile_embedding on public.profiles;
create trigger queue_profile_embedding after insert or update of trades, bio, specialties, account_type on public.profiles
for each row execute function public.queue_profile_embedding();

-- Edge funkcija `embed` uzima posao: tekst koji se pretvara u vektor (bez imena, telefona i sl.).
create or replace function public.embedding_jobs_take(p_limit integer default 64)
returns table(kind text, ref uuid, content text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select q.kind, q.ref from public.embedding_queue q
    where q.attempts < 5
    order by q.queued_at
    limit least(greatest(coalesce(p_limit, 64), 1), 256)
    for update skip locked
  ),
  bumped as (
    update public.embedding_queue q set attempts = q.attempts + 1
    from picked p where q.kind = p.kind and q.ref = p.ref
    returning q.kind, q.ref
  )
  select b.kind, b.ref,
    case when b.kind = 'listing' then
      (select left(concat_ws(E'\n', l.title, l.category, l.description), 4000) from public.listings l where l.id = b.ref)
    else
      (select left(concat_ws(E'\n', array_to_string(p.trades, ', '), array_to_string(p.specialties, ', '), p.bio), 4000)
       from public.profiles p where p.user_id = b.ref)
    end
  from bumped b;
end $$;

create or replace function public.embedding_save(p_kind text, p_ref uuid, p_embedding text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_embedding is null then
    delete from public.embedding_queue where kind = p_kind and ref = p_ref;
    return;
  end if;
  if p_kind = 'listing' then
    insert into public.listing_embeddings (listing_id, embedding, updated_at) values (p_ref, p_embedding::extensions.vector, now())
    on conflict (listing_id) do update set embedding = excluded.embedding, updated_at = now();
  elsif p_kind = 'profile' then
    insert into public.profile_embeddings (user_id, embedding, updated_at) values (p_ref, p_embedding::extensions.vector, now())
    on conflict (user_id) do update set embedding = excluded.embedding, updated_at = now();
  end if;
  delete from public.embedding_queue where kind = p_kind and ref = p_ref;
exception when foreign_key_violation then
  delete from public.embedding_queue where kind = p_kind and ref = p_ref;   -- oglas/profil u međuvremenu obrisan
end $$;

create or replace function public.query_embedding_get(p_key text)
returns text language sql security definer set search_path = public as $$
  update public.query_embeddings set hits = hits + 1, last_used_at = now() where query_key = p_key returning embedding::text;
$$;

create or replace function public.query_embedding_put(p_key text, p_embedding text)
returns void language sql security definer set search_path = public, extensions as $$
  insert into public.query_embeddings (query_key, embedding) values (p_key, p_embedding::extensions.vector)
  on conflict (query_key) do update set hits = query_embeddings.hits + 1, last_used_at = now();
$$;

revoke all on function public.embedding_jobs_take(integer) from public, anon, authenticated;
revoke all on function public.embedding_save(text, uuid, text) from public, anon, authenticated;
revoke all on function public.query_embedding_get(text) from public, anon, authenticated;
revoke all on function public.query_embedding_put(text, text) from public, anon, authenticated;
grant execute on function public.embedding_jobs_take(integer) to service_role;
grant execute on function public.embedding_save(text, uuid, text) to service_role;
grant execute on function public.query_embedding_get(text) to service_role;
grant execute on function public.query_embedding_put(text, text) to service_role;

-- Svake minute: ako ima posla, probudi `embed`.
create or replace function public.embedding_kick()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.embedding_queue where attempts < 5) then return; end if;
  perform net.http_post(
    url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/embed',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
    body := jsonb_build_object('batch', 64),
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function public.embedding_kick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'embedding-kick';
select cron.schedule('embedding-kick', '* * * * *', $$select public.embedding_kick()$$);

-- Keš upita ne raste bez kraja: brišu se upiti nekorišteni 60 dana.
select cron.unschedule(jobid) from cron.job where jobname = 'query-embeddings-cleanup';
select cron.schedule('query-embeddings-cleanup', '17 3 * * *', $$delete from public.query_embeddings where last_used_at < now() - interval '60 days'$$);

-- Početno punjenje: svi otvoreni oglasi i svi majstori.
insert into public.embedding_queue (kind, ref)
select 'listing', l.id from public.listings l
where l.status = 'published' and not exists (select 1 from public.listing_embeddings e where e.listing_id = l.id)
on conflict do nothing;
insert into public.embedding_queue (kind, ref)
select 'profile', p.user_id from public.profiles p
where p.account_type in ('provider', 'both') and not exists (select 1 from public.profile_embeddings e where e.user_id = p.user_id)
on conflict do nothing;
