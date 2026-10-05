-- Sigurni linkovi na fajlove (04.10.2026.)
--
-- Problem: kolone sa linkovima na fajlove (slika u poruci, dokument za verifikaciju, slike
-- portfolija i oglasa, dokazi rada i spora) prihvataju BILO KAKAV tekst. Aplikacija ih upisuje
-- sama, ali svako sa nalogom može direktno preko API-ja upisati npr. link na lažnu stranicu za
-- prijavu ili "javascript:…". Taj link se onda prikazuje drugoj strani u razgovoru, ili adminu
-- kao "Pogledaj dokument" — klik vodi na tuđu stranicu (phishing) umjesto na naš fajl.
-- (React 19 sam blokira "javascript:" linkove, a nova sigurnosna politika stranice (CSP) blokira
-- tuđe skripte; ovo zatvara i ostatak: u bazu ulaze samo linkovi na naše fajlove.)
--
-- Provjera na produkciji 04.10.2026. (samo čitanje): nijedan postojeći red ne krši pravila,
-- pa se ograničenja dodaju odmah i provjeravaju i stare redove.
--
-- Dozvoljeno:
--   private:uploads/<putanja>                               privatni fajl (PR #14, 06_private_uploads.sql)
--   https://<projekat>.supabase.co/storage/v1/object/...    javni ili potpisani fajl iz Supabase Storagea
--   http://127.0.0.1:54321/storage/v1/object/...            lokalna testna baza (robot)
-- Profilna slika: bilo koji https:// link (Google i Facebook daju svoje), ili prazno.
-- Link u obavještenju: samo putanja unutar sajta ("/poruke", ne "https://…" ni "//…").
--
-- Smije se pokrenuti više puta.

create or replace function public.is_safe_file_ref(p_ref text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_ref !~ '\.\.' and (
         p_ref ~ '^private:uploads/[A-Za-z0-9._/-]+$'
      or p_ref ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/(public|sign|authenticated)/[^[:space:]"''<>\\]+$'
      or p_ref ~ '^http://(127\.0\.0\.1|localhost):54321/storage/v1/object/(public|sign|authenticated)/[^[:space:]"''<>\\]+$'
  )
$$;

create or replace function public.are_safe_file_refs(p_refs text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(bool_and(public.is_safe_file_ref(r)), true) from unnest(p_refs) as r
$$;

-- no revoke: a CHECK constraint runs its functions as the user doing the insert, so they must stay
-- callable by everyone (they only compare text and reveal nothing)

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('messages',              'messages_attachment_url_safe',          'attachment_url is null or public.is_safe_file_ref(attachment_url)'),
      ('verification_requests', 'verification_requests_document_safe',   'public.is_safe_file_ref(document_url)'),
      ('portfolio_items',       'portfolio_items_media_url_safe',        'public.is_safe_file_ref(media_url)'),
      ('listing_images',        'listing_images_url_safe',               'public.is_safe_file_ref(url)'),
      ('moderation_queue',      'moderation_queue_media_url_safe',       'public.is_safe_file_ref(media_url)'),
      ('work_submissions',      'work_submissions_evidence_safe',        'evidence_urls is null or public.are_safe_file_refs(evidence_urls)'),
      ('disputes',              'disputes_evidence_safe',                'evidence_urls is null or public.are_safe_file_refs(evidence_urls)'),
      ('profiles',              'profiles_avatar_url_safe',              $c$avatar_url is null or avatar_url = '' or avatar_url ~ '^https://[^[:space:]"''<>\\]+$'$c$),
      ('notifications',         'notifications_link_internal',           $c$link is null or link ~ '^/([^/\\]|$)'$c$)
    ) as t(tbl, name, expr)
  loop
    if to_regclass('public.' || c.tbl) is null then
      raise notice 'skipping %, table does not exist', c.tbl;
      continue;
    end if;
    execute format('alter table public.%I drop constraint if exists %I', c.tbl, c.name);
    execute format('alter table public.%I add constraint %I check (%s)', c.tbl, c.name, c.expr);
  end loop;
end
$$;
