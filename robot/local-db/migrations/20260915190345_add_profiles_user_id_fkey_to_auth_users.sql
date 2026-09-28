alter table public.profiles
  add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;;
