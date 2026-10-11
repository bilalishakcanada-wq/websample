import { useEffect } from 'react'
import { isNativeApp } from '../utils/native'
import { setSmoothScroller } from '../utils/scroll'

// overlays, maps and anything that scrolls on its own keep the browser's native wheel
const OWN_SCROLL = '[role="dialog"], [aria-modal="true"], .maplibregl-map, textarea, select, [data-lenis-prevent]'

/**
 * Lenis smooth scrolling for computers (mouse wheel / trackpad). Phones, the apps and
 * "reduce motion" keep the browser's own scrolling. Lenis loads only where it runs.
 */
function SmoothScroll() {
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 769px) and (pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lenis = null
    let loading = false
    let alive = true

    const start = async () => {
      if (lenis || loading || isNativeApp()) return
      loading = true
      const { default: Lenis } = await import('lenis').finally(() => { loading = false })
      if (!alive || lenis || !wide.matches || still.matches) return
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.12,
        allowNestedScroll: true,
        anchors: { offset: -96 },
        stopInertiaOnNavigate: true,
        // a dialog that locked the page (body overflow hidden) keeps it locked
        prevent: (node) => document.body.style.overflow === 'hidden' || node.matches(OWN_SCROLL),
      })
      setSmoothScroller(lenis)
    }
    const stop = () => {
      lenis?.destroy()
      lenis = null
      setSmoothScroller(null)
    }
    const sync = () => (wide.matches && !still.matches ? start().catch(() => {}) : stop())

    sync()
    wide.addEventListener('change', sync)
    still.addEventListener('change', sync)
    return () => {
      alive = false
      wide.removeEventListener('change', sync)
      still.removeEventListener('change', sync)
      stop()
    }
  }, [])
  return null
}

export default SmoothScroll
