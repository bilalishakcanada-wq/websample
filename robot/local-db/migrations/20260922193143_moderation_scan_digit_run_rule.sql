-- Ispravka: prosirena klasa znakova u koraku "skloni razdvajace" je lijepila
-- susjedne rijeci uz broj ('je 06I2345б7' -> 'j306I234567'), cime je nestala
-- granica rijeci i broj vise nije bio prepoznat. Spajanje se vraca na cifre i
-- oO/lI (kako je i bilo), a hvatanje se rjesava novim, preciznijim pravilom:
-- uzmi neprekinut niz znakova koji glume cifre, svedi ga na same cifre i
-- provjeri ima li oblik BiH broja. Time se ne dira ostatak recenice.
create or replace function public.phone_run_hit(p_norm text) returns boolean
 language plpgsql immutable set search_path to 'public'
as $fn$
declare m text[]; d text;
begin
  for m in
    select regexp_matches(p_norm,
      '([0-9oOlIsSbBgGzZtTaAeEqQ][0-9oOlIsSbBgGzZtTaAeEqQ\s._()/·•–—-]{5,}[0-9oOlIsSbBgGzZtTaAeEqQ])', 'g')
  loop
    d := translate(lower(m[1]), 'oisbgztaeq', '0158627439');
    d := regexp_replace(d, '[^0-9]', '', 'g');
    -- BiH mobilni/fiksni: 0 + 7-9 cifara, ili 387 + 8-9 cifara
    if d ~ '^0\d{7,9}$' or d ~ '^(00)?387\d{8,9}$' or d ~ '^\d{9,11}$' then
      return true;
    end if;
  end loop;
  return false;
end $fn$;

create or replace function public.moderation_scan(p_text text)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare
  txt text := coalesce(p_text, '');
  norm text;
  masked text;
  kinds text[] := '{}';
  rule record;
  hit boolean;
  i int;
  num_word constant text := '(nula|jedan|jedna|jedno|dva|dvije|dvi|tri|[čc]etiri|pet|[šs]est|sedam|osam|devet|zero|one|two|three|four|five|six|seven|eight|nine)';
  socials constant text := '(instagram|insta|facebook|fejsbuk|fejs|messenger|viber|vajber|whatsapp|whats\s?app|telegram|tiktok|tik\s?tok|snapchat|linkedin|skype|discord)';
begin
  if btrim(txt) = '' then
    return jsonb_build_object('clean', true, 'kinds', '[]'::jsonb, 'masked', txt);
  end if;

  masked := txt;

  norm := txt;
  norm := translate(norm, '０１２３４５６７８９', '0123456789');
  norm := replace(norm, '️⃣', '');
  norm := translate(norm, 'оОбЗзВАаЕеТтРрСс', 'oO63355AaEeTtPpCc');
  norm := regexp_replace(norm, '[  -​  　]', ' ', 'g');
  norm := regexp_replace(norm, '[·•∙‧]', '.', 'g');
  norm := regexp_replace(norm, '[–—‑]', '-', 'g');

  -- spajanje samo preko cifara i oO/lI (kao i ranije) da se rijeci ne lijepe
  norm := regexp_replace(norm, '([0-9oOlI])[\s._/-]+(?=[0-9oOlI])', '\1', 'g');
  for i in 1..4 loop
    norm := regexp_replace(norm, '(\d)[oO]', '\10', 'g');   norm := regexp_replace(norm, '[oO](\d)', '0\1', 'g');
    norm := regexp_replace(norm, '(\d)[lI]', '\11', 'g');   norm := regexp_replace(norm, '[lI](\d)', '1\1', 'g');
  end loop;

  for rule in
    select * from (values
      ('phone', '(\+|00)\s?387[\s./()-]*\d{1,2}[\s./()-]*\d{2,3}[\s./()-]*\d{2,4}(?:[\s./()-]*\d{1,3})?', true),
      ('phone', '\m0\d{2}[\s./()-]*\d{3}[\s./()-]*\d{3,4}\M', true),
      ('phone', '\m0\d{2}[\s./()-]*\d{2}[\s./()-]*\d{2}[\s./()-]*\d{2,3}\M', true),
      ('phone', '\m0\d{7,9}\M', true),
      ('phone', '\m38\d{9,10}\M', true),
      ('phone', '\m\d{9,11}\M', true),
      ('phone', num_word || '(?:[\s,.-]+' || num_word || '){4,}', true),
      ('email', '[A-Za-z0-9._%+-]+(@|\s?\(at\)\s?|\s?\[at\]\s?)[A-Za-z0-9-]+(\.|\s?\(dot\)\s?|\s?\[dot\]\s?)[A-Za-z]{2,}', false),
      ('email', '[A-Za-z0-9._%+-]+\s*(\(|\[|\{)?\s*(at|kod|majmun|et)\s*(\)|\]|\})?\s*[A-Za-z0-9-]{2,}\s*(\(|\[|\{)?\s*(dot|tacka|ta[čc]ka|to[čc]ka|tocka|punkt)\s*(\)|\]|\})?\s*[A-Za-z]{2,}', false),
      ('url', '(https?://|www\.)[^\s]+', false),
      ('url', '\m[a-z0-9-]+\.(com|ba|net|org|io|me|info|eu|rs|hr|de|at|ch|co|app|site|online|shop)\M(/[^\s]*)?', false),
      ('url', '\m(wa\.me|t\.me)\M[^\s]*', false),
      ('social', '\m' || socials || '[a-z]{0,3}\M(\s*(:|@|-|na|profil|nalog)?\s*@?[A-Za-z0-9_.]{3,})?', false),
      ('social', '\m(ig|fb|snap)\M\s*(:|@|-)?\s*@?[A-Za-z0-9_.]{3,}', false),
      ('handle', '(^|[\s(,;])@[A-Za-z0-9_.]{3,}', false),
      ('member_id', '\mPB-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}\M', false),
      ('prohibited', '\m(pi[sš]tolj[a-z]*|pu[sš]k[aeiu][a-z]*|oru[zž]j[aeu][a-z]*|municij[aeu][a-z]*|granat[aeu][a-z]*|eksploziv[a-z]*|kala[sš]njikov[a-z]*|\mgun\M|\mguns\M|firearm[s]?|\mpistol[s]?\M|\mrifle[s]?\M|ammunition|explosives?)', false),
      ('prohibited', '\m(drog[aeuo][a-z]*|kokain[a-z]*|heroin[a-z]*|mari[hj]uan[aeu][a-z]*|kanabis[a-z]*|canabis|cannabis|ecstasy|ekstazi|amfetamin[a-z]*|metamfetamin[a-z]*|cocaine|\mweed\M|\mtrava za pu[sš]enje|\mspid\M|\mspeed\M\s+(droga|za prodaju))', false),
      ('prohibited', '\m(la[zž]n[aeiu]\s+(li[čc]n[aeu]|paso[sš]|diplom[aeu]|dokument)|falsifik[a-z]*|prostitucij[aeu][a-z]*|seksualn[aeiu]\s+uslug[aeu][a-z]*|escort)', false)
    ) as r(kind, pattern, use_norm)
  loop
    hit := txt ~* rule.pattern;
    if not hit and rule.use_norm then
      hit := norm ~* rule.pattern;
    end if;
    if hit then
      kinds := array_append(kinds, rule.kind);
      masked := regexp_replace(masked, rule.pattern, '[uklonjeno]', 'gi');
    end if;
  end loop;

  -- niz znakova koji glume cifre, sveden na cifre, ima oblik telefona
  if not ('phone' = any(kinds)) and public.phone_run_hit(norm) then
    kinds := array_append(kinds, 'phone');
  end if;

  if 'phone' = any(kinds) and masked !~ '\[uklonjeno\]' then
    masked := regexp_replace(masked,
      '[0-9oOlIsSbBgGzZtTaAeEqQоОбЗзВАаЕеТтРрСс][0-9oOlIsSbBgGzZtTaAeEqQоОбЗзВАаЕеТтРрСс\s._()/·•–—-]{5,}[0-9oOlIsSbBgGzZtTaAeEqQоОбЗзВАаЕеТтРрСс]',
      '[uklonjeno]', 'g');
  end if;

  return jsonb_build_object(
    'clean', cardinality(kinds) = 0,
    'kinds', to_jsonb(array(select distinct k from unnest(kinds) k order by k)),
    'masked', masked
  );
end;
$function$;;
