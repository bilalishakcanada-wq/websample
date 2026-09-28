-- ============================================================
-- 1. Per-user conversation preferences (saved / archived)
-- ============================================================
create table if not exists public.conversation_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  saved boolean not null default false,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table public.conversation_prefs enable row level security;
drop policy if exists conversation_prefs_own on public.conversation_prefs;
create policy conversation_prefs_own on public.conversation_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 2. Inbox in one call
-- ============================================================
create or replace function public.my_inbox()
returns table (
  id uuid, listing_id uuid, listing_title text, created_at timestamptz,
  other_id uuid, other_name text, other_avatar text, other_type text,
  last_message text, last_sender uuid, last_at timestamptz,
  unread bigint, saved boolean, archived boolean, contacts_allowed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.listing_id, l.title, c.created_at,
    o.user_id, coalesce(pp.display_name, 'Korisnik Poso.ba'), pp.avatar_url, pp.account_type,
    lm.content, lm.sender_id, coalesce(lm.created_at, c.created_at),
    (select count(*) from public.messages m where m.conversation_id = c.id and m.receiver_id = auth.uid() and m.read_at is null),
    coalesce(cp.saved, false), coalesce(cp.archived, false),
    public.conversation_contacts_allowed(c.id)
  from public.conversations c
  cross join lateral (select case when c.participant_one = auth.uid() then c.participant_two else c.participant_one end as user_id) o
  left join public.public_profiles pp on pp.user_id = o.user_id
  left join public.listings l on l.id = c.listing_id
  left join lateral (select m.content, m.sender_id, m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  left join public.conversation_prefs cp on cp.conversation_id = c.id and cp.user_id = auth.uid()
  where auth.uid() in (c.participant_one, c.participant_two)
  order by coalesce(lm.created_at, c.created_at) desc;
$$;
revoke execute on function public.my_inbox() from public, anon;
grant execute on function public.my_inbox() to authenticated;

-- receiver marks everything in a conversation as read
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  update public.messages set read_at = now()
  where conversation_id = p_conversation_id and receiver_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- messages: sender may see read receipts, receiver may not edit content (unchanged) — add updates to publication for read receipts
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversation_prefs') then
    alter publication supabase_realtime add table public.conversation_prefs;
  end if;
end $$;

-- ============================================================
-- 3. Illegal content is a Rule #1-level violation everywhere (masked + strike)
-- ============================================================
create or replace function public.moderation_scan(p_text text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
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

  norm := regexp_replace(txt, '([0-9oOlI])[\s._/-]+(?=[0-9oOlI])', '\1', 'g');
  for i in 1..4 loop
    norm := regexp_replace(norm, '(\d)[oO]', '\10', 'g');
    norm := regexp_replace(norm, '[oO](\d)', '0\1', 'g');
    norm := regexp_replace(norm, '(\d)[lI]', '\11', 'g');
    norm := regexp_replace(norm, '[lI](\d)', '1\1', 'g');
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
      ('url', '(https?://|www\.)[^\s]+', false),
      ('url', '\m[a-z0-9-]+\.(com|ba|net|org|io|me|info|eu|rs|hr|de|at|ch|co|app|site|online|shop)\M(/[^\s]*)?', false),
      ('url', '\m(wa\.me|t\.me)\M[^\s]*', false),
      ('social', '\m' || socials || '[a-z]{0,3}\M(\s*(:|@|-|na|profil|nalog)?\s*@?[A-Za-z0-9_.]{3,})?', false),
      ('social', '\m(ig|fb|snap)\M\s*(:|@|-)?\s*@?[A-Za-z0-9_.]{3,}', false),
      ('handle', '(^|[\s(,;])@[A-Za-z0-9_.]{3,}', false),
      ('member_id', '\mPB-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}\M', false),
      -- illegal goods and services
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

-- messages in accepted conversations may share contacts, but never illegal content:
create or replace function public.moderate_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb := to_jsonb(new);
  old_rec jsonb := case when TG_OP = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  col text;
  scan jsonb;
  all_kinds text[] := '{}';
  hit_fields text[] := '{}';
  snippet text := '';
  v_user uuid;
  i int;
  elem text;
  new_arr jsonb;
  arr_hit boolean;
  contacts_ok boolean := false;
  kinds_here text[];
begin
  v_user := (rec->>TG_ARGV[0])::uuid;

  if TG_TABLE_NAME = 'messages' then
    contacts_ok := public.conversation_contacts_allowed((rec->>'conversation_id')::uuid);
  end if;

  for i in 1..(TG_NARGS - 1) loop
    col := TG_ARGV[i];
    if rec->col is null or rec->col = 'null'::jsonb then continue; end if;
    if TG_OP = 'UPDATE' and (old_rec->col) is not distinct from (rec->col) then continue; end if;

    if jsonb_typeof(rec->col) = 'array' then
      new_arr := '[]'::jsonb;
      arr_hit := false;
      for elem in select jsonb_array_elements_text(rec->col) loop
        scan := public.moderation_scan(elem);
        if not (scan->>'clean')::boolean then
          arr_hit := true;
          all_kinds := all_kinds || array(select jsonb_array_elements_text(scan->'kinds'));
          snippet := snippet || case when snippet = '' then '' else ' | ' end || left(scan->>'masked', 120);
        end if;
        new_arr := new_arr || to_jsonb(scan->>'masked');
      end loop;
      if arr_hit then
        hit_fields := array_append(hit_fields, col);
        rec := jsonb_set(rec, array[col], new_arr);
      end if;
    else
      if rec->>col = '' then continue; end if;
      scan := public.moderation_scan(rec->>col);
      kinds_here := array(select jsonb_array_elements_text(scan->'kinds'));
      -- contacts are fine once a bid is accepted; illegal content never is
      if contacts_ok and not ('prohibited' = any(kinds_here)) then continue; end if;
      if contacts_ok then
        -- re-scan for the prohibited part only, keep the contact details intact
        scan := jsonb_build_object(
          'clean', false, 'kinds', '["prohibited"]'::jsonb,
          'masked', regexp_replace(rec->>col,
            '\m(pi[sš]tolj[a-z]*|pu[sš]k[aeiu][a-z]*|oru[zž]j[aeu][a-z]*|municij[aeu][a-z]*|granat[aeu][a-z]*|eksploziv[a-z]*|drog[aeuo][a-z]*|kokain[a-z]*|heroin[a-z]*|mari[hj]uan[aeu][a-z]*|kanabis[a-z]*|cannabis|ecstasy|ekstazi|amfetamin[a-z]*|metamfetamin[a-z]*|cocaine|falsifik[a-z]*|prostitucij[aeu][a-z]*|escort)',
            '[uklonjeno]', 'gi'));
        kinds_here := array['prohibited'];
      end if;
      if not (scan->>'clean')::boolean then
        all_kinds := all_kinds || kinds_here;
        hit_fields := array_append(hit_fields, col);
        rec := jsonb_set(rec, array[col], to_jsonb(scan->>'masked'));
        snippet := snippet || case when snippet = '' then '' else ' | ' end || left(scan->>'masked', 160);
      end if;
    end if;
  end loop;

  if cardinality(hit_fields) > 0 then
    new := jsonb_populate_record(new, rec);
    insert into public.moderation_events (user_id, source_table, source_id, fields, kinds, snippet, action)
    values (
      v_user, TG_TABLE_NAME, nullif(rec->>'id', '')::uuid, hit_fields,
      array(select distinct k from unnest(all_kinds) k order by k), snippet, 'masked'
    );
    if TG_TABLE_NAME = 'profiles' then
      perform set_config('poso.strike_pending', v_user::text, true);
    else
      perform public.apply_moderation_strike(v_user);
    end if;
  end if;
  return new;
end;
$$;;
