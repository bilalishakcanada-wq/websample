alter table public.moderation_queue drop constraint if exists moderation_queue_kind_check;
alter table public.moderation_queue add constraint moderation_queue_kind_check check (kind in ('avatar', 'portfolio', 'listing'));
delete from public.listings where user_id = (select id from auth.users where email = 'audit.user@posoba.dev');;
