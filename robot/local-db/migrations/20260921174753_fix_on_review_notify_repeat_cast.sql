-- rating is numeric; repeat() needs an integer count (this broke every review insert)
create or replace function public.on_review_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_title text;
begin
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.reviewer_id;
  select title into v_title from public.listings where id = new.listing_id;
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.reviewee_id, 'review', 'Nova recenzija: ' || repeat('★', greatest(1, least(5, round(new.rating)::int))),
          coalesce(v_name, 'Korisnik') || coalesce(' · ' || v_title, '') || coalesce(' — „' || left(new.comment, 100) || '“', ''),
          '/korisnik/' || new.reviewee_id::text, 'review:' || new.id::text)
  on conflict do nothing;
  return new;
end $$;;
