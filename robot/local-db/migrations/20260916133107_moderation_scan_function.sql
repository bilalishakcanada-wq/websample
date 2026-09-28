-- Rule #1 detector: phone numbers (incl. spelled-out and obfuscated), emails,
-- links, social networks / handles, and private member IDs.
-- Returns {clean, kinds, masked} — masked has every hit replaced by [uklonjeno].
create or replace function public.moderation_scan(p_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
  txt text := coalesce(p_text, '');
  norm text;
  masked text;
  kinds text[] := '{}';
  rule record;
  hit boolean;
  num_word constant text := '(nula|jedan|jedna|jedno|dva|dvije|dvi|tri|[čc]etiri|pet|[šs]est|sedam|osam|devet|zero|one|two|three|four|five|six|seven|eight|nine)';
begin
  if btrim(txt) = '' then
    return jsonb_build_object('clean', true, 'kinds', '[]'::jsonb, 'masked', txt);
  end if;

  masked := txt;

  -- Obfuscation: letters standing in for digits inside digit groups ("o6l 387 36l"),
  -- and separators typed between every digit ("0 6 1 3 8 7 3 6 1").
  norm := txt;
  norm := regexp_replace(norm, '(\d)[oO](\d)', '\10\2', 'g');
  norm := regexp_replace(norm, '(\d)[oO](\d)', '\10\2', 'g');
  norm := regexp_replace(norm, '(\d)[lI](\d)', '\11\2', 'g');
  norm := regexp_replace(norm, '(\d)[lI](\d)', '\11\2', 'g');
  norm := regexp_replace(norm, '\m[oO](\d)', '0\1', 'g');
  norm := regexp_replace(norm, '(\d)[\s._-]+(?=\d)', '\1', 'g');

  for rule in
    select * from (values
      -- phones
      ('phone', '(\+|00)\s?387[\s./()-]*\d{1,2}[\s./()-]*\d{2,3}[\s./()-]*\d{2,4}(?:[\s./()-]*\d{1,3})?', true),
      ('phone', '\m0\d{2}[\s./()-]*\d{3}[\s./()-]*\d{3,4}\M', true),
      ('phone', '\m0\d{2}[\s./()-]*\d{2}[\s./()-]*\d{2}[\s./()-]*\d{2,3}\M', true),
      ('phone', '\m0\d{7,9}\M', true),
      ('phone', '\m38\d{9,10}\M', true),
      ('phone', '\m\d{9,11}\M', true),
      ('phone', num_word || '(?:[\s,.-]+' || num_word || '){4,}', true),
      -- email
      ('email', '[A-Za-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[A-Za-z0-9.-]+\s?(\.|\(dot\)|\[dot\])\s?[A-Za-z]{2,}', false),
      -- links
      ('url', '(https?://|www\.)[^\s]+', false),
      ('url', '\m[a-z0-9-]+\.(com|ba|net|org|io|me|info|eu|rs|hr|de|at|ch|co|app|site|online|shop)\M(/[^\s]*)?', false),
      -- social networks and handles
      ('social', '\m(instagram|insta|ig|facebook|fb|fejs|fejsbuk|messenger|viber|vajber|whatsapp|whats\s?app|wa\.me|telegram|tiktok|tik\s?tok|snapchat|snap|linkedin|twitter|skype|discord|t\.me)\M\s*(:|@|-|na|profil|nalog)?\s*@?[A-Za-z0-9_.]{3,}', false),
      ('social', '\m(instagram|insta|facebook|fejsbuk|fejs|messenger|viber|vajber|whatsapp|whats\s?app|telegram|tiktok|tik\s?tok|snapchat|linkedin|skype|discord)\M', false),
      ('handle', '(^|[\s(,;])@[A-Za-z0-9_.]{3,}', false),
      -- private member IDs must not be shared
      ('member_id', '\mPB-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}\M', false)
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

  -- A hit that only exists in the normalised text: mask the digit-ish run in the original.
  if 'phone' = any(kinds) and masked !~ '\[uklonjeno\]' then
    masked := regexp_replace(masked, '[0-9oOlI][0-9oOlI\s._()/-]{6,}[0-9oOlI]', '[uklonjeno]', 'g');
  end if;

  return jsonb_build_object(
    'clean', cardinality(kinds) = 0,
    'kinds', to_jsonb(array(select distinct k from unnest(kinds) k order by k)),
    'masked', masked
  );
end;
$$;
grant execute on function public.moderation_scan(text) to anon, authenticated;;
