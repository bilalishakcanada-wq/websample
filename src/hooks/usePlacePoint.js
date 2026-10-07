import { useEffect, useMemo, useState } from 'react'
import { coordsForLocation, knowsPlace } from '../data/cityCoordinates'
import { locationService } from '../services/locationService'

/**
 * { lat, lng } of a stored location ("Tuzla", "Otes, Ilidža"), or null. A settlement this device has not
 * seen yet answers with its municipality's point at first, then its own once looked up.
 */
export function usePlacePoint(label) {
  const [resolved, setResolved] = useState(null)
  useEffect(() => {
    if (!label || knowsPlace(label)) return undefined
    let alive = true
    locationService.ensure(label).then((found) => { if (alive && found) setResolved({ label, point: coordsForLocation(label) }) })
    return () => { alive = false }
  }, [label])
  return useMemo(() => (resolved?.label === label ? resolved.point : label ? coordsForLocation(label) : null), [label, resolved])
}
