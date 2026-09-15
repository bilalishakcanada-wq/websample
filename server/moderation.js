const PROHIBITED_TERMS = [
  ['oružje', 'weapons'],
  ['oruzje', 'weapons'],
  ['pištolj', 'weapons'],
  ['pistolj', 'weapons'],
  ['puška', 'weapons'],
  ['puska', 'weapons'],
  ['municija', 'weapons'],
  ['granata', 'weapons'],
  ['eksploziv', 'weapons'],
  ['gun', 'weapons'],
  ['firearm', 'weapons'],
  ['pistol', 'weapons'],
  ['rifle', 'weapons'],
  ['ammunition', 'weapons'],
  ['explosive', 'weapons'],
  ['droga', 'drugs'],
  ['drogu', 'drugs'],
  ['drogom', 'drugs'],
  ['kokain', 'drugs'],
  ['heroin', 'drugs'],
  ['marihuana', 'drugs'],
  ['marijuana', 'drugs'],
  ['kanabis', 'drugs'],
  ['canabis', 'drugs'],
  ['ecstasy', 'drugs'],
  ['amfetamin', 'drugs'],
  ['metamfetamin', 'drugs'],
  ['cocaine', 'drugs'],
  ['crack kokain', 'drugs'],
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
  for (const [term, category] of PROHIBITED_TERMS) {
    if (combined.includes(normalize(term))) {
      return { term, category }
    }
  }
  return null
}
