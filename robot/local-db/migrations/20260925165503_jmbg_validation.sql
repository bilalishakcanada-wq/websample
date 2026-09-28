-- ============================================================================
-- Provjera JMBG-a (13 cifara): DDMMLLL RR BBB K
--   DD MM LLL  datum rodjenja (LLL = zadnje tri cifre godine; 9xx = 1900-te, 0xx = 2000-te)
--   RR         sifra regije (BiH: 10-19)
--   BBB        redni broj; 000-499 musko, 500-999 zensko
--   K          kontrolna cifra
--
-- STO OVO MOZE: odbaciti izmisljen ili pogresno ukucan broj, i reci datum
-- rodjenja, pol i regiju koje broj tvrdi.
-- STO NE MOZE: potvrditi da osoba postoji niti da broj pripada bas njoj — u BiH
-- ne postoji javni registar koji bi privatna firma mogla pitati. To potvrdjuje
-- covjek koji uporedi broj sa slikom licne karte.
-- ============================================================================

create or replace function public.jmbg_check(p_jmbg text)
returns jsonb
language plpgsql immutable set search_path = public as $fn$
declare
  d text := regexp_replace(coalesce(p_jmbg, ''), '\D', '', 'g');
  c int[];
  m int; k int;
  dan int; mjesec int; god int; regija int; redni int;
  datum date;
  greske text[] := '{}';
begin
  if length(d) <> 13 then
    return jsonb_build_object('valid', false, 'greske', to_jsonb(array['JMBG mora imati tačno 13 cifara']));
  end if;

  select array_agg(substr(d, i, 1)::int order by i) into c from generate_series(1, 13) i;

  dan := (substr(d,1,2))::int;
  mjesec := (substr(d,3,2))::int;
  god := (substr(d,5,3))::int;
  regija := (substr(d,8,2))::int;
  redni := (substr(d,10,3))::int;

  -- godina: 900-999 -> 1900-te, 000-899 -> 2000-te
  god := case when god >= 900 then 1000 + god else 2000 + god end;

  begin
    datum := make_date(god, mjesec, dan);
  exception when others then
    greske := array_append(greske, 'Datum rođenja u broju nije ispravan');
  end;

  if datum is not null then
    if datum > current_date then
      greske := array_append(greske, 'Datum rođenja je u budućnosti');
    elsif datum < current_date - interval '120 years' then
      greske := array_append(greske, 'Datum rođenja je nemoguć');
    end if;
  end if;

  -- BiH regije 10-19; ostale su druge republike bivse Jugoslavije
  if regija < 10 or regija > 19 then
    greske := array_append(greske, 'Šifra regije nije bosanskohercegovačka (10–19)');
  end if;

  -- kontrolna cifra
  m := 11 - ((7*(c[1]+c[7]) + 6*(c[2]+c[8]) + 5*(c[3]+c[9]) + 4*(c[4]+c[10])
            + 3*(c[5]+c[11]) + 2*(c[6]+c[12])) % 11);
  k := case when m between 1 and 9 then m when m in (10, 11) then 0 else -1 end;
  if k <> c[13] then
    greske := array_append(greske, 'Kontrolna cifra se ne poklapa');
  end if;

  return jsonb_build_object(
    'valid', cardinality(greske) = 0,
    'greske', to_jsonb(greske),
    'datum_rodjenja', datum,
    'pol', case when redni < 500 then 'M' else 'Ž' end,
    'regija', regija,
    'regija_naziv', case regija
      when 10 then 'Banja Luka' when 11 then 'Bihać' when 12 then 'Doboj'
      when 13 then 'Goražde'   when 14 then 'Livno'  when 15 then 'Mostar'
      when 16 then 'Prijedor'  when 17 then 'Sarajevo' when 18 then 'Tuzla'
      when 19 then 'Zenica'    else null end
  );
end $fn$;

comment on function public.jmbg_check(text) is
  'Strukturna provjera JMBG-a: kontrolna cifra, datum, regija. NE potvrdjuje postojanje osobe.';;
