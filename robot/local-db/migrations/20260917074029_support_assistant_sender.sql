alter table public.support_messages drop constraint if exists support_messages_sender_check;
alter table public.support_messages add constraint support_messages_sender_check check (sender in ('user', 'admin', 'assistant'));
drop policy if exists support_messages_user_insert on public.support_messages;
create policy support_messages_user_insert on public.support_messages for insert
  with check (auth.uid() = user_id and sender in ('user', 'assistant'));;
