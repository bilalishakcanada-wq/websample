import { useEffect, useState } from 'react'

/** Reactive media query, e.g. useMediaQuery('(max-width: 768px)'). */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    // some embedded browsers/emulators resize without firing the media "change" event
    window.addEventListener('resize', sync)
    return () => { media.removeEventListener('change', sync); window.removeEventListener('resize', sync) }
  }, [query])
  return matches
}
