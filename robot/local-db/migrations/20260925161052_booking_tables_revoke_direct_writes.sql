-- Ove tabele se pune iskljucivo kroz SECURITY DEFINER funkcije (submit_work,
-- job_transition, request_cancellation, open_dispute, start_call), koje rade kao
-- vlasnik i ne zavise od ovih dozvola. RLS vec blokira direktan upis jer nema
-- politike za INSERT, ali dozvola koja nikom ne treba ne smije ni stajati:
-- jedna pogresno dodana politika sutra bila bi dovoljna da se otvori rupa.
revoke insert, update, delete on public.job_events from authenticated, anon;
revoke insert, update, delete on public.work_submissions from authenticated, anon;
revoke insert, update, delete on public.cancellation_requests from authenticated, anon;
revoke insert, update, delete on public.disputes from authenticated, anon;
revoke insert, update, delete on public.calls from authenticated, anon;;
