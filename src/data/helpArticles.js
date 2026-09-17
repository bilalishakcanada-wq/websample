// Help centre content. Every article has keywords so the support assistant can
// answer common questions instantly; the team steps in for everything else.
export const HELP_AUDIENCES = [
  { id: 'client', label: 'Ja sam klijent', hint: 'Objavljujem poslove i tražim majstore' },
  { id: 'provider', label: 'Ja sam izvođač', hint: 'Radim poslove i zarađujem' },
  { id: 'rules', label: 'Pravila Poso.ba', hint: 'Sigurnost, Pravilo #1, nalog' },
]

export const HELP_ARTICLES = [
  // ---- clients ----
  { id: 'post-job', audience: 'client', q: 'Kako objavim posao?', keywords: ['objav', 'posao', 'oglas', 'kako da postavim', 'kreir'],
    a: 'Klikni „Objavi posao“ u vrhu stranice. Prolaziš 5 kratkih koraka: naslov i rok, lokacija, detalji, slike problema i budžet. Objava je besplatna, a ponude stižu odmah u „Moj nalog“ i na email.' },
  { id: 'photos', audience: 'client', q: 'Mogu li dodati slike problema?', keywords: ['slik', 'fotograf', 'foto', 'upload', 'učita'],
    a: 'Da — u koraku „Slike“ dodaj do 8 slika (JPG, PNG ili WEBP do 5 MB). Izvođači daju tačnije ponude kad vide o čemu se radi. Slike sa brojem telefona ili društvenim mrežama automatski se uklanjaju (Pravilo #1).' },
  { id: 'cost', audience: 'client', q: 'Koliko košta objava posla?', keywords: ['košta', 'cijen', 'besplat', 'plaćam objav', 'naplat'],
    a: 'Ništa. Objava posla, primanje ponuda i dopisivanje su potpuno besplatni za klijente. Poso.ba zarađuje malu naknadu od izvođača tek kad je posao uspješno završen.' },
  { id: 'choose', audience: 'client', q: 'Kako biram izvođača?', keywords: ['bira', 'odaber', 'ponud', 'prihvat', 'koga da'],
    a: 'Svaka ponuda ima cijenu i obrazloženje. Klikni na ime izvođača i vidiš javni profil: ocjene, uspješnost, značke (telefon, lična karta, licence), struke i portfolio. Kad ti odgovara — „Prihvati“. Tek tada se otključavaju poruke sa kontaktom.' },
  { id: 'pay-flow', audience: 'client', q: 'Kako radi plaćanje (Poso.ba Pay)?', keywords: ['plaćanj', 'placanj', 'plati', 'escrow', 'osigur', 'oslobod', 'kad plaćam', 'pay'],
    a: 'Kad prihvatiš ponudu, cijena posla se rezerviše sa tvog balansa i čuva na Poso.ba — izvođač vidi da je novac osiguran, ali ga ne dobija. Kad je posao urađen, izvođač klikne „Zatraži isplatu“, ti provjeriš i klikneš „Oslobodi uplatu“ — novac odmah ide izvođaču (umanjen za naknadu koju plaća on). Otkazivanje prije početka vraća ti pun iznos; ako se ne slažete, „Prijavi problem“ zamrzava novac dok Poso.ba tim ne odluči.' },
  { id: 'contact-unlock', audience: 'client', q: 'Kad dobijam kontakt izvođača?', keywords: ['kontakt', 'broj', 'telefon', 'nazvat', 'pozvat'],
    a: 'Tek nakon što prihvatiš ponudu. Do tada su brojevi telefona, emailovi i društvene mreže sakriveni u oba smjera — tako nema neželjenih poziva i svi radite pod istim uslovima.' },
  { id: 'edit-cancel', audience: 'client', q: 'Mogu li urediti ili otkazati posao?', keywords: ['uredi', 'izmijeni', 'otkaž', 'otkaz', 'obriš oglas', 'promijeni'],
    a: 'Da. Na stranici svog oglasa klikni „Uredi“ (naslov, opis, slike, budžet). Ako je izvođač već odabran, možeš označiti „Posao završen“ ili „Otkaži posao“ — otkazivanja se računaju u uspješnost obje strane, pa ih koristi pošteno.' },
  { id: 'review', audience: 'client', q: 'Kako ostavljam recenziju?', keywords: ['recenz', 'ocjen', 'ocijeni', 'zvjezd'],
    a: 'Kad označiš posao kao završen, pojavljuje se polje za ocjenu (1–5 zvjezdica) i komentar. Svaka recenzija je vezana za stvarno završen posao — zato im se može vjerovati.' },
  { id: 'dispute', audience: 'client', q: 'Izvođač nije došao ili je loše uradio posao — šta sad?', keywords: ['nije doš', 'prevar', 'loše', 'reklamac', 'spor', 'problem sa izvođ', 'nije zavr'],
    a: 'Prvo mu piši u porukama — većina se riješi dogovorom. Ako ne, otkaži posao uz razlog „izvođač nije došao / odustao“ i prijavi ga zastavicom na profilu ili oglasu. Naš tim pregleda svaku prijavu i po potrebi suspenduje nalog.' },

  // ---- providers ----
  { id: 'earn', audience: 'provider', q: 'Kako počinjem zarađivati?', keywords: ['zarad', 'počn', 'kako da radim', 'postan izvođ', 'majstor'],
    a: 'Registruj se, u „Moj nalog → Profil“ izaberi „Zaraditi novac“, u „Vještine“ označi struke i grad. Zatim „Pretraži poslove“ — pošalji ponudu sa cijenom i kratkim obrazloženjem. Preporučujemo da odmah verifikuješ telefon i dodaš sliku profila.' },
  { id: 'fees', audience: 'provider', q: 'Kolika je naknada i kako rade nivoi?', keywords: ['naknad', 'provizij', 'procen', 'nivo', 'bronz', 'srebr', 'zlat', 'platin', 'tier'],
    a: 'Naknada se skida samo sa isplaćenih poslova i zavisi od tvog nivoa u zadnjih 30 dana: Bronza 15 %, Srebro (500 KM+) 13 %, Zlato (1.500 KM+) 11 %, Platina (3.000 KM+) 9 %. Prije prihvatanja klijent vidi tačno koliko ti ostaje; procenat se zaključa u trenutku prihvatanja. Nivo vidiš u „Moj nalog → Ploča izvođača“.' },
  { id: 'get-paid', audience: 'provider', q: 'Kad i kako dobijam novac za posao?', keywords: ['isplat', 'kad dobijam', 'zatraži isplatu', 'oslobod', 'osigurana uplata', 'novac za posao'],
    a: 'Čim klijent prihvati tvoju ponudu, cijena je osigurana na Poso.ba — vidiš to na stranici posla. Kad završiš, klikni „Posao je urađen — zatraži isplatu“; klijent oslobodi uplatu i novac (bez naknade) odmah sjeda na tvoj balans u „Moj nalog → Balans“. Ako klijent ne reaguje ili se ne slažete, „Prijavi problem“ i tim odlučuje na osnovu poruka i slika.' },
  { id: 'badges', audience: 'provider', q: 'Kako dobijam značke?', keywords: ['značk', 'badge', 'oznak', 'verifikovan telefon', 'lična kart', 'licenc'],
    a: 'U „Moj nalog → Značke“. Telefon: potvrdi SMS kodom. Način plaćanja: dodaj IBAN u „Načini plaćanja“. Lična karta, uvjerenje o nekažnjavanju i licence (električar, vodoinstalater, plin, klima, građevina, vozačka): pošalji dokument, tim ga pregleda i značka se pojavi na profilu. Značke aktivnosti (Top ocjene, Bez greške, Lokalni heroj…) dolaze same iz tvog rada.' },
  { id: 'verification', audience: 'provider', q: 'Koliko traje verifikacija dokumenata?', keywords: ['verifik', 'dokument', 'koliko traje', 'na čekanju', 'odobr'],
    a: 'Obično isti ili sljedeći radni dan. Dok čekaš, u Značkama piše „Na čekanju“. Ako je dokument nečitak ili se ime ne poklapa sa profilom, zahtjev bude odbijen — pošalji ponovo jasniju sliku.' },
  { id: 'payouts', audience: 'provider', q: 'Kako primam isplate?', keywords: ['isplat', 'iban', 'račun', 'bank', 'novac', 'kad dobijam pare', 'uplat'],
    a: 'U „Moj nalog → Načini plaćanja → Primam uplate“ upiši ime vlasnika, banku i IBAN. Do pokretanja Poso.ba Pay plaćanje ide direktno između tebe i klijenta po dogovoru; u „Historiji plaćanja“ vidiš sve završene poslove i obračun naknade.' },
  { id: 'balance', audience: 'provider', q: 'Šta je balans na mom nalogu?', keywords: ['balans', 'stanje', 'saldo', 'novčanik', 'novcanik', 'pare na nalogu'],
    a: 'Balans je tvoj novac na Poso.ba — vidiš ga u „Moj nalog → Balans“ sa svakom uplatom, naknadom i isplatom. Iz balansa se naplaćuje naknada kad se posao završi; uplate, bonuse i povrate dodaje Poso.ba tim. Ako nešto ne štima, piši podršci sa svojim privatnim ID-om.' },
  { id: 'success-rate', audience: 'provider', q: 'Šta je uspješnost i kako je podižem?', keywords: ['uspješnost', 'procenat', 'success', 'rejting'],
    a: 'Uspješnost = završeni poslovi ÷ (završeni + otkazani tvojom krivicom). Diže je svaki posao koji klijent označi kao završen; ruši je otkazivanje nakon što si prihvaćen. Šalji ponude samo na poslove koje stvarno možeš uraditi.' },
  { id: 'portfolio', audience: 'provider', q: 'Kako dodajem portfolio radova?', keywords: ['portfolio', 'radov', 'galerij', 'moje slike'],
    a: '„Moj nalog → Portfolio“ — do 30 slika završenih radova. Vide se na tvom javnom profilu i značajno podižu šansu da te klijent odabere. Bez brojeva telefona na slikama.' },
  { id: 'recommendations', audience: 'provider', q: 'Zašto ne vidim neke poslove u preporukama?', keywords: ['preporuk', 'ne vidim', 'obavijest o poslov', 'alarm'],
    a: 'Preporuke gledaju tvoj grad, struke iz „Vještina“ i poslove na koje si već slao ponude. Ažuriraj grad i struke — preporuke i obavijesti odmah postaju tačnije.' },

  // ---- rules & account ----
  { id: 'rule-one', audience: 'rules', q: 'Šta je Pravilo #1?', keywords: ['pravilo', 'rule', 'instagram', 'viber', 'whatsapp', 'fejs', 'facebook', 'maskir', 'zašto je sakriven', 'zvjezdice u poruci'],
    a: 'Na Poso.ba se ne dijele brojevi telefona, emailovi, linkovi ni društvene mreže — ni u oglasu, ni u profilu, ni na slikama, ni u porukama prije prihvaćene ponude. Sistem ih automatski maskira i bilježi kršenje. Nakon 3 kršenja u 30 dana slijedi suspenzija od 7 dana, nakon 5 — 30 dana, nakon 7 — trajna.' },
  { id: 'suspended', audience: 'rules', q: 'Nalog mi je suspendovan — šta da radim?', keywords: ['suspend', 'ban', 'blokir', 'zabran', 'ne mogu objav'],
    a: 'U „Moj nalog“ vidiš razlog i do kada traje. Suspenzija se sama ukida kad istekne. Ako misliš da je greška, piši nam ovdje u podršci — tim pregleda dosije i može je ukinuti ranije.' },
  { id: 'safety', audience: 'rules', q: 'Kako ostajem siguran/na?', keywords: ['sigurn', 'prevar', 'scam', 'avans', 'unaprijed', 'kapar'],
    a: 'Dogovaraj i plaćaj kroz platformu, nikad ne šalji avans „unaprijed za materijal“ nepoznatoj osobi, provjeri značke i recenzije, i prijavi svaki sumnjiv zahtjev zastavicom. Naš tim i AI nadzor prate platformu 24/7.' },
  { id: 'report', audience: 'rules', q: 'Kako prijavim korisnika ili oglas?', keywords: ['prijav', 'zastav', 'report', 'sumnjiv'],
    a: 'Na svakom oglasu i profilu je ikona zastavice — opiši razlog i prijava odmah stiže našem timu. Prijave su anonimne prema drugoj strani.' },
  { id: 'login', audience: 'rules', q: 'Prijava preko Googlea ili Facebooka?', keywords: ['google', 'facebook', 'prijav se', 'login', 'lozink', 'zaborav'],
    a: 'Da — na stranici prijave klikni Google (ili Facebook kad je uključen). Zaboravljenu lozinku resetuješ preko „Zaboravljena lozinka?“; link stiže na email.' },
  { id: 'member-id', audience: 'rules', q: 'Šta je moj privatni ID (PB-XXXX-XXXX)?', keywords: ['privatni id', 'pb-', 'member id', 'identifik'],
    a: 'Svaki nalog dobija jedinstveni privatni ID. Vidiš ga samo ti (Profil) i naš tim — koristi ga kad pišeš podršci da te odmah pronađemo. Nikad ga ne dijeli javno.' },
  { id: 'delete', audience: 'rules', q: 'Kako brišem nalog?', keywords: ['obriš', 'brisanje', 'izbriš', 'ukloni nalog', 'deaktiv'],
    a: '„Moj nalog → Profil → Obriši moj nalog“. Brisanje je trajno: uklanja oglase, ponude, poruke i slike. Privatni ID ostaje u registru radi sigurnosti platforme.' },
  { id: 'notifications', audience: 'rules', q: 'Kako podešavam obavijesti?', keywords: ['obavijest', 'notifik', 'email obavijest', 'push'],
    a: '„Moj nalog → Postavke“ — uključi ili isključi email i push obavijesti. Zvono u vrhu stranice pokazuje sve nove događaje (ponude, poruke, značke, odgovore podrške).' },
]

const fold = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

/** Best-matching article for a free-text question, or null when nothing fits well enough. */
export function findHelpAnswer(text) {
  const needle = fold(text)
  if (needle.length < 4) return null
  let best = null
  for (const article of HELP_ARTICLES) {
    let score = 0
    for (const keyword of article.keywords) if (needle.includes(fold(keyword))) score += keyword.length > 4 ? 2 : 1
    for (const word of fold(article.q).split(/\W+/)) if (word.length > 4 && needle.includes(word)) score += 1
    if (score > (best?.score || 0)) best = { article, score }
  }
  return best && best.score >= 2 ? best.article : null
}

export function searchHelp(query, audience = '') {
  const needle = fold(query)
  return HELP_ARTICLES.filter((article) => (!audience || article.audience === audience) && (!needle || fold(`${article.q} ${article.a} ${article.keywords.join(' ')}`).includes(needle)))
}
