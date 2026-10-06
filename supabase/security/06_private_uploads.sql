-- Privatni fajlovi (27.09.2026., dopunjeno 06.10.2026.)
--
-- Do sada su dokumenti za značke (uvjerenje o nekažnjavanju, licence, lična karta za značku),
-- slike u porukama, slike kao dokaz rada i foto dokaz na licu mjesta (booking/04) išli u bucket
-- "media", koji je javan. Lični dokumenti za verifikaciju identiteta (JMBG tok) su već u
-- privatnom "identity" bucketu (25.09.2026.).
--
-- Provjera na produkciji 06.10.2026. (samo čitanje): u "media" je 10 fajlova; pored slika
-- oglasa tu su i dva dokumenta za značku "Lična karta", dvije licence, slika iz poruke i dvije
-- slike dokaza rada. Pravilo media_read_public je dozvoljavalo SVAKOME (i bez prijave) da
-- izlista cijeli bucket i tako nađe linkove na te fajlove.
--
-- Nova pravila:
--   * nove takve datoteke idu u privatni bucket "uploads"; aplikacija čuva referencu
--     "private:uploads/<putanja>" i otvara je kratkotrajnim potpisanim linkom. Otvoriti je mogu:
--       <korisnik>/...                          -> vlasnik (postojeće pravilo uploads_select_own)
--       <korisnik>/chat/<razgovor>/...          -> oba učesnika razgovora
--       <korisnik>/work/<oglas>/...             -> klijent i izvođač tog posla (i foto dokaz)
--       sve                                     -> Zadatak tim (admin, moderator)
--   * "media" se više ne može izlistati: popis vide samo vlasnik fajla i tim, a za goste samo
--     slike oglasa i portfolija. Javni linkovi na postojeće slike rade kao i prije.
--   * "media" prima samo slike, video za portfolio i PDF (stara aplikacija u kešu telefona još
--     šalje dokumente tamo dok se ne osvježi); HTML, SVG i ostalo se odbija.
--   * private_uploads_enabled() kaže sajtu da su ova pravila na bazi; dok je nema, sajt
--     koristi stari put, pa redoslijed objave sajta i ove datoteke nije bitan.
--
-- Smije se pokrenuti više puta.

-- 1 -------------------------------------------------------------------------
update storage.buckets
   set public = false,
       file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
                                  'image/heic', 'image/heif', 'application/pdf']
 where id = 'uploads';

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
                                  'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime',
                                  'application/pdf']
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

-- 3 -------------------------------------------------------------------------
-- Javni linkovi (/object/public/media/...) ne prolaze kroz ovo pravilo; ono važi za popis
-- (list) i preuzimanje preko API-ja. Brisanje slike oglasa (vlasnik) ga i dalje prolazi.
drop policy if exists media_read_public on storage.objects;
create policy media_read_public on storage.objects for select
  using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[2] = 'listings'                -- slike oglasa
      or name ~ '^[0-9a-f-]{36}/[0-9]+\.[A-Za-z0-9]+$'          -- portfolio (<korisnik>/<vrijeme>.<ext>)
      or (storage.foldername(name))[1] = auth.uid()::text      -- svoje fajlove
      or public.is_staff()
    )
  );

-- 4 -------------------------------------------------------------------------
create or replace function public.private_uploads_enabled()
returns boolean language sql immutable set search_path = '' as $$ select true $$;
grant execute on function public.private_uploads_enabled() to anon, authenticated;
