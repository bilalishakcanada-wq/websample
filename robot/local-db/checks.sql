-- Database checks the robot runs after building the local copy. Each failure stops the run.
do $$
declare
  t text;
begin
  -- Rule #1: ordinary sentences are not phone numbers (supabase/security/07)
  foreach t in array array[
    'Zato sto se ne javite ranije?',
    'Ostale stolice i tabla se nose na treci sprat.',
    'Automatski test sa telefona: ponuda robota, sve uključeno.',
    'Imam 2 stola i 3 stolice za sastaviti.',
    'Kada: Prije: 2026-10-01'
  ] loop
    if not (public.moderation_scan(t)->>'clean')::boolean then
      raise exception 'Rule #1 false positive: "%" → %', t, public.moderation_scan(t)->>'masked';
    end if;
  end loop;
  -- ...while real and disguised numbers, emails and links are still caught
  foreach t in array array[
    'Moj broj je 061 234 567', 'o61 2e4 s67', 'O6I-234-567', '+387 61 234 567',
    'nula sest jedan dva tri cetiri pet', 'pisi mi na ime@gmail.com', 'www.primjer.ba', 'nadji me na instagram @majstor'
  ] loop
    if (public.moderation_scan(t)->>'clean')::boolean then
      raise exception 'Rule #1 missed contact details: "%"', t;
    end if;
  end loop;
end $$;
