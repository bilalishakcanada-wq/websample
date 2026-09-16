// [lat, lng] for every city offered in the post-task location picker.
export const cityCoordinates = {
  'Sarajevo': [43.8563, 18.4131],
  'Banja Luka': [44.7722, 17.1910],
  'Tuzla': [44.5384, 18.6671],
  'Zenica': [44.2034, 17.9077],
  'Mostar': [43.3438, 17.8078],
  'Bijeljina': [44.7569, 19.2144],
  'Brčko': [44.8725, 18.8103],
  'Bihać': [44.8169, 15.8708],
  'Prijedor': [44.9797, 16.7139],
  'Trebinje': [42.7118, 18.3446],
  'Doboj': [44.7333, 18.1333],
  'Cazin': [44.9667, 15.9431],
  'Velika Kladuša': [45.1839, 15.8058],
  'Gradačac': [44.8783, 18.4258],
  'Zavidovići': [44.4453, 18.1497],
  'Gračanica': [44.7031, 18.3097],
  'Živinice': [44.4494, 18.6489],
  'Visoko': [43.9889, 18.1783],
  'Konjic': [43.6519, 17.9622],
  'Kakanj': [44.1250, 18.1200],
  'Travnik': [44.2264, 17.6658],
  'Goražde': [43.6667, 18.9764],
  'Foča': [43.5069, 18.7758],
  'Livno': [43.8269, 17.0078],
  'Čapljina': [43.1108, 17.6931],
  'Široki Brijeg': [43.3833, 17.5917],
  'Ljubuški': [43.1972, 17.5453],
  'Stolac': [43.0842, 17.9578],
  'Bugojno': [44.0572, 17.4508],
  'Fojnica': [43.9628, 17.8967],
  'Vareš': [44.1633, 18.3275],
  'Kiseljak': [43.9428, 18.0783],
  'Kreševo': [43.8778, 18.0567],
  'Ilidža': [43.8300, 18.3100],
  'Vogošća': [43.9006, 18.3419],
  'Hadžići': [43.8222, 18.2058],
  'Ilijaš': [43.9536, 18.2711],
  'Novi Grad Sarajevo': [43.8500, 18.3500],
  'Centar Sarajevo': [43.8600, 18.4100],
  'Stari Grad Sarajevo': [43.8600, 18.4300],
  'Novo Sarajevo': [43.8500, 18.3900],
  'Lukavac': [44.5392, 18.5308],
  'Srebrenik': [44.7069, 18.4886],
  'Tešanj': [44.6122, 17.9864],
  'Maglaj': [44.5486, 18.0972],
  'Odžak': [45.0111, 18.3231],
  'Modriča': [44.9539, 18.3039],
  'Šamac': [45.0603, 18.4653],
  'Derventa': [44.9775, 17.9081],
  'Teslić': [44.6069, 17.8592],
  'Prnjavor': [44.8686, 17.6631],
  'Gradiška': [45.1450, 17.2544],
  'Laktaši': [44.9086, 17.3011],
  'Čelinac': [44.7256, 17.3239],
  'Kotor Varoš': [44.6183, 17.3711],
  'Šipovo': [44.2806, 17.0864],
  'Mrkonjić Grad': [44.4167, 17.0833],
  'Ključ': [44.5333, 16.7750],
  'Sanski Most': [44.7667, 16.6667],
  'Bosanska Krupa': [44.8833, 16.1500],
  'Bosanski Petrovac': [44.5544, 16.3700],
  'Drvar': [44.3739, 16.3806],
  'Glamoč': [44.0453, 16.8489],
  'Kupres': [43.9908, 17.1122],
  'Bosansko Grahovo': [44.1789, 16.3625],
  'Jajce': [44.3417, 17.2717],
  'Donji Vakuf': [44.1433, 17.4028],
  'Novi Travnik': [44.1733, 17.6572],
  'Busovača': [44.0994, 17.8797],
  'Vitez': [44.1550, 17.7889],
  'Kladanj': [44.2258, 18.6906],
  'Kalesija': [44.4442, 18.8922],
  'Sapna': [44.4917, 18.9769],
  'Teočak': [44.6000, 19.0167],
  'Zvornik': [44.3833, 19.1000],
  'Bratunac': [44.1858, 19.3322],
  'Srebrenica': [44.1039, 19.2978],
  'Vlasenica': [44.1817, 18.9411],
  'Han Pijesak': [44.0844, 18.9500],
  'Rogatica': [43.7986, 19.0044],
  'Višegrad': [43.7828, 19.2903],
  'Rudo': [43.6197, 19.3667],
  'Čajniče': [43.5561, 19.0731],
  'Pale': [43.8167, 18.5700],
  'Trnovo': [43.6667, 18.4500],
  'Istočno Sarajevo': [43.8236, 18.3572],
  'Nevesinje': [43.2586, 18.1131],
  'Gacko': [43.1667, 18.5333],
  'Bileća': [42.8761, 18.4297],
  'Ravno': [42.8833, 17.9667],
  'Neum': [42.9247, 17.6158],
  'Čitluk': [43.2286, 17.7000],
  'Posušje': [43.4728, 17.3283],
}

export const isRemoteLocation = (location) => /online|daljin|remote/i.test(location || '')

const normalise = (value) => (value || '').toLowerCase().trim()

// Exact name first, then the longest city name contained in the text
// ("Novi Grad Sarajevo" beats "Sarajevo" for "Novi Grad Sarajevo, BiH").
export function coordsForLocation(location) {
  if (!location || isRemoteLocation(location)) return null
  const exact = cityCoordinates[location.trim()]
  if (exact) return { lat: exact[0], lng: exact[1] }
  const text = normalise(location)
  let best = null
  for (const [name, [lat, lng]] of Object.entries(cityCoordinates)) {
    const key = normalise(name)
    if (text.includes(key) && (!best || key.length > best.key.length)) best = { key, lat, lng }
  }
  return best ? { lat: best.lat, lng: best.lng } : null
}

export function distanceKm(a, b) {
  if (!a || !b) return null
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
