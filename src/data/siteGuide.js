/** Where every option on Zadatak lives, for the support assistant ("Zadatak asistent"): it is sent with each
 *  question so the assistant can point to the exact page, and the offline fallback matches it by keywords.
 *  `where` is how to get there on the site and in the app; keep it in step with the menus. */
export const SITE_GUIDE = [
  { path: '/objavi', title: 'Objavi posao', where: 'Dugme „Objavi posao“ u zaglavlju (u aplikaciji žuto dugme u sredini donje trake).', keywords: ['objav', 'novi posao', 'oglas', 'postav'] },
  { path: '/search', title: 'Pretraži poslove', where: '„Pretraži poslove“ u zaglavlju; lista i mapa, filteri za grad, kategoriju, cijenu i udaljenost.', keywords: ['pretra', 'nađi posao', 'nadji posao', 'mapa', 'filter'] },
  { path: '/moji-poslovi', title: 'Moji poslovi', where: 'Meni naloga → „Moji poslovi“ (u aplikaciji kartica „Poslovi“): tvoji oglasi, ponude i poslovi u toku.', keywords: ['moji poslovi', 'moj oglas', 'moje ponude', 'u toku'] },
  { path: '/messages', title: 'Poruke', where: 'Ikonica poruka u zaglavlju (u aplikaciji kartica „Poruke“).', keywords: ['poruk', 'chat', 'razgovor', 'dopis'] },
  { path: '/dashboard', title: 'Nadzorna ploča', where: 'Meni naloga → „Nadzorna ploča“: pregled oglasa, ponuda i preporuka.', keywords: ['ploča', 'ploca', 'pregled', 'dashboard'] },
  { path: '/account/profil', title: 'Profil', where: 'Moj nalog → „Profil“: ime, slika, grad, opis.', keywords: ['profil', 'slika', 'ime', 'opis', 'grad'] },
  { path: '/account/verifikacija', title: 'Verifikacija identiteta', where: 'Moj nalog → „Verifikacija“: lična karta ili pasoš; potrebna za objavu posla i slanje ponuda.', keywords: ['verifik', 'lična', 'licna', 'pasoš', 'pasos', 'identitet', 'dokument'] },
  { path: '/account/novcanik', title: 'Balans', where: 'Moj nalog → „Balans“: stanje, uplate, naknade i isplate.', keywords: ['balans', 'novčanik', 'novcanik', 'stanje', 'uplat', 'dopun'] },
  { path: '/account/placanja', title: 'Historija plaćanja', where: 'Moj nalog → „Historija plaćanja“: svaki plaćeni posao kroz Zadatak Pay.', keywords: ['historij', 'istorij', 'plaćen', 'placen', 'račun'] },
  { path: '/account/nacini-placanja', title: 'Načini plaćanja', where: 'Moj nalog → „Načini plaćanja“: račun za primanje isplata (IBAN).', keywords: ['iban', 'isplat', 'banka', 'račun za', 'nacin placanja', 'način plaćanja'] },
  { path: '/account/obavijesti', title: 'Obavijesti', where: 'Moj nalog → „Obavijesti“ (zvonce u zaglavlju).', keywords: ['obavijest', 'zvonce', 'notifik'] },
  { path: '/account/postavke-obavijesti', title: 'Postavke obavijesti', where: 'Moj nalog → Postavke → „Postavke obavijesti“: push, email i koje obavijesti primaš.', keywords: ['isključi obavij', 'iskljuci obavij', 'push', 'email obavij'] },
  { path: '/account/postavke', title: 'Postavke', where: 'Moj nalog → „Postavke“: nova lozinka, email i push obavijesti, istorija opomena za Pravilo #1.', keywords: ['postavk', 'lozink', 'šifr', 'sifr', 'opomen'] },
  { path: '/account/znacke', title: 'Značke', where: 'Moj nalog → „Značke“.', keywords: ['značk', 'znack', 'bedž', 'badge'] },
  { path: '/account/ploca', title: 'Ploča izvođača', where: 'Moj nalog → „Ploča izvođača“ (samo izvođači): nivo, naknada i zarada.', keywords: ['nivo', 'naknad', 'zarad', 'provizij'] },
  { path: '/account/vjestine', title: 'Vještine', where: 'Moj nalog → „Vještine“ (samo izvođači): struke i licence.', keywords: ['vješt', 'vjest', 'struk', 'licenc', 'zanat'] },
  { path: '/account/portfolio', title: 'Portfolio', where: 'Moj nalog → „Portfolio“ (samo izvođači): slike i video urađenih poslova.', keywords: ['portfolio', 'radovi', 'slike rad'] },
  { path: '/account/alarmi', title: 'Alarmi za poslove', where: 'Moj nalog → „Alarmi za poslove“ (samo izvođači): obavijest čim se objavi posao u tvojoj kategoriji i gradu.', keywords: ['alarm', 'novi poslovi', 'obavijesti o poslovima'] },
  { path: '/nivoi', title: 'Nivoi i naknade', where: 'Stranica „Nivoi“: kako naknada pada kako radiš više.', keywords: ['nivoi', 'tier'] },
  { path: '/zaradi', title: 'Zaradi novac', where: '„Postani izvođač“ u zaglavlju: kako početi raditi kao izvođač.', keywords: ['postani izvođač', 'postani izvodjac', 'zaradi', 'raditi kao'] },
  { path: '/kako-radi', title: 'Kako radi', where: '„Kako radi“ u zaglavlju.', keywords: ['kako radi', 'kako funkcion'] },
  { path: '/cijene', title: 'Planovi i cijene', where: '„Cijene“ u zaglavlju: šta je besplatno i koje su naknade.', keywords: ['cijen', 'košta', 'kosta', 'besplat', 'plan'] },
  { path: '/vodici', title: 'Vodiči za cijene', where: 'Footer → „Vodiči za cijene“: koliko koštaju poslovi po stvarnim oglasima.', keywords: ['vodič', 'vodic', 'koliko košta', 'prosjek'] },
  { path: '/pravila-zajednice', title: 'Pravila zajednice', where: 'Footer → „Pravila zajednice“ (Pravilo #1: bez kontakata van platforme).', keywords: ['pravil', 'zabran', 'kontakt van', 'strike', 'kazn'] },
  { path: '/pomoc', title: 'Pomoć', where: 'Footer → „Često postavljena pitanja“; ovaj chat je i tamo.', keywords: ['pomoć', 'pomoc', 'faq', 'pitanj'] },
  { path: '/kontakt', title: 'Kontakt', where: 'Footer → „Kontakt“: forma, odgovor stiže na tvoj email.', keywords: ['kontakt', 'javi', 'piši', 'pisi'] },
]

/** The guide entry whose keywords appear in the text, or null. */
export function findGuideEntry(text) {
  const t = String(text || '').toLowerCase()
  if (!/(gdje|gde|kako da|kako mogu|kako se|ne mogu naći|ne mogu naci|ne nalazim)/.test(t)) return null
  return SITE_GUIDE.find((entry) => entry.keywords.some((word) => t.includes(word))) || null
}
