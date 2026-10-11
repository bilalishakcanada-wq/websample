// One map look for every map in Zadatak (search map, „Izvođač je na putu“).
// OpenFreeMap "liberty": OpenStreetMap data, the most complete street map of BiH (every street and most
// house numbers are mapped by local volunteers), free, no key and no monthly limit.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/**
 * Street and place names in Latin letters everywhere: OpenStreetMap keeps the local spelling, which is
 * Cyrillic in parts of the RS; OpenMapTiles ships a Latin transliteration next to it.
 */
export function latinLabels(map) {
  const apply = () => {
    for (const layer of map.getStyle()?.layers || []) {
      const field = layer.type === 'symbol' ? map.getLayoutProperty(layer.id, 'text-field') : null
      // only name labels: road numbers (ref) and house numbers keep their own field
      if (!field || !/name/.test(JSON.stringify(field))) continue
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:latin'], ['get', 'name']])
    }
  }
  if (map.isStyleLoaded()) apply()
  else map.once('style.load', apply)
}
