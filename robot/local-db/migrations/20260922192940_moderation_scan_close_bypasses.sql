-- Zatvara zaobilazenja nadjena testiranjem postojeceg detektora:
--   'O61 234 S67'                  -> slova kao cifre (S=5, B=8, G=6, Z=2, T=7, A=4, E=3, q=9)
--   '06I2345б7'                    -> cirilicni homoglifi (б, о, З, В, А, Е, Т, Р, С)
--   '0(emoji)6(emoji)1 234 567'    -> emoji cifre (keycap)
--   'zovi 061·234·567'             -> unicode separatori (·, –, —, ‑, nbsp)
--   'peroATgmailDOTcom'            -> AT/DOT bez zagrada i razmaka
--   'pero(kod)gmail(tacka)com'     -> nasi izrazi za @ i tacku
--
-- Zamjene slova rade SAMO uz stvarnu cifru (kao i postojece o/l pravilo), da se
-- normalne rijeci ne pretvore u brojeve i ne izazovu lazne uzbune.
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
  sep constant text := '[\s./()·•∙‧–—‑_,|-]';
begin
  if btrim(txt) = '' then
    return jsonb_build_object('clean', true, 'kinds', '[]'::jsonb, 'masked', txt);
  end if;

  masked := txt;

  -- 1) ujednaci unicode: emoji cifre, cirilica, razni razmaci i crtice
  norm := txt;
  norm := translate(norm, '０１２３４５６７８９', '0123456789');
  norm := replace(norm, '️⃣', '');                       -- keycap dodaci uz cifru
  norm := translate(norm, 'оОбЗзВВАаЕеТтРрСс', 'oO6335BBAaEeTtPpCc');  -- cirilica -> latinica
  norm := regexp_replace(norm, '[  -​  　]', ' ', 'g');
  norm := regexp_replace(norm, '[·•∙‧]', '.', 'g');
  norm := regexp_replace(norm, '[–—‑]', '-', 'g');

  -- 2) skloni razdvajace izmedju znakova koji glume cifre
  norm := regexp_replace(norm, '([0-9oOlIsSbBgGzZtTaAeEqQ])[\s._/-]+(?=[0-9oOlIsSbBgGzZtTaAeEqQ])', '\1', 'g');

  -- 3) slova u cifre, ali SAMO uz stvarnu cifru (inace bi rijeci postale brojevi)
  for i in 1..4 loop
    norm := regexp_replace(norm, '(\d)[oO]', '\10', 'g');   norm := regexp_replace(norm, '[oO](\d)', '0\1', 'g');
    norm := regexp_replace(norm, '(\d)[lI]', '\11', 'g');   norm := regexp_replace(norm, '[lI](\d)', '1\1', 'g');
    norm := regexp_replace(norm, '(\d)[sS]', '\15', 'g');   norm := regexp_replace(norm, '[sS](\d)', '5\1', 'g');
    norm := regexp_replace(norm, '(\d)[bB]', '\18', 'g');   norm := regexp_replace(norm, '[bB](\d)', '8\1', 'g');
    norm := regexp_replace(norm, '(\d)[gG]', '\16', 'g');   norm := regexp_replace(norm, '[gG](\d)', '6\1', 'g');
    norm := regexp_replace(norm, '(\d)[zZ]', '\12', 'g');   norm := regexp_replace(norm, '[zZ](\d)', '2\1', 'g');
    norm := regexp_replace(norm, '(\d)[tT]', '\17', 'g');   norm := regexp_replace(norm, '[tT](\d)', '7\1', 'g');
    norm := regexp_replace(norm, '(\d)[aA]', '\14', 'g');   norm := regexp_replace(norm, '[aA](\d)', '4\1', 'g');
    norm := regexp_replace(norm, '(\d)[eE]', '\13', 'g');   norm := regexp_replace(norm, '[eE](\d)', '3\1', 'g');
    norm := regexp_replace(norm, '(\d)[qQ]', '\19', 'g');   norm := regexp_replace(norm, '[qQ](\d)', '9\1', 'g');
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
      -- AT/DOT i nasi izrazi, sa ili bez zagrada i razmaka
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

  -- ako je broj prepoznat tek u normalizovanom obliku, original se ne poklapa
  -- doslovno: maskiraj svaki dovoljno dug niz znakova koji glume cifre
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
