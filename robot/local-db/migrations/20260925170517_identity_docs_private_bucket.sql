-- Privatni bucket samo za dokumente identiteta. Odvojen od 'uploads' da se
-- pravila pristupa ne miješaju sa ostalim privatnim fajlovima.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity', 'identity', false, 8 * 1024 * 1024,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Korisnik smije UPISATI samo u svoj folder (<user_id>/...), i to samo dok nema
-- odobren predmet — poslije odobrenja nema razloga da išta dodaje.
drop policy if exists identity_upload_own on storage.objects;
create policy identity_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'identity'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Korisnik NE MOŽE čitati ni vlastiti dokument nazad: jednom poslan, vidi ga samo
-- tim. Time se sprječava da mu neko ko preuzme nalog izvuče sliku lične karte.
drop policy if exists identity_read_staff on storage.objects;
create policy identity_read_staff on storage.objects for select to authenticated
  using (bucket_id = 'identity' and public.is_staff());

-- Brisanje ide samo kroz posao za istek roka čuvanja (service_role).
drop policy if exists identity_no_delete on storage.objects;

comment on policy identity_upload_own on storage.objects is
  'Dokumenti identiteta: korisnik upisuje samo u svoj folder; čita ih isključivo tim.';;
