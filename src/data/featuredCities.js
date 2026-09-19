import { withBase } from '../utils/paths'
export const featuredCities = [
  { id: 'sarajevo', name: 'Sarajevo', image: withBase('/images/cities/sarajevo.jpg'), tagline: 'Baščaršija i stari grad' },
  { id: 'banja-luka', name: 'Banja Luka', image: withBase('/images/cities/banjaluka.jpg'), tagline: 'Glavni grad Republike Srpske' },
  { id: 'mostar', name: 'Mostar', image: withBase('/images/cities/mostar.jpg'), tagline: 'Stari most na Neretvi' },
  { id: 'visegrad', name: 'Višegrad', image: withBase('/images/cities/visegrad.jpg'), tagline: 'Most na Drini' },
  { id: 'bijeljina', name: 'Bijeljina', image: withBase('/images/cities/bijeljina.jpg'), tagline: 'Semberija' },
]

export const otherCitiesImage = withBase('/images/cities/ostalo.jpg')
