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
begin
  v_user := (rec->>TG_ARGV[0])::uuid;

  -- Messages inside an accepted-bid conversation may share contact details.
  if TG_TABLE_NAME = 'messages' and public.conversation_contacts_allowed((rec->>'conversation_id')::uuid) then
    return new;
  end if;

  for i in 1..(TG_NARGS - 1) loop
    col := TG_ARGV[i];
    if rec->>col is null or rec->>col = '' then continue; end if;
    if TG_OP = 'UPDATE' and (old_rec->>col) is not distinct from (rec->>col) then continue; end if;

    scan := public.moderation_scan(rec->>col);
    if not (scan->>'clean')::boolean then
      all_kinds := all_kinds || array(select jsonb_array_elements_text(scan->'kinds'));
      hit_fields := array_append(hit_fields, col);
      rec := jsonb_set(rec, array[col], to_jsonb(scan->>'masked'));
      snippet := snippet || case when snippet = '' then '' else ' | ' end || left(scan->>'masked', 160);
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
      -- the row is mid-update; the AFTER trigger applies the strike
      perform set_config('poso.strike_pending', v_user::text, true);
    else
      perform public.apply_moderation_strike(v_user);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.moderate_profile_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending text := coalesce(current_setting('poso.strike_pending', true), '');
begin
  if pending <> '' and pending = new.user_id::text then
    perform set_config('poso.strike_pending', '', true);
    perform public.apply_moderation_strike(new.user_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.moderate_profile_after() from public, anon, authenticated;

drop trigger if exists moderate_profiles_after on public.profiles;
create trigger moderate_profiles_after after insert or update of full_name, bio on public.profiles
  for each row execute function public.moderate_profile_after();;
