-- NALAZ (moj propust pri uvodjenju booking enginea): work_transitions je matrica
-- dozvoljenih prelaza — dakle sigurnosno pravilo — a bila je bez RLS-a i sa
-- pravom INSERT za rolu authenticated. Svaki prijavljeni korisnik mogao je dodati
-- vlastiti prelaz, npr. ('in_progress','completed','client') i odobriti isplatu
-- bez ijednog predanog rada, ili ('disputed','completed','client') i izaci iz
-- spora. Matrica se cita u job_transition(), pa je to bilo direktno zaobilazenje
-- cijelog toka posla.
alter table public.work_transitions enable row level security;

drop policy if exists work_transitions_read on public.work_transitions;
create policy work_transitions_read on public.work_transitions for select to authenticated
  using (true);
-- namjerno NEMA politike za INSERT/UPDATE/DELETE: matrica se mijenja samo
-- migracijom, nikad iz aplikacije

revoke insert, update, delete on public.work_transitions from authenticated, anon;

comment on table public.work_transitions is
  'Matrica dozvoljenih prelaza stanja posla = sigurnosno pravilo. Samo za citanje; '
  'mijenja se iskljucivo migracijom. Nikad ne dodavati politiku za pisanje.';;
