-- Povratak na stanje prije 22.09.2026. (snimljeno prije primjene security/01 i booking/*)
-- Pokrenuti SAMO ako zakrpa napravi problem u produkciji.
-- Napomena: ovim se vraća i RANJIVOST na dvostruku isplatu — vidi docs/SIGURNOSNI-AUDIT.md
drop trigger if exists job_payments_transition_guard on public.job_payments;
drop trigger if exists listings_protect_system on public.listings;
drop trigger if exists listings_locked_after_funding on public.listings;
drop trigger if exists messages_immutable on public.messages;
-- politike za poruke natrag na staro (NE preporučuje se: dozvoljava izmjenu prepiske)
-- drop policy if exists messages_send on public.messages;
-- create policy messages_manage_own on public.messages for all to authenticated using (auth.uid() = sender_id);

