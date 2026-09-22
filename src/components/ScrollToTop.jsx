import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToTop } from '../utils/scroll'
import { dropBootScreen } from '../utils/boot'
import { titleFor } from '../utils/pageTitle'

/**
 * New page = start at the top (browsers keep the old scroll position in SPAs).
 * Also tags <body data-page="…"> with the first path segment so CSS can adapt
 * chrome per screen (e.g. hide the site header inside the post wizard on phones).
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  // before paint: screens that hide the site header (search, inbox, wizard…) must never show it for one frame
  useLayoutEffect(() => {
    document.body.dataset.page = pathname.split('/')[1] || 'home'
    document.title = titleFor(pathname)
  }, [pathname])
  useEffect(() => {
    scrollToTop()
    // the pre-rendered welcome overlay only belongs to the visitor home; any other screen drops it
    if (pathname !== '/') dropBootScreen()
  }, [pathname])
  return null
}

export default ScrollToTop
