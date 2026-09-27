-- Privatni fajlovi (27.09.2026.)
--
-- Do sada su dokumenti za značke (uvjerenje o nekažnjavanju, licence, dokaz o zanatu),
-- slike u porukama i slike kao dokaz rada išle u bucket "media", koji je javan: svako ko
-- ima link (ili pogodi putanju) može ih otvoriti bez prijave. Lični dokumenti za
-- verifikaciju identiteta su već u privatnom "identity" bucketu (25.09.2026.).
--
-- Provjera na produkciji 27.09.2026. (samo čitanje): u "media" su samo 3 slike oglasa,
-- nema dokumenata, slika iz poruka ni dokaza rada, pa ništa ne treba premještati.
--
-- Nova pravila: te datoteke idu u privatni bucket "uploads" (već postoji, prazan).
-- Aplikacija čuva referencu "private:uploads/<putanja>" i otvara ih kratkotrajnim
-- potpisanim linkom. Otvoriti ih mogu:
--   <korisnik>/...                          -> vlasnik (postojeće pravilo uploads_select_own)
--   <korisnik>/chat/<razgovor>/...          -> oba učesnika razgovora
--   <korisnik>/work/<oglas>/...             -> klijent i izvođač tog posla
--   sve                                     -> Poso.ba tim (admin, moderator)

-- 1 -------------------------------------------------------------------------
update storage.buckets
   set public = false,
       file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
 where id = 'uploads';

-- "media" ostaje javan za slike oglasa i portfolija, ali više ne prima PDF i druge fajlove
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
 where id = 'media';

-- 2 -------------------------------------------------------------------------
drop policy if exists uploads_read_staff on storage.objects;
create policy uploads_read_staff on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_staff());

drop policy if exists uploads_read_chat on storage.objects;
create policy uploads_read_chat on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = 'chat'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[3]
        and auth.uid() in (c.participant_one, c.participant_two)
    )
  );

drop policy if exists uploads_read_work on storage.objects;
create policy uploads_read_work on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = 'work'
    and exists (
      select 1 from public.job_payments jp
      where jp.listing_id::text = (storage.foldername(name))[3]
        and auth.uid() in (jp.client_id, jp.provider_id)
    )
  );
