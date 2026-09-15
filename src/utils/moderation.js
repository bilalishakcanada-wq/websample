const PROHIBITED_TERMS = [
  'oružje', 'oruzje', 'pištolj', 'pistolj', 'puška', 'puska', 'municija', 'granata', 'eksploziv',
  'gun', 'firearm', 'pistol', 'rifle', 'ammunition', 'explosive',
  'droga', 'drogu', 'drogom', 'kokain', 'heroin', 'marihuana', 'marijuana', 'kanabis', 'canabis',
  'ecstasy', 'amfetamin', 'metamfetamin', 'cocaine',
]

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/š/g, 's')
  .replace(/č/g, 'c')
  .replace(/ć/g, 'c')
  .replace(/ž/g, 'z')
  .replace(/đ/g, 'dj')

export const findProhibitedTerm = (...texts) => {
  const combined = normalize(texts.join(' '))
  return PROHIBITED_TERMS.find((term) => combined.includes(normalize(term))) || null
}
