import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToTop } from '../utils/scroll'

/**
 * New page = start at the top (browsers keep the old scroll position in SPAs).
 * Also tags <body data-page="…"> with the first path segment so CSS can adapt
 * chrome per screen (e.g. hide the site header inside the post wizard on phones).
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    scrollToTop()
    document.body.dataset.page = pathname.split('/')[1] || 'home'
  }, [pathname])
  return null
}

export default ScrollToTop
