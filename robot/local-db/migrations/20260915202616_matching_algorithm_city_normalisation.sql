-- Cities are free text on both sides ("Sarajevo, Sarajevo Canton, Bosnia-Herzegovina"
-- vs "Novi Grad Sarajevo"), so plain containment never matched. Reduce each side to
-- its leading city token before comparing.
create or replace function public.city_key(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(lower(split_part(coalesce(value, ''), ',', 1))), '');
$$;

create or replace function public.cities_match(a text, b text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when public.city_key(a) is null or public.city_key(b) is null then false
    else lower(b) like '%' || public.city_key(a) || '%'
      or lower(a) like '%' || public.city_key(b) || '%'
  end;
$$;

revoke execute on function public.city_key(text) from public;
revoke execute on function public.cities_match(text, text) from public;
grant execute on function public.city_key(text) to authenticated;
grant execute on function public.cities_match(text, text) to authenticated;;
