do $$
declare v_def text;
begin
  select pg_get_functiondef('public.admin_user_dossier'::regproc) into v_def;
  v_def := replace(v_def, $s$'ai_assessment', p.ai_assessment, 'ai_assessed_at', p.ai_assessed_at
      ) from public.profiles p where p.user_id = p_user_id$s$,
  $s$'ai_assessment', p.ai_assessment, 'ai_assessed_at', p.ai_assessed_at, 'balance', p.balance
      ) from public.profiles p where p.user_id = p_user_id$s$);
  v_def := replace(v_def, $s$    'notes', ($s$,
  $s$    'wallet', (
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'balance_after', t.balance_after, 'kind', t.kind, 'note', t.note, 'actor_name', ap.full_name, 'created_at', t.created_at) order by t.created_at desc), '[]'::jsonb)
      from (select * from public.wallet_transactions where user_id = p_user_id order by created_at desc limit 40) t left join public.profiles ap on ap.user_id = t.actor_id
    ),
    'notes', ($s$);
  execute v_def;
end $$;
select (pg_get_functiondef('public.admin_user_dossier'::regproc) like '%''wallet'', (%') as patched, (pg_get_functiondef('public.admin_user_dossier'::regproc) like '%''balance'', p.balance%') as balance_in;;
