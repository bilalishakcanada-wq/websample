import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** New page = start at the top (browsers keep the old scroll position in SPAs). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return null
}

export default ScrollToTop
