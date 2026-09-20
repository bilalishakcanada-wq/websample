import { useEffect, useState } from 'react'

/** Reactive media query, e.g. useMediaQuery('(max-width: 768px)'). */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    setMatches(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}
