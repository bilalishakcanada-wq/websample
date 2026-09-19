import { withBase } from '../utils/paths'
export const featuredCities = [
  { id: 'sarajevo', name: 'Sarajevo', image: withBase('/images/cities/sarajevo.webp'), tagline: 'Baščaršija i stari grad' },
  { id: 'banja-luka', name: 'Banja Luka', image: withBase('/images/cities/banjaluka.webp'), tagline: 'Glavni grad Republike Srpske' },
  { id: 'mostar', name: 'Mostar', image: withBase('/images/cities/mostar.webp'), tagline: 'Stari most na Neretvi' },
  { id: 'visegrad', name: 'Višegrad', image: withBase('/images/cities/visegrad.webp'), tagline: 'Most na Drini' },
  { id: 'bijeljina', name: 'Bijeljina', image: withBase('/images/cities/bijeljina.webp'), tagline: 'Semberija' },
]

export const otherCitiesImage = withBase('/images/cities/ostalo.webp')
