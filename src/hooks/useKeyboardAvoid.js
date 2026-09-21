import { useEffect, useRef } from 'react'

/**
 * Keeps a bottom action bar visible above the on-screen keyboard on phones.
 * iOS does not shrink the layout viewport when the keyboard opens (it pans it), so a sticky footer
 * ends up under the keys. While the keyboard is up we pin the bar to the visual viewport instead.
 */
export function useKeyboardAvoid() {
  const ref = useRef(null)
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!vv || !el) return undefined
    const place = () => {
      const keyboardOpen = window.innerHeight - vv.height > 120
      if (!keyboardOpen) {
        el.style.position = ''; el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = ''; el.style.zIndex = ''; el.style.paddingBottom = ''
        el.classList.remove('is-keyboard')
        return
      }
      el.classList.add('is-keyboard')
      el.style.position = 'fixed'
      el.style.bottom = 'auto' // the sticky rule sets bottom: 0 — with top as well the bar would stretch over the screen
      el.style.left = '0'
      el.style.right = '0'
      el.style.zIndex = '40'
      el.style.paddingBottom = '8px'
      el.style.top = `${Math.round(vv.offsetTop + vv.height - el.offsetHeight)}px`
    }
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    place()
    return () => { vv.removeEventListener('resize', place); vv.removeEventListener('scroll', place) }
  }, [])
  return ref
}

/**
 * Full-screen chat: while the keyboard is up, the whole screen (header, thread, composer) is fitted
 * to the visual viewport, so the header stays visible and the composer sits right above the keys —
 * instead of iOS panning the page and cutting the top off.
 */
export function useKeyboardFit(active = true) {
  const ref = useRef(null)
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!active || !vv || !el) return undefined
    const reset = () => {
      el.style.position = ''; el.style.top = ''; el.style.left = ''; el.style.width = ''; el.style.height = ''; el.style.zIndex = ''
      el.classList.remove('is-keyboard')
    }
    const place = () => {
      const keyboardOpen = window.innerHeight - vv.height > 120
      if (!keyboardOpen) { reset(); return }
      el.classList.add('is-keyboard')
      el.style.position = 'fixed'
      el.style.top = `${Math.round(vv.offsetTop)}px`
      el.style.left = `${Math.round(vv.offsetLeft)}px`
      el.style.width = `${Math.round(vv.width)}px`
      el.style.height = `${Math.round(vv.height)}px`
      el.style.zIndex = '50'
      el.querySelector('[data-scroll-end]')?.scrollTo({ top: 1e9 })
    }
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    place()
    return () => { vv.removeEventListener('resize', place); vv.removeEventListener('scroll', place); reset() }
  }, [active])
  return ref
}
