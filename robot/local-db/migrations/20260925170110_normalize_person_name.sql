-- Poredi imena bez obzira na dijakritiku, velika slova, zareze i redoslijed:
-- "Išak, Bilal" = "BILAL ISAK". Koristi postojeci fold_text, da transliteracija
-- nasih slova stoji na jednom mjestu u cijeloj bazi.
create or replace function public.normalize_person_name(p text) returns text
language sql immutable set search_path = public as $fn$
  select coalesce(array_to_string(
    (select array_agg(w order by w)
     from unnest(string_to_array(
       trim(regexp_replace(public.fold_text(coalesce(p, '')), '[^a-z0-9 ]', ' ', 'g')),
       ' ')) as w
     where w <> ''), ' '), '');
$fn$;;
