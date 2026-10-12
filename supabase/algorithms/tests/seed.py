# Generates realistic Bosnian test data for the Zadatak ranking functions.
# Every listing carries an intent tag (L-xx) so the eval can check relevance.
import json, os, uuid, random
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
random.seed(7)

def uid(tag):
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, 'poso-test-' + tag))

# (tag, title, description, category, location, price, days_old, bids, photos)
L = [
 ('krecenje1', 'Krečenje dvosobnog stana', 'Treba okrečiti stan od 55 kvadrata, zidovi i plafon, bijela boja. Namještaj ćemo pomjeriti.', 'Moler/farbanje', 'Sarajevo', 400, 1, 0, 1),
 ('krecenje2', 'Farbanje zidova u dnevnom boravku', 'Dnevni boravak 25m2, jedna zid u tamnoj boji, ostalo bijelo. Imam boju.', 'Moler/farbanje', 'Tuzla', 150, 3, 2, 0),
 ('krecenje3', 'Gletovanje i krečenje kuhinje', 'Kuhinja ima fleke od vlage, potrebno gletovanje i dva sloja boje.', 'Moler/farbanje', 'Zenica', 250, 6, 1, 1),
 ('krecenje4', 'Moler za hodnik i stepenište zgrade', 'Stambena zajednica traži molera za hodnik, 4 sprata.', 'Renoviranje i građevinski radovi', 'Mostar', 900, 2, 3, 0),
 ('ciscenje1', 'Generalno čišćenje stana nakon renoviranja', 'Stan 70m2, prašina od radova, prozori, podovi i kupatilo.', 'Čišćenje', 'Sarajevo', 120, 0, 1, 1),
 ('ciscenje2', 'Čistačica jednom sedmično', 'Tražim osobu za redovno spremanje kuće petkom, 3 sata.', 'Čišćenje', 'Banja Luka', 60, 4, 4, 0),
 ('ciscenje3', 'Pranje prozora i balkonskih staklenih vrata', 'Šest prozora i dvoja balkonska vrata, treći sprat.', 'Čišćenje', 'Ilidža', 50, 1, 0, 0),
 ('ciscenje4', 'Dubinsko pranje tepiha i ugaone garniture', 'Ugaona garnitura od štofa i dva tepiha, dolazak na adresu.', 'Čišćenje', 'Sarajevo', 80, 2, 0, 1),
 ('selidba1', 'Selidba iz Sarajeva u Mostar', 'Selimo dvosoban stan, trebaju dva radnika i kombi ili kamion.', 'Selidbe i transport', 'Sarajevo', 500, 1, 2, 0),
 ('selidba2', 'Preseljenje garsonjere unutar grada', 'Mali stan, krevet, ormar, veš mašina, desetak kutija.', 'Selidbe i transport', 'Banja Luka', 150, 3, 1, 0),
 ('selidba3', 'Prevoz kauča i frižidera kombijem', 'Treba prevesti kauč i frižider sa Otoke na Dobrinju, nošenje na 4. sprat bez lifta.', 'Prevoz i dostava', 'Sarajevo', 70, 0, 0, 1),
 ('selidba4', 'Odvoz starog namještaja na deponiju', 'Stari ormari i kreveti, treba utovariti i odvesti.', 'Selidbe i transport', 'Tuzla', 100, 5, 0, 0),
 ('vodo1', 'Curi slavina u kupatilu', 'Slavina na lavabou kaplje stalno, vjerovatno treba zamijeniti dihtung ili cijelu slavinu.', 'Vodoinstalater', 'Sarajevo', 40, 0, 0, 0),
 ('vodo2', 'Popravka bojlera, ne grije vodu', 'Bojler Gorenje 80l ne grije, osigurač ne iskače. Hitno.', 'Vodoinstalater', 'Zenica', 80, 1, 1, 0),
 ('vodo3', 'Zamjena WC šolje i vodokotlića', 'Kupljena nova šolja i vodokotlić, treba demontirati stare i montirati nove.', 'Vodoinstalater', 'Mostar', 120, 2, 0, 1),
 ('vodo4', 'Začepljen odvod u kuhinji', 'Sudopera ne odvodi vodu, probali smo sredstva, ne pomaže.', 'Majstor za sve', 'Bihać', 50, 1, 0, 0),
 ('vodo5', 'Pukla cijev u zidu, curi voda kod komšije', 'Hitno treba majstor, voda curi u stan ispod.', 'Majstor za sve', 'Sarajevo', None, 0, 0, 0),
 ('struja1', 'Zamjena osigurača i razvodne table', 'Stara razvodna tabla sa topljivim osiguračima, mijenjati na automatske.', 'Električar', 'Sarajevo', 300, 2, 1, 0),
 ('struja2', 'Ugradnja rasvjete i utičnica u novom stanu', 'Dvadeset utičnica i 8 rasvjetnih tijela, LED paneli u kuhinji.', 'Električar', 'Banja Luka', 400, 4, 2, 1),
 ('struja3', 'Nestaje struje u pola stana', 'Kad uključim šporet izbaci osigurač, treba pronaći kvar na instalaciji.', 'Majstor za sve', 'Tuzla', None, 0, 0, 0),
 ('struja4', 'Postavljanje lustera i zidnih lampi', 'Tri lustera i četiri zidne lampe, plafon 2.8m.', 'Električar', 'Mostar', 60, 3, 0, 0),
 ('klima1', 'Montaža klima uređaja 12000 BTU', 'Kupljena inverter klima, montaža na drugi sprat, bušenje kroz zid.', 'Klimatizacija i grijanje', 'Sarajevo', 150, 1, 3, 0),
 ('klima2', 'Servis i čišćenje klime prije ljeta', 'Dvije klime, dezinfekcija i dopuna freona ako treba.', 'Klimatizacija i grijanje', 'Mostar', 80, 2, 0, 0),
 ('klima3', 'Klima ne hladi, curi voda iz unutrašnje jedinice', 'Klima Vivax, kaplje voda i puše topao zrak.', 'Majstor za sve', 'Zenica', None, 1, 0, 0),
 ('namjestaj1', 'Sklapanje IKEA ormara PAX', 'Ormar 2 metra sa kliznim vratima, svi dijelovi u kutijama.', 'Montaža namještaja', 'Sarajevo', 70, 1, 1, 0),
 ('namjestaj2', 'Montaža kuhinje po mjeri', 'Elementi kuhinje stigli, treba montaža, rezanje radne ploče i ugradnja sudopere.', 'Montaža namještaja', 'Tuzla', 250, 3, 0, 1),
 ('namjestaj3', 'Sklapanje kreveta i komode iz Jysk-a', 'Bračni krevet i komoda sa 6 ladica.', 'Montaža namještaja', 'Banja Luka', 50, 2, 0, 0),
 ('stolar1', 'Izrada ugradbenog ormara u hodniku', 'Ormar od iverice po mjeri, 2.4m x 2.6m, sa ogledalom.', 'Stolarski radovi', 'Sarajevo', 1200, 5, 2, 1),
 ('stolar2', 'Popravka drvenih vrata koja se ne zatvaraju', 'Unutrašnja vrata zapinju, šarke popustile.', 'Stolarski radovi', 'Visoko', 40, 1, 0, 0),
 ('reno1', 'Postavljanje laminata u dvije sobe', '35m2 laminata, podloga i lajsne, stari tepisi već skinuti.', 'Renoviranje i građevinski radovi', 'Sarajevo', 350, 2, 1, 0),
 ('reno2', 'Keramičar za kupatilo, pločice zid i pod', 'Kupatilo 5m2, skidanje starih pločica i postavljanje novih.', 'Renoviranje i građevinski radovi', 'Tuzla', 900, 4, 2, 1),
 ('reno3', 'Adaptacija kuhinje, rušenje zida', 'Spajanje kuhinje i dnevnog boravka, nenosivi zid.', 'Renoviranje i građevinski radovi', 'Mostar', 1500, 6, 0, 1),
 ('basta1', 'Košenje trave u dvorištu', 'Dvorište oko 600m2, trava visoka, imam kosilicu.', 'Baštovanstvo', 'Zenica', 40, 0, 0, 0),
 ('basta2', 'Orezivanje voćki i živice', 'Desetak voćaka i živa ograda 30m.', 'Baštovanstvo', 'Gradačac', 100, 3, 0, 0),
 ('djeca1', 'Dadilja za dijete od 3 godine', 'Popodne od 15 do 19h radnim danima, Grbavica.', 'Čuvanje djece', 'Sarajevo', 400, 2, 3, 0),
 ('djeca2', 'Čuvanje djece subotom uveče', 'Dvoje djece 5 i 8 godina, od 19 do 23h.', 'Čuvanje djece', 'Banja Luka', 30, 1, 0, 0),
 ('ljub1', 'Šetanje psa dva puta dnevno', 'Labrador, 2 godine, šetnja ujutro i uveče dok smo na putu.', 'Čuvanje ljubimaca', 'Sarajevo', 100, 1, 1, 0),
 ('ljub2', 'Čuvanje mačke 10 dana', 'Hranjenje i čišćenje pijeska, dolazak jednom dnevno.', 'Čuvanje ljubimaca', 'Mostar', 80, 2, 0, 0),
 ('ljub3', 'Šišanje i kupanje psa', 'Pudla, treba grooming, može dolazak kući.', 'Čuvanje ljubimaca', 'Tuzla', 40, 3, 0, 1),
 ('instr1', 'Instrukcije iz matematike za srednju školu', 'Treći razred gimnazije, priprema za maturu, dva puta sedmično.', 'Instrukcije/podučavanje', 'Sarajevo', 20, 1, 2, 0),
 ('instr2', 'Pomoć oko fizike za osnovca', 'Osmi razred, zadaće i kontrolni.', 'Instrukcije/podučavanje', 'Online / na daljinu', 15, 2, 0, 0),
 ('jezik1', 'Časovi engleskog jezika za odrasle', 'Nivo B1, konverzacija, priprema za posao u inostranstvu.', 'Časovi jezika', 'Online / na daljinu', 25, 1, 1, 0),
 ('jezik2', 'Učenje njemačkog za vozače', 'Treba mi njemački A2 za posao u Njemačkoj, ubrzani kurs.', 'Časovi jezika', 'Bihać', 300, 4, 0, 0),
 ('it1', 'Laptop se ne pali, treba popravka', 'HP laptop, punjač radi ali laptop ne reaguje.', 'IT podrška', 'Sarajevo', None, 0, 0, 0),
 ('it2', 'Instalacija Windowsa i programa', 'Formatiranje računara, instalacija Windows 11 i Office paketa.', 'IT podrška', 'Zenica', 40, 2, 1, 0),
 ('it3', 'Postavljanje WiFi mreže u kući na sprat', 'Signal ne dopire na drugi sprat, treba mesh ili repetitor.', 'IT podrška', 'Mostar', 80, 3, 0, 0),
 ('dizajn1', 'Izrada logotipa za kafić', 'Novi kafić u centru, treba logo i meni.', 'Dizajn i kreativne usluge', 'Online / na daljinu', 200, 2, 4, 0),
 ('web1', 'Izrada web stranice za frizerski salon', 'Jednostavna stranica sa cjenovnikom i zakazivanjem.', 'Marketing i digitalne usluge', 'Online / na daljinu', 600, 3, 5, 0),
 ('foto1', 'Fotograf za vjenčanje u junu', 'Cijeli dan, crkva i sala, oko 150 gostiju.', 'Fotografisanje i video', 'Mostar', 1000, 5, 3, 0),
 ('foto2', 'Snimanje dronom za oglas kuće', 'Kuća na prodaju, trebaju fotografije i kratki video iz zraka.', 'Fotografisanje i video', 'Bijeljina', 150, 2, 0, 0),
 ('event1', 'Organizacija dječijeg rođendana', 'Animator za 15 djece, igre i maske, 2 sata.', 'Event organizacija', 'Sarajevo', 150, 1, 1, 0),
 ('catering1', 'Torta i kolači za rođendan', 'Torta za 30 osoba i sitni kolači.', 'Catering i kuvanje', 'Tuzla', 120, 2, 0, 1),
 ('catering2', 'Kuhanje ručka za 40 radnika', 'Topli obrok svaki dan za građevinsku firmu.', 'Catering i kuvanje', 'Zenica', 2000, 6, 1, 0),
 ('ljepota1', 'Šminkanje i frizura za maturu', 'Maturska večer u petak, dolazak kući.', 'Ljepota i wellness', 'Sarajevo', 80, 0, 2, 0),
 ('ljepota2', 'Frizer koji dolazi kući za stariju osobu', 'Šišanje i farbanje kose za baku koja ne može izaći.', 'Ljepota i wellness', 'Banja Luka', 30, 3, 0, 0),
 ('fit1', 'Personalni trener za mršavljenje', 'Treninzi tri puta sedmično u teretani ili parku.', 'Fitness treneri', 'Sarajevo', 200, 2, 1, 0),
 ('auto1', 'Zamjena ljetnih guma i balansiranje', 'Golf 7, gume imam, treba skinuti i staviti.', 'Automehaničar/auto usluge', 'Sarajevo', 40, 1, 0, 0),
 ('auto2', 'Auto neće da upali, akumulator ili anlaser', 'Passat B6 dizel, ujutro ne pali, kliktanje.', 'Automehaničar/auto usluge', 'Tuzla', None, 0, 0, 0),
 ('auto3', 'Mali servis automobila, ulje i filteri', 'Škoda Octavia 2015, mali servis.', 'Automehaničar/auto usluge', 'Banja Luka', 120, 3, 1, 0),
 ('pravo1', 'Savjet advokata oko ugovora o najmu', 'Stanodavac ne vraća depozit, trebam pravni savjet.', 'Pravni savjeti', 'Online / na daljinu', 50, 2, 0, 0),
 ('knjig1', 'Knjigovođa za mali d.o.o.', 'Mjesečno knjigovodstvo, 20 faktura mjesečno, PDV obveznik.', 'Knjigovodstvo i finansije', 'Sarajevo', 150, 4, 2, 0),
 ('dostava1', 'Dostava paketa iz Sarajeva u Tuzlu danas', 'Mali paket do 5kg, hitno danas poslijepodne.', 'Prevoz i dostava', 'Sarajevo', 40, 0, 0, 0),
 ('dostava2', 'Kupovina i dostava namirnica za starije', 'Jednom sedmično kupiti namirnice i donijeti na adresu.', 'Prevoz i dostava', 'Mostar', 20, 1, 0, 0),
 ('ostalo1', 'Pomoć oko prijave na biro i papira', 'Treba neko da ide sa mnom po dokumente u općinu.', 'Ostalo', 'Sarajevo', 30, 1, 0, 0),
 ('kombo1', 'Majstor za sitne popravke po stanu', 'Objesiti police, zamijeniti kvaku, silikon u kupatilu, pričvrstiti karniše.', 'Majstor za sve', 'Sarajevo', 80, 1, 1, 0),
 ('remote_ekav', 'Prevod dokumenata sa nemačkog', 'Treba prevesti diplomu i uverenje sa nemačkog jezika.', 'Ostalo', 'Online / na daljinu', 60, 2, 0, 0),
]

# providers: (tag, name, city, trades, bio, rating list, completed, verified, portfolio, reply_min, joined_days)
P = [
 ('p_moler_sa', 'Senad Hodžić', 'Sarajevo', ['Moler/farbanje'], 'Moler sa 15 godina iskustva, krečenje, gletovanje, dekorativne tehnike.', [5,5,4,5], 6, True, 3, 20, 400),
 ('p_moler_tz', 'Mirza Begić', 'Tuzla', ['Moler/farbanje', 'Renoviranje i građevinski radovi'], 'Krečenje i farbanje stanova, fasade.', [4,5], 2, False, 1, 90, 200),
 ('p_moler_new_mo', 'Ivan Kovač', 'Mostar', ['Moler/farbanje'], 'Mladi moler, brz i uredan.', [], 0, False, 0, None, 10),
 ('p_cist_sa', 'Amra Selimović', 'Sarajevo', ['Čišćenje'], 'Čišćenje stanova i poslovnih prostora, generalno spremanje.', [5,5,5,5,5,5,5,5,5,5,5,4], 15, True, 5, 5, 500),
 ('p_cist_bl', 'Dragana Petrović', 'Banja Luka', ['Čišćenje'], 'Redovno održavanje domaćinstva.', [5,4,5], 3, True, 0, 30, 300),
 ('p_seli_sa', 'Kemal Mujić', 'Sarajevo', ['Selidbe i transport', 'Prevoz i dostava'], 'Kombi i dva radnika, selidbe po cijeloj BiH.', [5,5,4,5,5], 9, True, 2, 15, 600),
 ('p_seli_bl', 'Nenad Jović', 'Banja Luka', ['Selidbe i transport'], 'Kamion 7t, preseljenja i odvoz.', [4,4], 2, False, 0, 120, 150),
 ('p_vodo_sa', 'Haris Delić', 'Sarajevo', ['Vodoinstalater'], 'Vodoinstalaterski radovi, bojleri, odvodi, hitne intervencije 0-24.', [5,4,5], 4, True, 1, 10, 250),
 ('p_vodo_ze', 'Edin Salkić', 'Zenica', ['Vodoinstalater', 'Klimatizacija i grijanje'], 'Bojleri, centralno grijanje, klime.', [5], 1, False, 0, 45, 60),
 ('p_vodo_mo', 'Ante Marić', 'Mostar', ['Vodoinstalater'], 'Sanitarije, kupatila po sistemu ključ u ruke.', [], 0, False, 0, None, 5),
 ('p_struja_sa', 'Adnan Kurtović', 'Sarajevo', ['Električar'], 'Elektroinstalacije, razvodne table, rasvjeta. Licenca.', [5,5], 3, True, 2, 25, 300),
 ('p_struja_mo', 'Josip Bevanda', 'Mostar', ['Električar'], 'Električar, kućne instalacije i pametna rasvjeta.', [4], 1, False, 0, 60, 100),
 ('p_struja_bl', 'Saša Lukić', 'Banjaluka', ['Električar'], 'Električne instalacije stanova i kuća.', [5,5,5], 3, True, 1, 30, 200),
 ('p_klima_sa', 'Elvis Hasanović', 'Sarajevo', ['Klimatizacija i grijanje'], 'Montaža i servis klima uređaja svih proizvođača.', [5,5,5,5], 5, True, 2, 15, 350),
 ('p_namj_sa', 'Dino Mehmedović', 'Sarajevo', ['Montaža namještaja', 'Stolarski radovi'], 'Sklapanje IKEA, Jysk, Lesnina namještaja, ugradbeni ormari.', [5,5,4], 5, True, 4, 20, 300),
 ('p_namj_tz', 'Alen Husić', 'Tuzla', ['Montaža namještaja'], 'Montaža kuhinja i plakara.', [4,5], 2, False, 1, 60, 120),
 ('p_reno_tz', 'Zlatan Osmanović', 'Tuzla', ['Renoviranje i građevinski radovi'], 'Keramičar, postavljanje pločica, adaptacije kupatila.', [5,5,5], 4, True, 3, 40, 400),
 ('p_basta_ze', 'Fikret Avdić', 'Zenica', ['Baštovanstvo'], 'Košenje, orezivanje, uređenje dvorišta.', [5], 1, False, 0, 90, 80),
 ('p_dadilja_sa', 'Lejla Imamović', 'Sarajevo', ['Čuvanje djece'], 'Dadilja, studentica predškolskog odgoja.', [5,5], 2, True, 0, 10, 100),
 ('p_ljub_sa', 'Nina Babić', 'Sarajevo', ['Čuvanje ljubimaca'], 'Šetanje i čuvanje pasa i mačaka.', [5,5,5], 3, False, 1, 15, 150),
 ('p_instr_sa', 'Tarik Zukić', 'Sarajevo', ['Instrukcije/podučavanje'], 'Instrukcije iz matematike i fizike, magistar matematike.', [5,5,5,4], 4, True, 0, 20, 300),
 ('p_jezik_on', 'Maja Šarić', 'Online', ['Časovi jezika'], 'Engleski i njemački, online časovi.', [5,5], 2, False, 0, 30, 200),
 ('p_it_sa', 'Emir Begović', 'Sarajevo', ['IT podrška'], 'Servis računara i laptopa, mreže.', [4,5], 2, False, 0, 60, 200),
 ('p_auto_tz', 'Samir Ibrić', 'Tuzla', ['Automehaničar/auto usluge'], 'Automehaničar, dijagnostika i servis.', [5,4,5], 3, True, 0, 30, 300),
 ('p_frizer_bl', 'Jelena Savić', 'Banja Luka', ['Ljepota i wellness'], 'Frizerka, dolazak na kućnu adresu.', [5], 1, False, 0, 20, 90),
 # a "star" generalist who is not an electrician but has everything else maxed
 ('p_star_cist_mo', 'Azra Čolić', 'Mostar', ['Čišćenje'], 'Čišćenje, top ocjene.', [5]*25, 20, True, 5, 3, 700),
 ('p_majstor_sa', 'Muhamed Karić', 'Sarajevo', ['Majstor za sve'], 'Sitne popravke po stanu, police, kvake, silikoni, sitni vodoinstalaterski i električarski radovi.', [5,5,4,5,5], 6, True, 2, 15, 400),
]
clients = ['c1', 'c2', 'c3', 'c4']

out = []
w = out.append
w("begin; set local session_replication_role = replica; truncate auth.users, user_badges, listings, profiles cascade;")
for t in clients + [p[0] for p in P]:
    w(f"insert into auth.users (id, email, created_at) values ('{uid(t)}', '{t}@test.poso', now()) on conflict do nothing;")
def q(s): return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
for i, c in enumerate(clients):
    w(f"insert into profiles (user_id, email, full_name, city, account_type, member_id, account_status, created_at) values ('{uid(c)}', '{c}@test.poso', 'Klijent {i}', 'Sarajevo', 'client', 'C{i:05d}', 'active', now() - interval '200 days');")
for i, p in enumerate(P):
    tag, name, city, trades, bio, ratings, completed, ver, port, reply, joined = p
    tr = 'array[' + ','.join(q(x) for x in trades) + ']::text[]'
    w(f"insert into profiles (user_id, email, full_name, city, bio, trades, account_type, member_id, account_status, created_at) values ('{uid(tag)}', '{tag}@test.poso', {q(name)}, {q(city)}, {q(bio)}, {tr}, 'provider', 'P{i:05d}', 'active', now() - interval '{joined} days');")
    if ver:
        w(f"insert into user_badges (user_id, badge_id) select '{uid(tag)}', id from badges where code = 'verified' on conflict do nothing;")
    for k in range(port):
        w(f"insert into portfolio_items (user_id, media_url, media_type) values ('{uid(tag)}', 'x{k}.jpg', 'image');")
    # completed jobs: listing completed + accepted bid + review
    for k in range(max(completed, len(ratings))):
        lid = uid(f'{tag}-done-{k}')
        w(f"insert into listings (id, user_id, title, description, category, location, price, status, created_at) values ('{lid}', '{uid(clients[k % 4])}', 'Završen posao {k}', 'stari posao', {q(trades[0])}, {q(city)}, 100, 'completed', now() - interval '{30 + k} days');")
        w(f"insert into bids (listing_id, bidder_id, amount, message, status, created_at) values ('{lid}', '{uid(tag)}', 100, 'ponuda', 'accepted', now() - interval '{30 + k} days' + interval '2 hours');")
        if k < len(ratings):
            w(f"insert into reviews (listing_id, reviewer_id, reviewee_id, rating, comment) values ('{lid}', '{uid(clients[k % 4])}', '{uid(tag)}', {ratings[k]}, 'ok');")
        if reply is not None:
            cid = uid(f'{tag}-conv-{k}')
            w(f"insert into conversations (id, participant_one, participant_two, listing_id) values ('{cid}', '{uid(clients[k % 4])}', '{uid(tag)}', '{lid}');")
            w(f"insert into messages (conversation_id, sender_id, receiver_id, content, created_at) values ('{cid}', '{uid(clients[k % 4])}', '{uid(tag)}', 'pozdrav', now() - interval '{30 + k} days');")
            w(f"insert into messages (conversation_id, sender_id, receiver_id, content, created_at) values ('{cid}', '{uid(tag)}', '{uid(clients[k % 4])}', 'zdravo', now() - interval '{30 + k} days' + interval '{reply} minutes');")

for j, l in enumerate(L):
    tag, title, desc, cat, loc, price, days, bids, photos = l
    lid = uid('L-' + tag)
    w(f"insert into listings (id, user_id, title, description, category, location, price, currency, status, created_at, lat, lng, bid_count) "
      f"select '{lid}', '{uid(clients[j % 4])}', {q(title)}, {q(desc)}, {q(cat)}, {q(loc)}, {q(price)}, 'KM', 'published', now() - interval '{days} days' - interval '{j} minutes', c.lat, c.lng, {bids} "
      f"from (select 1) one left join lateral coords_for_location({q(loc)}) c on true;")
    for k in range(photos):
        w(f"insert into listing_images (listing_id, user_id, url, position) values ('{lid}', '{uid(clients[j % 4])}', 'img{k}.jpg', {k});")
w("commit;")
w("refresh materialized view provider_stats;")
open(os.path.join(OUT, 'seed.sql'), 'w').write('\n'.join(out) + '\n')
json.dump({'listings': {uid('L-' + l[0]): l[0] for l in L}, 'providers': {uid(p[0]): p[0] for p in P}, 'clients': {c: uid(c) for c in clients}},
          open(os.path.join(OUT, 'ids.json'), 'w'), indent=1)
print(len(L), 'listings', len(P), 'providers')
