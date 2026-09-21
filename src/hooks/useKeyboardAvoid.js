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
        el.style.position = ''; el.style.top = ''; el.style.left = ''; el.style.right = ''; el.style.zIndex = ''; el.style.paddingBottom = ''
        el.classList.remove('is-keyboard')
        return
      }
      el.classList.add('is-keyboard')
      el.style.position = 'fixed'
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
