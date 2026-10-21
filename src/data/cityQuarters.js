import { rememberPlace } from './cityCoordinates'

// Dijelovi grada for the big towns, so a job in "Sarajevo" can say which part of it ("Grbavica, Novo
// Sarajevo") and lands there on the map instead of on the town's one point. Every label is a row of
// public.bih_locations (supabase/locations), so the database puts the job on that quarter's own point.
// the most asked-for parts of town come first; the rest open under "Još"
const QUARTERS = {
  Sarajevo: [
    ['Grbavica, Novo Sarajevo', 43.8515, 18.3995], ['Hrasno, Novo Sarajevo', 43.84389, 18.38222],
    ['Alipašino Polje, Novi Grad Sarajevo', 43.84056, 18.35556], ['Dobrinja, Novi Grad Sarajevo', 43.82609, 18.35623],
    ['Otoka, Novi Grad Sarajevo', 43.84731, 18.36485], ['Marijin Dvor, Centar Sarajevo', 43.856, 18.4085],
    ['Koševo, Centar Sarajevo', 43.87778, 18.41556], ['Baščaršija, Stari Grad Sarajevo', 43.8597, 18.4313],
    ['Ilidža', 43.82939, 18.30003], ['Vogošća', 43.90225, 18.34438],
    ['Bistrik, Stari Grad Sarajevo', 43.84972, 18.43389], ['Vratnik, Stari Grad Sarajevo', 43.8625, 18.438],
    ['Sedrenik, Stari Grad Sarajevo', 43.87362, 18.43751], ['Bjelave, Centar Sarajevo', 43.865, 18.4225],
    ['Ciglane, Centar Sarajevo', 43.865, 18.4105], ['Koševsko Brdo, Centar Sarajevo', 43.87, 18.404],
    ['Kovačići, Novo Sarajevo', 43.847, 18.4105], ['Velešići, Novo Sarajevo', 43.86832, 18.3969],
    ['Pofalići, Novo Sarajevo', 43.86419, 18.3834], ['Švrakino Selo, Novi Grad Sarajevo', 43.8575, 18.37],
    ['Mojmilo, Novi Grad Sarajevo', 43.8425, 18.3735], ['Saraj Polje, Novi Grad Sarajevo', 43.8445, 18.3535],
    ['Nedžarići, Novi Grad Sarajevo', 43.8395, 18.3485], ['Aerodromsko naselje, Novi Grad Sarajevo', 43.833, 18.344],
    ['Rajlovac, Novi Grad Sarajevo', 43.87004, 18.31806], ['Stup, Ilidža', 43.83613, 18.31028],
    ['Otes, Ilidža', 43.84008, 18.3054], ['Butmir, Ilidža', 43.82044, 18.32322],
    ['Sokolović Kolonija, Ilidža', 43.8085, 18.3165], ['Hrasnica, Ilidža', 43.79467, 18.31716],
    ['Lukavica, Istočno Novo Sarajevo', 43.82693, 18.38318],
  ],
  'Banja Luka': [
    ['Nova Varoš, Banja Luka', 44.781, 17.1935], ['Borik, Banja Luka', 44.768, 17.2055],
    ['Mejdan - Obilićevo, Banja Luka', 44.76324, 17.19012], ['Obilićevo, Banja Luka', 44.7625, 17.195],
    ['Paprikovac, Banja Luka', 44.764, 17.2], ['Hiseti, Banja Luka', 44.76111, 17.17944],
    ['Lauš, Banja Luka', 44.7736, 17.16754], ['Starčevica, Banja Luka', 44.75708, 17.21178],
    ['Rosulje, Banja Luka', 44.748, 17.195], ['Lazarevo, Banja Luka', 44.80417, 17.20194],
  ],
  Tuzla: [
    ['Slatina, Tuzla', 44.542, 18.6655], ['Sjenjak, Tuzla', 44.541, 18.681], ['Batva, Tuzla', 44.542, 18.689],
    ['Stupine, Tuzla', 44.53, 18.69], ['Kreka, Tuzla', 44.525, 18.64694],
  ],
  Zenica: [['Crkvice, Zenica', 44.205, 17.905], ['Pehare, Zenica', 44.2175, 17.8995]],
  Mostar: [
    ['Rondo, Mostar', 43.343, 17.801], ['Bijeli Brijeg, Mostar', 43.348, 17.802], ['Cernica, Mostar', 43.339, 17.807],
    ['Sjeverni logor, Mostar', 43.362, 17.806], ['Zahum, Mostar', 43.33528, 17.8025],
    ['Balinovac, Mostar', 43.33791, 17.79502], ['Luka, Mostar', 43.3282, 17.82284],
  ],
}
// the town's own municipalities count as the town ("Novo Sarajevo" → Sarajevo's list)
const ALIASES = { 'Centar Sarajevo': 'Sarajevo', 'Stari Grad Sarajevo': 'Sarajevo', 'Novo Sarajevo': 'Sarajevo', 'Novi Grad Sarajevo': 'Sarajevo' }

const byLabel = new Map()
for (const [city, rows] of Object.entries(QUARTERS)) {
  for (const [label, lat, lng] of rows) {
    byLabel.set(label, city)
    rememberPlace(label, lat, lng)
  }
}

/** { city, quarters: [{ label, name }] } when the place is a big town or one of its quarters, else null. */
export const quartersFor = (location) => {
  const text = String(location || '').trim()
  const city = QUARTERS[text] ? text : ALIASES[text] || byLabel.get(text)
  if (!city) return null
  return { city, quarters: QUARTERS[city].map(([label]) => ({ label, name: label.split(',')[0] })) }
}
