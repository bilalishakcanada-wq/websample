do $$
declare v_def text;
begin
  select pg_get_functiondef('public.my_profile_bundle'::regproc) into v_def;
  v_def := replace(v_def, $s$'icon', b.icon) order by ub.awarded_at)$s$, $s$'icon', b.icon, 'kind', b.kind, 'color', b.color) order by ub.awarded_at)$s$);
  execute v_def;
  select pg_get_functiondef('public.public_profile_bundle'::regproc) into v_def;
  v_def := replace(v_def, $s$'icon', b.icon, 'awarded_at', ub.awarded_at) order by ub.awarded_at)$s$, $s$'icon', b.icon, 'kind', b.kind, 'color', b.color, 'awarded_at', ub.awarded_at) order by ub.awarded_at)$s$);
  execute v_def;
end $$;
select proname, (pg_get_functiondef(oid) like '%''color'', b.color%') as patched from pg_proc where proname in ('my_profile_bundle','public_profile_bundle');;
