-- Rule #1 false positives: ordinary sentences were treated as phone numbers.
--
-- phone_run_hit() (migration moderation_scan_digit_run_rule, 2026-09-22) reads letters that look
-- like digits (o→0, i→1, z→2, e→3, a→4, s→5, b→6, t→7, g→9, q→9) and joins them across spaces.
-- A run made only of such letters then counts as a phone number, so everyday Bosnian without
-- diacritics is masked and earns a Rule #1 strike (3 strikes in 30 days = 7-day suspension):
--   "Zato sto se ne javite ranije?"              → zato sto se   → 247057053 (9 digits)
--   "Ostale stolice i tabla se nose na ..."       → masked twice
--   "Test sa telefona"                            → masked
-- Found by the test robot (robot/README.md) when a worker got suspended for normal offers.
--
-- Fix: a run only counts when it really contains digits: at least 4 real digits (0-9), and real
-- digits make up at least half of it. Obfuscated numbers such as "o61 2e4 s67" or "O6I-234-567"
-- are still caught; runs of plain words are not. The regex rules for real numbers are unchanged.
-- Safe to re-run.

create or replace function public.phone_run_hit(p_norm text)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare m text[]; d text; real_digits int;
begin
  for m in
    select regexp_matches(p_norm,
      '([0-9oOlIsSbBgGzZtTaAeEqQ][0-9oOlIsSbBgGzZtTaAeEqQ\s._()/·•–—-]{5,}[0-9oOlIsSbBgGzZtTaAeEqQ])', 'g')
  loop
    real_digits := length(regexp_replace(m[1], '[^0-9]', '', 'g'));
    d := translate(lower(m[1]), 'oisbgztaeq', '0158627439');
    d := regexp_replace(d, '[^0-9]', '', 'g');
    -- words made of digit-like letters ("zato sto se") are not a number
    continue when real_digits < 4 or real_digits * 2 < length(d);
    -- BiH mobilni/fiksni: 0 + 7-9 cifara, ili 387 + 8-9 cifara
    if d ~ '^0\d{7,9}$' or d ~ '^(00)?387\d{8,9}$' or d ~ '^\d{9,11}$' then
      return true;
    end if;
  end loop;
  return false;
end $function$;

-- Review (read-only, for staff): phone-only strikes of the last 30 days. The snippet shows where the
-- text was masked; "[uklonjeno]" in the middle of ordinary words (e.g. "[uklonjeno]fona") is this bug.
-- select e.created_at, e.user_id, e.source_table, e.snippet
--   from public.moderation_events e
--  where e.kinds = array['phone'] and not e.dismissed and e.created_at > now() - interval '30 days'
--  order by e.created_at desc;
