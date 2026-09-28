create or replace function public.auto_release_expired_reviews()
returns integer
language plpgsql security definer set search_path = public as $fn$
declare r record; v_count integer := 0; v_failed integer := 0;
begin
  for r in
    select id, listing_id, provider_id, client_id, net_amount
      from public.job_payments
     where work_state = 'submitted' and status = 'requested'
       and review_deadline is not null and review_deadline < now()
     order by review_deadline
     limit 200
     for update skip locked
  loop
    begin
      perform public.job_transition_system(r.id, 'completed', jsonb_build_object('razlog', 'istekao rok od 72 h'));
      update public.job_payments set auto_released = true where id = r.id;

      update public.job_payments
         set status = 'released', released_at = now()
       where id = r.id and status in ('funded', 'requested', 'disputed');
      if found then
        perform public.wallet_move(r.provider_id, r.net_amount, 'job_income',
          'Automatska isplata — klijent nije odgovorio u roku od 72 h', null);
        perform set_config('poso.system_write', '1', true);
        update public.listings set status = 'completed', completed_at = now() where id = r.listing_id;
        perform set_config('poso.system_write', '', true);

        insert into public.notifications (user_id, type, title, message, link) values
          (r.provider_id, 'job', 'Uplata oslobođena automatski 💸',
           'Klijent nije odgovorio u roku od 72 sata, pa je uplata prebačena na tvoj balans.', '/account/novcanik'),
          (r.client_id, 'job', 'Posao je automatski odobren',
           'Nisi pregledao/la predani rad u roku od 72 sata, pa je uplata oslobođena izvođaču.',
           '/listings/' || r.listing_id::text);
        v_count := v_count + 1;
      end if;
    exception when others then
      -- tihi otkaz je gori od pada: bez brojanja bi pokvaren posao vracao 0
      -- ("nema sta za obraditi") i izvodjaci ne bi dobijali novac mjesecima
      v_failed := v_failed + 1;
      insert into public.job_events (payment_id, to_state, actor_role, detail)
      values (r.id, 'submitted', 'system', jsonb_build_object('greska', sqlerrm));
    end;
  end loop;

  if v_failed > 0 then
    raise warning 'auto_release: % ugovora nije obradjeno (greske u job_events)', v_failed;
  end if;
  return v_count;
end $fn$;

select cron.schedule('auto-release-reviews', '*/15 * * * *', $$ select public.auto_release_expired_reviews(); $$)
where not exists (select 1 from cron.job where jobname = 'auto-release-reviews');;
