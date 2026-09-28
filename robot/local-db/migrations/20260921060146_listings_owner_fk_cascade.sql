-- listings had no owner foreign key: a deleted account left "ghost" jobs in search.
alter table public.listings
  add constraint listings_user_id_fkey foreign key (user_id) references public.profiles(user_id) on delete cascade;;
