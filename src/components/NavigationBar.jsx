import MobileNav from './MobileNav'
import { useMediaQuery } from '../hooks/useMediaQuery'

/** The app's navigation: the tab bar at the bottom on phones; computers use the top bar (SiteHeader), like Airtasker. */
function NavigationBar() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  return isPhone ? <MobileNav /> : null
}

export default NavigationBar
