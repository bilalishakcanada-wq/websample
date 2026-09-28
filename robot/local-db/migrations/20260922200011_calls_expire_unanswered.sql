-- Poziv koji niko ne javi mora sam prestati zvoniti. Bez ovoga zapis ostaje
-- 'ringing' zauvijek, pozivaocu stoji "Zvoni…", a pozvanom se poziv javlja
-- svaki put kad otvori aplikaciju. (Otkrio E2E test.)
create or replace function public.expire_stale_calls() returns integer
language plpgsql security definer set search_path = public as $fn$
declare v integer;
begin
  update public.calls
     set state = 'missed', ended_at = now(), duration_sec = 0,
         end_reason = coalesce(end_reason, 'niko se nije javio')
   where state = 'ringing' and started_at < now() - interval '60 seconds';
  get diagnostics v = row_count;

  -- poziv koji je "aktivan" danima znaci da su obje strane nestale bez prekida
  update public.calls
     set state = 'ended', ended_at = now(),
         duration_sec = coalesce(duration_sec, greatest(0, extract(epoch from (now() - coalesce(answered_at, started_at)))::int)),
         end_reason = coalesce(end_reason, 'veza prekinuta')
   where state = 'active' and started_at < now() - interval '6 hours';
  return v;
end $fn$;

select cron.schedule('expire-stale-calls', '* * * * *', $$ select public.expire_stale_calls(); $$)
where not exists (select 1 from cron.job where jobname = 'expire-stale-calls');

-- ocisti zaostale zapise iz testiranja
select public.expire_stale_calls();;
