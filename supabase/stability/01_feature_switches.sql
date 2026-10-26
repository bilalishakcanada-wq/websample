-- Prekidači: isključi jednu funkciju (npr. plaćanje karticom) bez nove verzije aplikacije, i najmanja
-- verzija Android/iOS aplikacije ispod koje se traži ažuriranje.
-- Svi čitaju (i gosti), mijenja samo admin (Admin → Prekidači, ili Table Editor u Supabase-u).
-- Ako red ne postoji ili tabela nije pokrenuta, aplikacija radi kao da je sve uključeno.

create table if not exists public.feature_switches (
  key text primary key,
  label text not null,
  enabled boolean not null default true,
  -- poruka koju korisnik vidi dok je funkcija isključena
  message text,
  -- za 'min_app_version': {"android": "1.0.0", "ios": "1.0.0", "android_url": "...", "ios_url": "..."}
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.feature_switches enable row level security;

drop policy if exists feature_switches_read on public.feature_switches;
create policy feature_switches_read on public.feature_switches for select to anon, authenticated using (true);

drop policy if exists feature_switches_admin_update on public.feature_switches;
create policy feature_switches_admin_update on public.feature_switches for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.feature_switches to anon, authenticated;
grant update (enabled, message, value) on public.feature_switches to authenticated;

create or replace function public.touch_feature_switch()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists feature_switches_touch on public.feature_switches;
create trigger feature_switches_touch before update on public.feature_switches
  for each row execute function public.touch_feature_switch();

insert into public.feature_switches (key, label, message, value) values
  ('card_topup', 'Uplata karticom', 'Uplata karticom je privremeno isključena. Pokušaj malo kasnije.', null),
  ('post_job', 'Objava novog posla', 'Objava poslova je privremeno pauzirana zbog održavanja. Pokušaj za nekoliko minuta.', null),
  ('chat_images', 'Slike u porukama', 'Slanje slika je privremeno isključeno. Tekst poruke radi normalno.', null),
  ('support_assistant', 'AI asistent podrške', null, null),
  ('min_app_version', 'Najmanja verzija aplikacije', 'Izašla je nova verzija aplikacije. Ažuriraj je da nastaviš.',
   '{"android": "0.0.0", "ios": "0.0.0", "android_url": "https://play.google.com/store/apps/details?id=ba.poso.app", "ios_url": ""}'::jsonb)
on conflict (key) do nothing;
