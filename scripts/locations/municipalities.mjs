// Who's On First "county" ids for Bosnia and Herzegovina → today's municipality (općina / grad) name.
// WOF names are ASCII and use the 1990s split names ("Ilidza / Srpska Ilidza"); these are the names people
// use now. The canton/entity comes from the place's WOF region (REGIONS below).
export const MUNICIPALITIES = {
  1108758989: 'Banja Luka', 1108758991: 'Banovići', 1108758993: 'Bihać', 1108758995: 'Bijeljina',
  1108758997: 'Bileća', 1108758999: 'Kozarska Dubica', 1108759001: 'Gradiška', 1108759003: 'Bosanska Krupa',
  1108759007: 'Krupa na Uni', 1108759009: 'Brod', 1108759011: 'Novi Grad', 1108759013: 'Bosanski Petrovac',
  1108759015: 'Petrovac', 1108759017: 'Šamac', 1108759019: 'Bosansko Grahovo', 1108759021: 'Bratunac',
  1108759025: 'Brčko', 1108759027: 'Breza', 1108759029: 'Bugojno', 1108759031: 'Busovača',
  1108759033: 'Bužim', 1108759035: 'Čajniče', 1108759037: 'Čapljina', 1108759039: 'Cazin',
  1108759043: 'Čelić', 1108759045: 'Čelinac', 1108759047: 'Centar Sarajevo', 1108759049: 'Čitluk',
  1108759051: 'Derventa', 1108759053: 'Doboj', 1108759055: 'Doboj Istok', 1108759057: 'Doboj Jug',
  1108759061: 'Dobretići', 1108759063: 'Domaljevac-Šamac', 1108759065: 'Donji Vakuf', 1108759067: 'Drvar',
  1108759069: 'Istočni Drvar', 1108759071: 'Foča-Ustikolina', 1108759073: 'Foča', 1108759075: 'Fojnica',
  1108759079: 'Gacko', 1108759081: 'Glamoč', 1108759083: 'Goražde', 1108759085: 'Novo Goražde',
  1108759087: 'Gornji Vakuf-Uskoplje', 1108759089: 'Gračanica', 1108759091: 'Petrovo', 1108759093: 'Gradačac',
  1108759097: 'Pelagićevo', 1108759099: 'Grude', 1108759101: 'Hadžići', 1108759103: 'Han Pijesak',
  1108759105: 'Ilidža', 1108759107: 'Istočna Ilidža', 1108759109: 'Ilijaš', 1108759111: 'Jablanica',
  1108759115: 'Jajce', 1108759117: 'Jezero', 1108759119: 'Kakanj', 1108759121: 'Kalesija',
  1108759123: 'Osmaci', 1108759125: 'Kalinovik', 1108759127: 'Kiseljak', 1108759129: 'Kladanj',
  1108759133: 'Ključ', 1108759135: 'Ribnik', 1108759137: 'Konjic', 1108759139: 'Kostajnica',
  1108759141: 'Kotor Varoš', 1108759143: 'Kreševo', 1108759145: 'Kupres', 1108759147: 'Kupres (RS)',
  1108759151: 'Laktaši', 1108759153: 'Livno', 1108759155: 'Ljubinje', 1108759157: 'Ljubuški',
  1108759159: 'Lopare', 1108759161: 'Lukavac', 1108759163: 'Maglaj', 1108759165: 'Milići',
  1108759169: 'Modriča', 1108759171: 'Mostar', 1108759173: 'Istočni Mostar', 1108759175: 'Mrkonjić Grad',
  1108759177: 'Neum', 1108759179: 'Nevesinje', 1108759181: 'Novi Grad Sarajevo', 1108759183: 'Novi Travnik',
  1108759187: 'Novo Sarajevo', 1108759189: 'Istočno Novo Sarajevo', 1108759191: 'Odžak', 1108759193: 'Olovo',
  1108759195: 'Orašje', 1108759197: 'Vukosavlje', 1108759199: 'Pale-Prača', 1108759201: 'Pale',
  1108759205: 'Posušje', 1108759207: 'Prijedor', 1108759209: 'Prnjavor', 1108759211: 'Prozor-Rama',
  1108759213: 'Ravno', 1108759215: 'Rogatica', 1108759217: 'Rudo', 1108759219: 'Sanski Most',
  1108759223: 'Oštra Luka', 1108759225: 'Sapna', 1108759227: 'Šekovići', 1108759229: 'Šipovo',
  1108759231: 'Široki Brijeg', 1108759233: 'Kneževo', 1108759235: 'Sokolac', 1108759237: 'Srbac',
  1108759241: 'Srebrenica', 1108759243: 'Srebrenik', 1108759245: 'Stari Grad Sarajevo', 1108759247: 'Istočni Stari Grad',
  1108759249: 'Stolac', 1108759251: 'Berkovići', 1108759253: 'Teočak', 1108759255: 'Tešanj',
  1108759259: 'Teslić', 1108759261: 'Tomislavgrad', 1108759263: 'Travnik', 1108759265: 'Trebinje',
  1108759267: 'Trnovo', 1108759269: 'Trnovo (RS)', 1108759271: 'Tuzla', 1108759273: 'Ugljevik',
  1108759277: 'Usora', 1108759279: 'Vareš', 1108759281: 'Velika Kladuša', 1108759283: 'Višegrad',
  1108759285: 'Visoko', 1108759287: 'Vitez', 1108759289: 'Vlasenica', 1108759291: 'Vogošća',
  1108759295: 'Zavidovići', 1108759297: 'Zenica', 1108759299: 'Žepče', 1108759301: 'Živinice',
  1108759303: 'Zvornik',
}

// WOF region ids → canton (FBiH), entity (RS) or Brčko distrikt
export const REGIONS = {
  85669203: 'Kanton 10', 85669207: 'Unsko-sanski kanton', 85669213: 'Srednjobosanski kanton',
  85669217: 'Zapadnohercegovački kanton', 85669221: 'Hercegovačko-neretvanski kanton', 85669225: 'Tuzlanski kanton',
  85669231: 'Zeničko-dobojski kanton', 85669235: 'Kanton Sarajevo', 85669239: 'Bosansko-podrinjski kanton Goražde',
  85669243: 'Posavski kanton', 85632267: 'Republika Srpska', 85632279: 'Brčko distrikt',
}
