-- ============================================================================
-- Bodovanje rizika: red se sortira po opasnosti, ne po vremenu prijave.
-- Cist predmet moderator rijesi za 20 sekundi; sumnjiv dobije paznju koju trazi.
--
-- Bodovi NE odlucuju umjesto covjeka — odlucuju REDOSLIJED i koliko se upozorenja
-- prikaze. Odobrenje uvijek potpisuje moderator.
-- ============================================================================
alter table public.identity_verifications
  add column if not exists doc_phash text,          -- otisak izgleda slike (dHash)
  add column if not exists quality jsonb,           -- mjere kvaliteta iz preglednika
  add column if not exists risk_score smallint not null default 0,
  add column if not exists device_fp text,          -- gruba oznaka uredjaja/preglednika
  add column if not exists submit_ip inet;

create index if not exists idv_phash_idx on public.identity_verifications (doc_phash)
  where doc_phash is not null;
create index if not exists idv_risk_idx on public.identity_verifications (risk_score desc, submitted_at)
  where state in ('submitted','in_review');

-- Ista slika dokumenta ne smije biti odobrena na dva naloga.
create unique index if not exists idv_unique_phash_idx on public.identity_verifications (doc_phash)
  where state = 'approved' and doc_phash is not null;

-- Racuna bodove i razloge. Vraca i jedno od tri: 'brzo' / 'pregled' / 'oprez'.
create or replace function public.identity_risk(p_case uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v public.identity_verifications;
  bodovi int := 0;
  razlozi text[] := '{}';
  v_broj int;
  v_star int;
begin
  select * into v from public.identity_verifications where id = p_case;
  if v.id is null then return jsonb_build_object('bodovi', 0, 'razlozi', '[]'::jsonb); end if;

  -- 1) ista slika dokumenta vec koristena na drugom nalogu (najjaci signal)
  if v.doc_phash is not null then
    select count(*) into v_broj from public.identity_verifications x
     where x.doc_phash = v.doc_phash and x.user_id <> v.user_id;
    if v_broj > 0 then
      bodovi := bodovi + 45;
      razlozi := array_append(razlozi, 'Ista slika dokumenta već poslana s drugog naloga');
    end if;
  end if;

  -- 2) isti JMBG pokusan drugdje
  select count(*) into v_broj from public.identity_verifications x
   where x.jmbg_fp = v.jmbg_fp and x.user_id <> v.user_id;
  if v_broj > 0 then
    bodovi := bodovi + 40;
    razlozi := array_append(razlozi, 'Isti JMBG već pokušan na drugom nalogu');
  end if;

  -- 3) isti uredjaj slao vise razlicitih identiteta
  if v.device_fp is not null then
    select count(distinct x.user_id) into v_broj from public.identity_verifications x
     where x.device_fp = v.device_fp;
    if v_broj > 2 then
      bodovi := bodovi + 25;
      razlozi := array_append(razlozi, 'S istog uređaja poslano ' || v_broj || ' različitih identiteta');
    end if;
  end if;

  -- 4) ime se ne poklapa sa profilom
  if 'ime_se_razlikuje_od_profila' = any(v.risk_flags) then
    bodovi := bodovi + 15;
    razlozi := array_append(razlozi, 'Ime se razlikuje od onog na profilu');
  end if;

  -- 5) kvalitet slike (moderator ne moze procitati -> ne moze ni potvrditi)
  if v.quality is not null then
    if (v.quality->>'ostrina')::numeric < 110 then
      bodovi := bodovi + 10;
      razlozi := array_append(razlozi, 'Slika je na granici oštrine');
    end if;
    if (v.quality->>'prepaljeno')::numeric > 0.03 then
      bodovi := bodovi + 8;
      razlozi := array_append(razlozi, 'Odsjaj na dijelu dokumenta');
    end if;
  else
    bodovi := bodovi + 5;
    razlozi := array_append(razlozi, 'Nema mjera kvaliteta slike (stariji unos)');
  end if;

  -- 6) nema zadnje strane kod licne karte
  if v.doc_type = 'licna_karta' and v.doc_back_path is null then
    bodovi := bodovi + 8;
    razlozi := array_append(razlozi, 'Nedostaje zadnja strana lične karte');
  end if;

  -- 7) nalog star manje od sat vremena (tipicno za jednokratne naloge)
  select extract(epoch from (now() - p.created_at)) / 3600 into v_star
    from public.profiles p where p.user_id = v.user_id;
  if v_star is not null and v_star < 1 then
    bodovi := bodovi + 10;
    razlozi := array_append(razlozi, 'Nalog otvoren prije manje od sat vremena');
  end if;

  -- 8) vise pokusaja istog korisnika u kratkom roku
  select count(*) into v_broj from public.identity_verifications x
   where x.user_id = v.user_id and x.created_at > now() - interval '24 hours';
  if v_broj > 3 then
    bodovi := bodovi + 12;
    razlozi := array_append(razlozi, v_broj || ' pokušaja u zadnja 24 sata');
  end if;

  return jsonb_build_object(
    'bodovi', least(bodovi, 100),
    'razlozi', to_jsonb(razlozi),
    'preporuka', case when bodovi >= 40 then 'oprez' when bodovi >= 15 then 'pregled' else 'brzo' end);
end $fn$;

grant execute on function public.identity_risk(uuid) to authenticated;;
