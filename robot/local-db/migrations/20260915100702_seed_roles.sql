insert into public.roles (name, description)
values
  ('USER', 'Standard application user'),
  ('PROVIDER', 'Service provider'),
  ('ADMIN', 'Administrator')
on conflict (name) do nothing;;
