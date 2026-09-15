insert into public.roles (name, description)
values
  ('USER', 'Standard application user'),
  ('PROVIDER', 'Service provider'),
  ('ADMIN', 'Administrator')
on conflict (name) do nothing;

-- Seed admin is created manually via Supabase Auth and a profile row. Keep login credentials outside the repo.
