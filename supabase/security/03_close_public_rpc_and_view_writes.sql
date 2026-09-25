-- Zatvaranje rupa pronađenih 25.09.2026. Isprobano na produkcijskoj bazi u
-- transakciji koja je vraćena (rollback); primjenjuje se kao migracija
-- close_public_rpc_and_view_writes.
--
-- 1) public.public_profiles je jednostavan view nad profiles, pa ga Postgres
--    smatra "auto-updatable". Uz SECURITY DEFINER (vlasnik postgres zaobilazi RLS)
--    i podrazumijevani GRANT ALL za anon/authenticated, bilo ko bez prijave je
--    mogao preko PostgREST-a:
--        PATCH  /rest/v1/public_profiles?user_id=eq.<id>   {"bio": "..."}
--        DELETE /rest/v1/public_profiles?user_id=eq.<id>
--    i tako mijenjati ili BRISATI tuđe profile. Dokazano u transakciji koja je
--    vraćena (rollback): UPDATE i DELETE kao anon su pogodili po 1 red.
--    View ostaje samo za čitanje.
--
-- 2) Nekoliko internih SECURITY DEFINER funkcija je ranije dobilo
--    "revoke ... from anon, authenticated", ali Postgres svakoj funkciji daje
--    EXECUTE i roli PUBLIC, pa su ostale pozivive preko /rest/v1/rpc/*:
--      jmbg_key()               -> vraćao je TAJNI ključ za šifrovanje JMBG-a iz Vaulta
--      jmbg_fingerprint(text)   -> otisak JMBG-a za bilo koji broj (pogađanje)
--      job_transition_system    -> sistemski prelaz stanja ugovora za bilo koji posao
--      identity_purge_due       -> ručno pokretanje brisanja dokumenata (cron posao)
--      auto_release_expired_reviews -> ručno pokretanje auto-isplate (cron posao)
--    Cron ih zove kao postgres, submit_identity/identity_decide kao vlasnik funkcije,
--    pa nijednoj klijentskoj roli ne trebaju.
--
-- 3) identity_risk(case) je bio poziv bez provjere: bilo ko je mogao pročitati
--    razloge rizika za tuđi predmet verifikacije. Sad ga smije zvati samo tim;
--    submit_identity koristi internu identity_risk_calc.

-- 1 -------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from public, anon, authenticated;
alter view public.public_profiles set (security_barrier = true);

-- 2 -------------------------------------------------------------------------
revoke execute on function public.jmbg_key() from public, anon, authenticated;
revoke execute on function public.jmbg_fingerprint(text) from public, anon, authenticated;
revoke execute on function public.job_transition_system(uuid, work_state, jsonb) from public, anon, authenticated;
revoke execute on function public.identity_purge_due() from public, anon, authenticated;
revoke execute on function public.auto_release_expired_reviews() from public, anon, authenticated;

-- 3 -------------------------------------------------------------------------
-- dosadašnje tijelo identity_risk postaje interna identity_risk_calc
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.identity_risk(uuid)'::regprocedure);
  v_def := replace(v_def, 'FUNCTION public.identity_risk(', 'FUNCTION public.identity_risk_calc(');
  execute v_def;
end $$;
revoke execute on function public.identity_risk_calc(uuid) from public, anon, authenticated;

create or replace function public.identity_risk(p_case uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return public.identity_risk_calc(p_case);
end $$;
revoke execute on function public.identity_risk(uuid) from public, anon;
grant execute on function public.identity_risk(uuid) to authenticated;

-- submit_identity računa rizik za korisnika koji nije tim -> interna funkcija
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.submit_identity(text, text, doc_kind, text, text, text, text, text, jsonb, text)'::regprocedure);
  if position('public.identity_risk(v_row.id)' in v_def) = 0 then
    raise exception 'submit_identity se promijenio; provjeri poziv identity_risk ručno';
  end if;
  execute replace(v_def, 'public.identity_risk(v_row.id)', 'public.identity_risk_calc(v_row.id)');
end $$;
