-- =============================================================================
-- Algoritmi 02: pretraga oglasa
-- =============================================================================
-- Šta se mijenja (izmjereno na 46 stvarnih upita, vidi supabase/algorithms/README.md):
--  * riječi bez značenja za pretragu ("trebam", "nekoga", "da", "mi", "hitno") se ne traže;
--  * riječi istog značenja se traže zajedno (spremačica = čišćenje, preseljenje = selidba, nemački = njemački);
--  * prvo se traže oglasi sa svim riječima; kad ih je malo, dodaju se oglasi sa većinom riječi i oni sa
--    greškom u kucanju, ispod njih (rečenica više ne vraća 0 rezultata);
--  * grad u upitu ("moler Tuzla") postaje mjesto pretrage umjesto riječi koju oglas mora sadržavati;
--  * pretraga po značenju (pgvector) kad aplikacija pošalje vektor upita (vidi 04);
--  * brže: slike i ocjene objavljivača se ne broje posebno za svaki od 3000 kandidata.
-- Smije se pokrenuti više puta.
-- =============================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- rječnik
create table if not exists public.search_stopwords (word text primary key);
alter table public.search_stopwords enable row level security;
revoke all on public.search_stopwords from anon, authenticated;
insert into public.search_stopwords (word) values
 ('trebam'),('treba'),('trebaju'),('trebamo'),('potreban'),('potrebna'),('potrebno'),('potrebni'),('trazim'),('trazimo'),('trazi'),
 ('mi'),('me'),('meni'),('nam'),('nas'),('vam'),('vas'),('moj'),('moja'),('moje'),('moju'),('mog'),('mom'),('nas'),('nasa'),('nase'),
 ('da'),('ne'),('za'),('na'),('u'),('i'),('ili'),('a'),('sa'),('s'),('od'),('do'),('po'),('o'),('uz'),('iz'),('kod'),('bez'),
 ('je'),('su'),('se'),('sam'),('si'),('smo'),('ste'),('bi'),('bih'),('ce'),('cu'),('bude'),('ima'),('imam'),('imamo'),('li'),
 ('ko'),('koji'),('koja'),('koje'),('koga'),('kome'),('sto'),('sta'),('kako'),('gdje'),('kad'),('kada'),('moze'),('mozete'),('moguce'),
 ('molim'),('hitno'),('hitan'),('hitna'),('brzo'),('danas'),('sutra'),('neko'),('nekoga'),('nekog'),('nekome'),('nesto'),('neki'),('neka'),
 ('osoba'),('osobu'),('osobe'),('covjek'),('covjeka'),('covjeku'),('majstor'),('majstora'),('majstore'),('majstoru'),('usluga'),('usluge'),
 ('uraditi'),('uradi'),('napraviti'),('napravi'),('odraditi'),('obaviti'),('posao'),('posla'),('dobar'),('dobra'),('dobro'),
 ('jeftino'),('jeftin'),('povoljno'),('cijena'),('cijenu'),('km'),('ovo'),('to'),('taj'),('ta'),('te'),('ovaj'),('ova'),('ove'),('jos'),
 ('pomoc'),('pomoci'),('pomozite'),('trebao'),('trebala'),('trebali'),('zelim'),('zelimo'),('htio'),('htjela'),('hocu'),('fali')
on conflict do nothing;

-- Riječi istog značenja: upit koji počinje bilo kojim korijenom iz grupe traži sve korijene grupe.
-- Korijen od 3 slova i kraći se traži kao cijela riječ ("pas" ne nađe "pasoš").
create table if not exists public.search_synonyms (grp text not null, root text not null, primary key (grp, root));
alter table public.search_synonyms enable row level security;
revoke all on public.search_synonyms from anon, authenticated;
delete from public.search_synonyms;
insert into public.search_synonyms (grp, root)
select g, unnest(r) from (values
 ('krecenje', array['krec','okrec','farb','ofarb','moler','gletov','molersk']),
 ('ciscenje', array['cisc','ocist','cistac','spremac','spreman','pospreman','higijenicar']),
 ('selidba',  array['selid','seli','preselj','preseli','preseljen','sele']),
 ('prevoz',   array['prevoz','prevez','prevest','transport','kombi','kamion','dostav','kurir']),
 ('vodoinst', array['vodoinst','vodoinstal','instalater','vodoinstalater']),
 ('struja',   array['elektr','struj','osigurac']),
 ('klima',    array['klim','klimatiz','inverter']),
 ('grijanje', array['grij','grije','grejanj','grej','centraln','radijator','kotao']),
 ('namjestaj',array['namjest','namest','mobilijar']),
 ('montaza',  array['montaz','montir','sklap','sklopi','sastavlj','monter']),
 ('stolar',   array['stolar','drvodjelj','drvodelj']),
 ('pod',      array['laminat','parket']),
 ('keramika', array['keramic','plocic','plocica','plocice','flis']),
 ('basta',    array['bast','vrt','vrtlar','bastovan']),
 ('kosenje',  array['kosenj','kosi','pokosi','kosilic','trav','trimer']),
 ('djeca',    array['djec','djet','dijet','dadilj','deca','dece','deci','decu','dete','deteta','beba','bebisit']),
 ('ljubimci', array['ljubim','pas','psa','psi','pse','psu','pasa','mack','macak','mace','maca','kuc']),
 ('frizer',   array['frizer','frizur','sisanj','osisa','sisa','fenira']),
 ('sminka',   array['sminka','sminkan','makeup']),
 ('auto',     array['auto','automobil','vozil','automehan','mehanic','autoservis']),
 ('racunar',  array['racunar','kompjut','laptop','computer','pc']),
 ('web',      array['web','sajt','website']),
 ('foto',     array['fotograf','slikanj','fotkanj','snimanj','snimatelj','video']),
 ('instrukcije', array['instrukc','poducav','korepet','ucenj','tutor']),
 ('njemacki', array['njemack','nemack','njemacki','nemacki']),
 ('engleski', array['englesk','engleski']),
 ('prevodjenje', array['prevod','prevodilac','prevodjenj','prevodenj']),
 ('trener',   array['trener','trening','fitnes','teretan','vjezb']),
 ('knjigovodstvo', array['knjigovod','racunovod','knjigovodj','knjigovod']),
 ('popravka', array['popravk','popravi','popravit','popravlj','servis','kvar','pokvar']),
 ('curenje',  array['curi','curenj','cure','kaplje','kapanj','procuri','procurio','pukla','puklo','puca']),
 ('paljenje', array['pali','upali','palj']),
 ('torta',    array['tort','kolac','kolace','slatk']),
 ('kuhanje',  array['kuhan','kuvan','kuhar','kuvar','catering','ketering','rucak','rucka'])
) as v(g, r)
on conflict do nothing;

-- Riječi po kojima se prepozna vrsta posla iz teksta oglasa (kad je oglas u pogrešnoj kategoriji, npr.
-- "Pukla cijev" objavljeno kao "Majstor za sve"). Koristi se u uparivanju, preporukama i pretrazi.
create table if not exists public.category_terms (category text not null, root text not null, primary key (category, root));
alter table public.category_terms enable row level security;
revoke all on public.category_terms from anon, authenticated;
delete from public.category_terms;
insert into public.category_terms (category, root)
select c, unnest(r) from (values
 ('Selidbe i transport', array['selid','preselj','seli','kombi','kamion','transport','prevoz','namjest','nosen','utovar','odvoz','deponij']),
 ('Čišćenje', array['cisc','ocist','spreman','pospreman','pranj','prozor','tepih','garnitur','dezinf','prasin']),
 ('Majstor za sve', array['popravk','popravi','polic','kvak','silikon','karnis','sitn','objesi','busen']),
 ('Vodoinstalater', array['vodoinst','slavin','bojler','cijev','cijevi','odvod','sudoper','lavabo','wc','solj','vodokotl','kanaliz','kupatil','tus','kada','zacepl','curi','sifon','ventil']),
 ('Električar', array['elektr','struj','osigurac','uticnic','prekidac','rasvjet','lamp','luster','razvodn','instalacij','kabl','sporet']),
 ('Moler/farbanje', array['krec','okrec','farb','ofarb','moler','gletov','fasad','glet']),
 ('Stolarski radovi', array['stolar','drv','vrata','ormar','iveric','plakar','sarke','prozor']),
 ('Montaža namještaja', array['montaz','sklap','sklopi','ikea','jysk','lesnin','ormar','krevet','komod','kuhinj','plakar','namjest']),
 ('Baštovanstvo', array['bast','vrt','trav','kosenj','kosi','orezivanj','vock','zivic','dvorist','sadnj']),
 ('Čuvanje djece', array['djec','djet','dijet','dadilj','beba','vrtic','skol']),
 ('Čuvanje ljubimaca', array['ljubim','pas','psa','pse','mack','macak','setnj','grooming','sisanj']),
 ('Instrukcije/podučavanje', array['instrukc','poducav','matematik','fizik','hemij','matur','zadac','kontroln','razred']),
 ('Časovi jezika', array['jezik','englesk','njemack','nemack','francusk','talijansk','italijansk','konverzac']),
 ('IT podrška', array['racunar','kompjut','laptop','windows','wifi','mrez','router','printer','instalacij','format','virus','telefon']),
 ('Dizajn i kreativne usluge', array['dizajn','logo','logotip','grafik','meni','plakat','vizit','ilustrac']),
 ('Fotografisanje i video', array['fotograf','foto','slikanj','snimanj','video','dron','vjencanj']),
 ('Event organizacija', array['event','proslav','rodjendan','rodendan','animator','svadb','vjencanj','dekorac']),
 ('Catering i kuvanje', array['kuhan','kuvan','rucak','obrok','tort','kolac','catering','ketering','hran']),
 ('Ljepota i wellness', array['frizer','frizur','sisanj','sminka','manikir','pedikir','masaz','kozmet','nokt','trepavic']),
 ('Fitness treneri', array['trener','trening','fitnes','teretan','mrsavljenj','vjezb']),
 ('Automehaničar/auto usluge', array['auto','automobil','vozil','gume','guma','motor','akumulator','anlaser','ulje','filter','kocnic','servis']),
 ('Pravni savjeti', array['advokat','pravn','ugovor','sud','tuzb','notar','ostavin']),
 ('Knjigovodstvo i finansije', array['knjigovod','racunovod','porez','pdv','faktur','bilans','plat','doo']),
 ('Prevoz i dostava', array['dostav','prevoz','paket','kurir','namirnic','kupovin','odvez','prevez']),
 ('Renoviranje i građevinski radovi', array['renov','adaptac','gradj','gradev','keramic','plocic','laminat','parket','rusenj','zid','fasad','gips','rigips','beton','malter']),
 ('Klimatizacija i grijanje', array['klim','inverter','freon','grij','grijanj','radijator','kotao','pec','toplot']),
 ('Marketing i digitalne usluge', array['marketing','web','sajt','stranic','drustven','instagram','facebook','oglas','seo']),
 ('Ostalo', array[]::text[])
) as v(c, r)
where cardinality(r) > 0
on conflict do nothing;

-- Korijen → dio tsquery: kratki korijeni kao cijela riječ, duži kao početak riječi.
create or replace function public.search_root_query(p_root text)
returns text language sql immutable parallel safe set search_path = public as $$
  select case when length(p_root) <= 3 then quote_literal(p_root) else quote_literal(p_root) || ':*' end;
$$;

-- Riječi upita (bez riječi bez značenja; ako su sve takve, sve ostaju) i za svaku njeni korijeni.
create or replace function public.search_terms(p_query text)
returns table(pos integer, word text, roots text[])
language sql stable parallel safe set search_path = public as $$
  with raw as (
    select t.word, t.pos::int as pos
    from unnest(regexp_split_to_array(public.fold_text(left(coalesce(p_query, ''), 200)), '[^a-z0-9]+')) with ordinality as t(word, pos)
    where t.word <> '' and (length(t.word) >= 2 or t.word ~ '^[0-9]+$')
  ),
  kept as (
    select r.* from raw r
    where not exists (select 1 from public.search_stopwords s where s.word = r.word)
       or not exists (select 1 from raw r2 where not exists (select 1 from public.search_stopwords s2 where s2.word = r2.word))
  ),
  stemmed as (
    select k.pos, k.word,
           case when length(k.word) >= 7 then left(k.word, length(k.word) - 2)
                when length(k.word) = 6 then left(k.word, 5) else k.word end as stem
    from kept k
  )
  select s.pos, s.word,
         array(select distinct x from (
           select s.stem as x
           union all
           select syn.root from public.search_synonyms syn
           where syn.grp in (select m.grp from public.search_synonyms m
                             where (length(m.root) > 3 and (s.word like m.root || '%' or (length(s.stem) >= 4 and m.root like s.stem || '%')))
                                or (length(m.root) <= 3 and s.word = m.root))
         ) y) as roots
  from stemmed s
  limit 8;
$$;

-- Sve riječi (svaka svojim korijenima) — stroga pretraga.
create or replace function public.search_query_all(p_query text)
returns tsquery language sql stable parallel safe set search_path = public as $$
  select to_tsquery('simple'::regconfig, string_agg('(' || g.alts || ')', ' & ' order by g.pos))
  from (select t.pos, string_agg(public.search_root_query(r), ' | ') as alts
        from public.search_terms(p_query) t, unnest(t.roots) r group by t.pos) g;
$$;

-- Bilo koja riječ — opuštena pretraga i rangiranje po tome koliko riječi oglas pokriva.
create or replace function public.search_query_any(p_query text)
returns tsquery language sql stable parallel safe set search_path = public as $$
  select to_tsquery('simple'::regconfig, string_agg(public.search_root_query(r), ' | '))
  from public.search_terms(p_query) t, unnest(t.roots) r;
$$;

-- Vrste posla iz teksta: tsquery od korijena za date kategorije (npr. majstorove struke).
create or replace function public.trade_query(p_categories text[])
returns tsquery language sql stable parallel safe set search_path = public as $$
  select to_tsquery('simple'::regconfig, string_agg(distinct public.search_root_query(ct.root), ' | '))
  from public.category_terms ct
  where public.fold_text(ct.category) in (select public.fold_text(c) from unnest(coalesce(p_categories, '{}'::text[])) c);
$$;

-- Najvjerovatnija kategorija za tekst (za prijedlog pri objavi i za oglase u pogrešnoj kategoriji).
create or replace function public.guess_category(p_text text)
returns table(category text, hits integer)
language sql stable set search_path = public as $$
  with w as (
    select distinct t.word from unnest(regexp_split_to_array(public.fold_text(left(coalesce(p_text, ''), 2000)), '[^a-z0-9]+')) t(word)
    where length(t.word) >= 2
  )
  select ct.category, count(distinct w.word)::int as hits
  from public.category_terms ct join w on (length(ct.root) <= 3 and w.word = ct.root) or (length(ct.root) > 3 and w.word like ct.root || '%')
  group by ct.category
  order by hits desc, ct.category
  limit 3;
$$;
grant execute on function public.guess_category(text) to anon, authenticated;

-- Grad napisan u upitu ("moler Tuzla", "čišćenje Banja Luka"): ostatak upita i tačka grada.
create or replace function public.search_split_place(p_query text)
returns table(rest text, place text, lat double precision, lng double precision)
language sql stable parallel safe set search_path = public as $$
  with q as (select ' ' || regexp_replace(public.fold_text(coalesce(p_query, '')), '[^a-z0-9()-]+', ' ', 'g') || ' ' as t),
  hit as (
    select c.name, c.folded, c.lat, c.lng from public.city_coords c, q
    where length(c.folded) >= 4 and q.t like '% ' || c.folded || ' %'
      -- "Brod" u "prevoz na brod" i slično: ime grada mora biti cijela riječ, a ostatak upita smije ostati prazan
    order by length(c.folded) desc
    limit 1
  )
  select btrim(regexp_replace(replace(q.t, ' ' || h.folded || ' ', ' '), '\s+', ' ', 'g')), h.name, h.lat, h.lng
  from hit h, q;
$$;

-- ---------------------------------------------------------------- brži podaci za rangiranje
alter table public.listings add column if not exists image_count integer not null default 0;
alter table public.listings add column if not exists cover_url text;

create or replace function public.sync_listing_cover()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.listings l set
    image_count = (select count(*) from public.listing_images i where i.listing_id = v_id),
    cover_url = (select i.url from public.listing_images i where i.listing_id = v_id order by i.position, i.id limit 1)
  where l.id = v_id;
  if tg_op = 'UPDATE' and old.listing_id is distinct from new.listing_id then
    update public.listings l set
      image_count = (select count(*) from public.listing_images i where i.listing_id = old.listing_id),
      cover_url = (select i.url from public.listing_images i where i.listing_id = old.listing_id order by i.position, i.id limit 1)
    where l.id = old.listing_id;
  end if;
  return null;
end $$;
revoke execute on function public.sync_listing_cover() from public, anon, authenticated;
drop trigger if exists sync_listing_cover on public.listing_images;
create trigger sync_listing_cover after insert or update or delete on public.listing_images
for each row execute function public.sync_listing_cover();

update public.listings l set
  image_count = coalesce((select count(*) from public.listing_images i where i.listing_id = l.id), 0),
  cover_url = (select i.url from public.listing_images i where i.listing_id = l.id order by i.position, i.id limit 1)
where l.image_count is distinct from coalesce((select count(*) from public.listing_images i where i.listing_id = l.id), 0)
   or l.cover_url is distinct from (select i.url from public.listing_images i where i.listing_id = l.id order by i.position, i.id limit 1);

-- Vektori značenja (puni ih Edge funkcija `embed`, vidi 04). U posebnim tabelama da ne idu uz svaki
-- "select *" na oglasima i profilima i da ih niko ne može pročitati preko API-ja.
create table if not exists public.listing_embeddings (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  embedding extensions.vector(512) not null,
  source_hash text,
  updated_at timestamptz not null default now()
);
create table if not exists public.profile_embeddings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  embedding extensions.vector(512) not null,
  source_hash text,
  updated_at timestamptz not null default now()
);
alter table public.listing_embeddings enable row level security;
alter table public.profile_embeddings enable row level security;
revoke all on public.listing_embeddings, public.profile_embeddings from anon, authenticated;
create index if not exists listing_embeddings_hnsw on public.listing_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists profile_embeddings_hnsw on public.profile_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------- pretraga
-- p_fuzzy = false: stroga (sve riječi). true: opuštena (bilo koja riječ, greške u kucanju, po značenju).
drop function if exists public.search_listings_core(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer, boolean);
create or replace function public.search_listings_core(
  p_query text, p_category text,
  p_lat double precision, p_lng double precision, p_radius_km double precision,
  p_include_remote boolean, p_min_price numeric, p_max_price numeric,
  p_has_budget boolean, p_no_offers boolean,
  p_sort text, p_limit integer, p_offset integer, p_fuzzy boolean,
  p_embedding extensions.vector default null, p_exclude uuid[] default null)
returns table(
  id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text,
  status text, created_at timestamptz, lat double precision, lng double precision, is_remote boolean,
  cover_url text, image_count integer, offers integer, distance_km double precision, text_rank real,
  poster_rating numeric, poster_reviews integer, poster_completed integer, score numeric, total_count bigint,
  date_type text, due_date date, time_of_day text[], travel_allowance numeric)
language plpgsql stable security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_all tsquery := public.search_query_all(p_query);
  v_any tsquery := public.search_query_any(p_query);
  v_folded text := public.fold_text(btrim(coalesce(p_query, '')));
  v_cat text := nullif(btrim(coalesce(p_category, '')), '');
  v_has_origin boolean := p_lat is not null and p_lng is not null;
  v_radius double precision := coalesce(p_radius_km, 0);
  v_lat_span double precision := coalesce(p_radius_km, 0) / 111.32;
  v_lng_span double precision := coalesce(p_radius_km, 0) / (111.32 * greatest(cos(radians(coalesce(p_lat, 0))), 0.01));
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := coalesce(p_sort, 'recommended');
  v_today date := public.today_ba();
  v_trades text[];
  v_trades_folded text[];
  v_trade_q tsquery;
  v_text boolean := v_any is not null;
begin
  -- greška u kucanju: dovoljno je 40 % sličnosti s jednom riječi naslova ("kuhnja" → "kuhinje");
  -- vektori: pretraži 100 najbližih umjesto zadanih 40
  perform set_config('pg_trgm.word_similarity_threshold', '0.4', true);
  perform set_config('hnsw.ef_search', '100', true);
  select coalesce(p.trades, '{}'::text[]) into v_trades from public.profiles p where p.user_id = auth.uid();
  v_trades := coalesce(v_trades, '{}'::text[]);
  v_trades_folded := array(select public.fold_text(t) from unnest(v_trades) t);
  v_trade_q := public.trade_query(v_trades);

  return query
  with base as not materialized (
    select l.* from public.listings l
    where l.status = 'published'
      and (l.due_date is null or l.due_date >= v_today)
      and l.invited_provider is null
      and (p_exclude is null or l.id <> all (p_exclude))
      and (v_cat is null or l.category = v_cat)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (not p_has_budget or l.price is not null)
      and (not p_no_offers or l.bid_count = 0)
      and (not v_has_origin or v_radius = 0
             or (l.lat between p_lat - v_lat_span and p_lat + v_lat_span and l.lng between p_lng - v_lng_span and p_lng + v_lng_span)
             or (p_include_remote and l.lat is null))
  ),
  -- Izrazi su ispisani u upitu (bez poziva fold_text/distance_km po redu): funkcija sa SET search_path
  -- se ne može ugraditi u upit, pa je svaki poziv za 3000 kandidata koštao stotine milisekundi.
  lexical as (
    select b.id, b.user_id, b.title, b.description, b.category, b.location, b.price, b.currency, b.status, b.created_at,
           b.lat, b.lng, b.bid_count, b.image_count, b.cover_url, b.date_type, b.due_date, b.time_of_day, b.travel_allowance,
           b.search_tsv, null::double precision as sem_sim
    from base b
    where not v_text
       or (not p_fuzzy and b.search_tsv @@ v_all)
       or (p_fuzzy and (b.search_tsv @@ v_any or v_folded <% translate(lower(b.title), 'čćšžđ', 'ccszd')))
    order by b.created_at desc
    limit 3000
  ),
  semantic as (
    -- po značenju: najbližih 150 oglasa vektoru upita, samo stvarno bliski i samo oni koji prolaze filtere
    select b.id, b.user_id, b.title, b.description, b.category, b.location, b.price, b.currency, b.status, b.created_at,
           b.lat, b.lng, b.bid_count, b.image_count, b.cover_url, b.date_type, b.due_date, b.time_of_day, b.travel_allowance,
           b.search_tsv, n.sim as sem_sim
    from (
      select e.listing_id, 1 - (e.embedding <=> p_embedding) as sim
      from public.listing_embeddings e
      where p_fuzzy and p_embedding is not null
      order by e.embedding <=> p_embedding
      limit 300
    ) n
    join base b on b.id = n.listing_id
    where n.sim >= 0.35
    order by n.sim desc
    limit 150
  ),
  pool as (
    select distinct on (u.id) u.* from (select * from lexical union all select * from semantic) u
    order by u.id, u.sem_sim desc nulls last
  ),
  measured as (
    select p.*,
      (lower(coalesce(p.location, '')) ~ '(online|daljin)') as remote,
      case when v_has_origin and p.lat is not null and p.lng is not null and lower(coalesce(p.location, '')) !~ '(online|daljin)' then
        2 * 6371 * asin(sqrt(power(sin(radians(p.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - p_lng) / 2), 2))) end as dist
    from pool p
  ),
  in_range as (
    select m.* from measured m
    where not v_has_origin
       or (m.remote and p_include_remote)
       or (not m.remote and m.dist is not null and (v_radius = 0 or m.dist <= v_radius))
  ),
  posters as (
    select r.reviewee_id as uid, round(avg(r.rating), 2) as rating, count(*)::int as reviews
    from public.reviews r where r.reviewee_id in (select distinct i.user_id from in_range i)
    group by r.reviewee_id
  ),
  done as (
    select d.user_id as uid, count(*)::int as completed
    from public.listings d where d.status = 'completed' and d.user_id in (select distinct i.user_id from in_range i)
    group by d.user_id
  ),
  enriched as (
    select i.*,
      case when not v_text then 0.5::real
           else greatest(
             least(1, ts_rank_cd(i.search_tsv, v_any, 1) * 4) * (case when not p_fuzzy or i.search_tsv @@ v_all then 1 else 0.75 end),
             case when p_fuzzy then extensions.word_similarity(v_folded, translate(lower(i.title), 'čćšžđ', 'ccszd')) * 0.8 else 0 end,
             greatest(0, least(1, (coalesce(i.sem_sim, 0) - 0.30) / 0.35)) * 0.9
           )::real end as trank,
      coalesce(po.rating, 0) as p_rating, coalesce(po.reviews, 0) as p_reviews, coalesce(dn.completed, 0) as p_completed,
      (cardinality(v_trades) > 0) as has_trades,
      (exists (select 1 from unnest(v_trades_folded) t
               where t = translate(lower(i.category), 'čćšžđ', 'ccszd')
                  or translate(lower(i.category), 'čćšžđ', 'ccszd') like '%' || t || '%'
                  or t like '%' || translate(lower(split_part(i.category, '/', 1)), 'čćšžđ', 'ccszd') || '%')
        or (v_trade_q is not null and i.search_tsv @@ v_trade_q)) as trade_ok
    from in_range i
    left join posters po on po.uid = i.user_id
    left join done dn on dn.uid = i.user_id
  ),
  scored as (
    select e.*,
      round((
        3.0 * e.trank
      + 1.6 * exp(-extract(epoch from now() - e.created_at) / 3600.0 / 72.0)
      + 1.2 * (case when e.remote then 0.8 when e.dist is null then 0.5 else greatest(0, 1 - e.dist / 120.0) end)
      + 1.1 * (case when e.bid_count = 0 then 1 when e.bid_count <= 2 then 0.8 when e.bid_count <= 5 then 0.5 else 0.25 end)
      + 0.8 * ((case when e.price is not null then 0.4 else 0 end) + (case when length(coalesce(e.description, '')) > 80 then 0.3 else 0 end) + (case when e.image_count > 0 then 0.3 else 0 end))
      + 0.9 * least(1, 0.4 + 0.1 * least(e.p_completed, 4) + (case when e.p_reviews > 0 and e.p_rating >= 4.5 then 0.2 else 0 end))
      + 1.4 * (case when not e.has_trades then 0.5 when e.trade_ok then 1 else 0.2 end)
      + 0.7 * (case when e.due_date is null then 0 when e.due_date - v_today <= 1 then 1 when e.due_date - v_today <= 3 then 0.5 else 0 end)
      )::numeric, 4) as sc
    from enriched e
  )
  select s.id, s.user_id, s.title, s.description, s.category, s.location, s.price, s.currency, s.status, s.created_at,
         s.lat, s.lng, s.remote, s.cover_url, s.image_count, s.bid_count, s.dist, s.trank,
         s.p_rating, s.p_reviews, s.p_completed, s.sc, count(*) over (),
         s.date_type, s.due_date, s.time_of_day, s.travel_allowance
  from scored s
  order by
    case when v_sort = 'recommended' then s.sc end desc nulls last,
    case when v_sort = 'closest' then coalesce(s.dist, 1e9) end asc,
    case when v_sort = 'offers' then s.bid_count end desc,
    case when v_sort = 'price_asc' then coalesce(s.price, 1e12) end asc,
    case when v_sort = 'price_desc' then s.price end desc nulls last,
    case when v_sort = 'oldest' then s.created_at end asc,
    case when v_sort = 'due_soon' then coalesce(s.due_date, date '9999-12-31') end asc,
    s.created_at desc
  limit v_lim offset v_off;
end $$;
revoke all on function public.search_listings_core(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer, boolean, extensions.vector, uuid[]) from public, anon, authenticated;

-- Javna pretraga. Isti parametri kao prije, plus neobavezni vektor upita (p_embedding, tekst "[0.1,...]").
--  1. grad iz upita postaje mjesto (krug 40 km), ako aplikacija nije već poslala mjesto;
--  2. stroga pretraga (sve riječi);
--  3. ako je stroga dala manje od 5 oglasa na prvoj strani: ispod njih opuštena (bilo koja riječ, greške, značenje);
--  4. ako u krugu oko grada iz upita nema ničega: ista pretraga bez kruga, najbliži prvi po rangu.
drop function if exists public.search_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer);
drop function if exists public.search_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer, text);
create or replace function public.search_listings(
  p_query text default '', p_category text default '',
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_include_remote boolean default true, p_min_price numeric default null, p_max_price numeric default null,
  p_has_budget boolean default false, p_no_offers boolean default false,
  p_sort text default 'recommended', p_limit integer default 50, p_offset integer default 0,
  p_embedding text default null)
returns table(
  id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text,
  status text, created_at timestamptz, lat double precision, lng double precision, is_remote boolean,
  cover_url text, image_count integer, offers integer, distance_km double precision, text_rank real,
  poster_rating numeric, poster_reviews integer, poster_completed integer, score numeric, total_count bigint,
  date_type text, due_date date, time_of_day text[], travel_allowance numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_has_place boolean := false;
  v_query text := left(coalesce(p_query, ''), 200);
  v_lat double precision := p_lat;
  v_lng double precision := p_lng;
  v_radius double precision := p_radius_km;
  v_place record;
  v_emb extensions.vector;
  v_seen uuid[] := '{}';
  v_count integer := 0;
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  r record;
begin
  begin
    v_emb := nullif(btrim(coalesce(p_embedding, '')), '')::extensions.vector;
    if v_emb is not null and extensions.vector_dims(v_emb) <> 512 then v_emb := null; end if;
  exception when others then v_emb := null;
  end;

  -- "moler mostar": grad iz upita, osim kad je osoba sama odabrala krug oko mjesta (tačka bez kruga je samo
  -- njen dom za redoslijed po udaljenosti i ne smije pregaziti grad koji je upisala)
  if (p_lat is null or coalesce(p_radius_km, 0) <= 0) and btrim(v_query) <> '' then
    select * into v_place from public.search_split_place(v_query);
    if found then
      v_has_place := true; v_query := v_place.rest; v_lat := v_place.lat; v_lng := v_place.lng; v_radius := 40;
    end if;
  end if;

  for r in select * from public.search_listings_core(v_query, p_category, v_lat, v_lng, v_radius, p_include_remote, p_min_price, p_max_price, p_has_budget, p_no_offers, p_sort, v_lim, p_offset, false, null, null) loop
    id := r.id; user_id := r.user_id; title := r.title; description := r.description; category := r.category; location := r.location;
    price := r.price; currency := r.currency; status := r.status; created_at := r.created_at; lat := r.lat; lng := r.lng;
    is_remote := r.is_remote; cover_url := r.cover_url; image_count := r.image_count; offers := r.offers; distance_km := r.distance_km;
    text_rank := r.text_rank; poster_rating := r.poster_rating; poster_reviews := r.poster_reviews; poster_completed := r.poster_completed;
    score := r.score; total_count := r.total_count; date_type := r.date_type; due_date := r.due_date; time_of_day := r.time_of_day;
    travel_allowance := r.travel_allowance;
    v_seen := v_seen || r.id; v_count := v_count + 1;
    return next;
  end loop;

  if btrim(v_query) <> '' and coalesce(p_offset, 0) = 0 and v_count < least(5, v_lim) then
    for r in select * from public.search_listings_core(v_query, p_category, v_lat, v_lng, v_radius, p_include_remote, p_min_price, p_max_price, p_has_budget, p_no_offers, p_sort, v_lim - v_count, 0, true, v_emb, v_seen) loop
      id := r.id; user_id := r.user_id; title := r.title; description := r.description; category := r.category; location := r.location;
      price := r.price; currency := r.currency; status := r.status; created_at := r.created_at; lat := r.lat; lng := r.lng;
      is_remote := r.is_remote; cover_url := r.cover_url; image_count := r.image_count; offers := r.offers; distance_km := r.distance_km;
      text_rank := r.text_rank; poster_rating := r.poster_rating; poster_reviews := r.poster_reviews; poster_completed := r.poster_completed;
      score := r.score; total_count := v_count + r.total_count; date_type := r.date_type; due_date := r.due_date; time_of_day := r.time_of_day;
      travel_allowance := r.travel_allowance;
      v_seen := v_seen || r.id;
      return next;
    end loop;
    v_count := cardinality(v_seen);
  end if;

  -- grad iz upita, a u krugu nema ništa: pokaži iste oglase iz cijele BiH, bliži više
  if v_count = 0 and v_has_place then
    return query select * from public.search_listings(v_query, p_category, v_place.lat, v_place.lng, 0, p_include_remote, p_min_price, p_max_price, p_has_budget, p_no_offers, p_sort, p_limit, p_offset, p_embedding);
  end if;
end $$;
grant execute on function public.search_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer, text) to anon, authenticated;
