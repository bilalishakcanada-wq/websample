import { useEffect, useState } from 'react'

/** The value, but only after it has stopped changing for `delay` ms (typing → one search). */
export function useDebounced(value, delay = 200) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
