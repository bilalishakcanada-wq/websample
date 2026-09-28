-- NALAZ (uhvatio E2E): release_job_payment i cancel_job_payment mijenjaju samo
-- `status`, ne i `work_state`. Posljedica: klijent oslobodi uplatu ranije, novac
-- ode izvodjacu, a kartica "Tok posla" i dalje pise "Izvodjac radi posao" i nudi
-- dugme "Predaj rad" za posao koji je vec placen.
--
-- Umjesto da krpim svaku funkciju posebno (i zaboravim onu koja se doda sutra),
-- stanje ugovora prati novac trigerom: kad novac ode, ugovor je gotov.
create or replace function public.sync_work_state_with_money() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.status = 'released' and new.work_state is distinct from 'completed' then
    new.work_state := 'completed';
  elsif new.status = 'refunded' and new.work_state is distinct from 'cancelled' then
    new.work_state := 'cancelled';
  end if;
  return new;
end $fn$;

drop trigger if exists job_payments_sync_work_state on public.job_payments;
create trigger job_payments_sync_work_state before update on public.job_payments
  for each row execute function public.sync_work_state_with_money();

-- uskladi postojece redove koji su se vec razisli
update public.job_payments set work_state = 'completed'
 where status = 'released' and work_state is distinct from 'completed';
update public.job_payments set work_state = 'cancelled'
 where status = 'refunded' and work_state is distinct from 'cancelled';;
