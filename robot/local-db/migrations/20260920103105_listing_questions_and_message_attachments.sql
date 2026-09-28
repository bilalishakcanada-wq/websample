-- Public Q&A under a job (like "Questions" next to "Offers"); the owner answers in the same thread.
create table if not exists public.listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists listing_questions_listing_idx on public.listing_questions(listing_id, created_at);
alter table public.listing_questions enable row level security;

drop policy if exists listing_questions_read on public.listing_questions;
create policy listing_questions_read on public.listing_questions for select using (true);
drop policy if exists listing_questions_insert on public.listing_questions;
create policy listing_questions_insert on public.listing_questions for insert
  with check (auth.uid() = user_id and not public.is_suspended());
drop policy if exists listing_questions_delete_own on public.listing_questions;
create policy listing_questions_delete_own on public.listing_questions for delete using (auth.uid() = user_id or public.is_admin());

-- Rule #1 (no phone numbers / emails) is enforced by the same trigger as messages.
drop trigger if exists moderate_listing_questions on public.listing_questions;
create trigger moderate_listing_questions before insert or update of body on public.listing_questions
  for each row execute function public.moderate_content('user_id', 'body');

-- Owner hears about new questions; the asker (and other participants) hear when the owner answers.
create or replace function public.on_listing_question_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_name text; v_target uuid;
begin
  select user_id, title into v_owner, v_title from public.listings where id = new.listing_id;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.user_id;
  if new.user_id = v_owner then
    -- owner answered: notify everyone else in the thread (once per person)
    for v_target in select distinct user_id from public.listing_questions where listing_id = new.listing_id and user_id <> v_owner loop
      insert into public.notifications (user_id, type, title, message, link, dedupe_key)
      values (v_target, 'question', 'Odgovor na tvoje pitanje', coalesce(v_title, 'Posao') || ' · ' || left(new.body, 120), '/listings/' || new.listing_id::text || '?tab=pitanja', 'qa:' || new.id::text || ':' || v_target::text);
    end loop;
  elsif v_owner is not null then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (v_owner, 'question', 'Novo pitanje uz tvoj posao', coalesce(v_name, 'Korisnik') || ' · ' || left(new.body, 120), '/listings/' || new.listing_id::text || '?tab=pitanja', 'qa:' || new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists on_listing_question_notify on public.listing_questions;
create trigger on_listing_question_notify after insert on public.listing_questions
  for each row execute function public.on_listing_question_notify();

-- Chat: optional image attachment on a message.
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text;;
