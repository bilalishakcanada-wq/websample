alter table public.profiles add column if not exists education text[] not null default '{}';
alter table public.profiles add column if not exists work_experience text[] not null default '{}';
alter table public.profiles add column if not exists specialties text[] not null default '{}';
alter table public.profiles add column if not exists transportation text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_experience_limits;
alter table public.profiles add constraint profiles_experience_limits check (
  cardinality(education) <= 10 and cardinality(work_experience) <= 10
  and cardinality(specialties) <= 15 and cardinality(transportation) <= 8
);

-- public view carries the new sections
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false) as
  select
    user_id,
    public.display_name_of(full_name) as display_name,
    city, bio, avatar_url, created_at, account_type, trades, verified_trade, last_seen_at,
    education, work_experience, specialties, transportation
  from public.profiles
  where account_status = 'active';
grant select on public.public_profiles to anon, authenticated;

-- moderation trigger: text[] columns are scanned element by element
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
begin
  v_user := (rec->>TG_ARGV[0])::uuid;

  if TG_TABLE_NAME = 'messages' and public.conversation_contacts_allowed((rec->>'conversation_id')::uuid) then
    return new;
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
      if not (scan->>'clean')::boolean then
        all_kinds := all_kinds || array(select jsonb_array_elements_text(scan->'kinds'));
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
$$;

drop trigger if exists moderate_profiles on public.profiles;
create trigger moderate_profiles before insert or update of full_name, bio, education, work_experience, specialties, transportation on public.profiles
  for each row execute function public.moderate_content('user_id', 'full_name', 'bio', 'education', 'work_experience', 'specialties');
drop trigger if exists moderate_profiles_after on public.profiles;
create trigger moderate_profiles_after after insert or update of full_name, bio, education, work_experience, specialties, transportation on public.profiles
  for each row execute function public.moderate_profile_after();;
