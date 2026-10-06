-- Rebrand: Poso.ba → Zadatak in text the database itself shows people
-- (notifications, default names, moderation notes, badge descriptions).
--
-- Every function in `public` whose body mentions "Poso.ba" is re-created from its own live
-- definition with the brand swapped, so nothing else in it changes (CREATE OR REPLACE keeps
-- grants, owner and search_path). Then badge descriptions and existing notifications are updated.
-- Safe to run more than once: the second run finds nothing to change.
-- Bosnian declension: "na Poso.ba" → "na Zadatku", "Korisnik Poso.ba" → "Korisnik Zadatka", etc.

begin;

create or replace function pg_temp.zadatak(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(replace(t,
    'Dobro došao/la na Poso.ba', 'Dobro došao/la na Zadatak'),
    'od strane Poso.ba tima', 'od strane Zadatak tima'),
    'korisnika Poso.ba', 'korisnika Zadatka'),
    'Korisnik Poso.ba', 'Korisnik Zadatka'),
    'mimo Poso.ba', 'mimo Zadatka'),
    'na Poso.ba', 'na Zadatku'),
    'Poso.ba', 'Zadatak')
$$;

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%Poso.ba%'
  loop
    execute pg_temp.zadatak(pg_get_functiondef(r.oid));
    n := n + 1;
  end loop;
  raise notice 'Zadatak rebrand: % functions updated', n;

  if exists (select 1 from pg_views where schemaname = 'public' and definition like '%Poso.ba%') then
    raise notice 'Zadatak rebrand: some views still mention Poso.ba: %',
      (select string_agg(viewname, ', ') from pg_views where schemaname = 'public' and definition like '%Poso.ba%');
  end if;
end $$;

update public.badges
   set description = pg_temp.zadatak(description)
 where description like '%Poso.ba%';

-- Notifications already in people's lists. Triggers on this table only notify (push), and only on insert.
update public.notifications
   set title = pg_temp.zadatak(title),
       message = pg_temp.zadatak(message)
 where title like '%Poso.ba%' or message like '%Poso.ba%';

commit;
