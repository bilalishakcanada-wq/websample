create or replace function public.admin_adjust_balance(p_user_id uuid, p_amount numeric, p_kind text default 'admin_credit', p_note text default null)
returns public.wallet_transactions language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric(12, 2);
  v_row public.wallet_transactions;
  v_kind text := coalesce(p_kind, case when p_amount >= 0 then 'admin_credit' else 'admin_debit' end);
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then raise exception 'BAD_AMOUNT'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id) then raise exception 'NO_PROFILE'; end if;

  perform set_config('poso.system_write', '1', true);
  update public.profiles set balance = round(balance + p_amount, 2) where user_id = p_user_id returning balance into v_balance;
  perform set_config('poso.system_write', '', true);
  if v_balance < 0 then raise exception 'INSUFFICIENT' using errcode = 'P0001'; end if;

  insert into public.wallet_transactions (user_id, amount, balance_after, kind, note, actor_id)
  values (p_user_id, round(p_amount, 2), v_balance, v_kind, nullif(btrim(p_note), ''), auth.uid())
  returning * into v_row;

  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'wallet',
          case when p_amount > 0 then 'Na tvoj balans je uplaćeno ' || trim(to_char(p_amount, 'FM999G999D00')) || ' KM' else 'Sa tvog balansa je skinuto ' || trim(to_char(abs(p_amount), 'FM999G999D00')) || ' KM' end,
          coalesce(nullif(btrim(p_note), ''), 'Poso.ba tim') || ' · novo stanje: ' || trim(to_char(v_balance, 'FM999G999D00')) || ' KM');
  perform public.log_staff_action('wallet_adjust', p_user_id, jsonb_build_object('amount', p_amount, 'kind', v_kind, 'note', p_note, 'balance_after', v_balance));
  return v_row;
end;
$$;;
