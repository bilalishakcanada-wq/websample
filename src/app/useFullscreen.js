import { useLayoutEffect } from 'react'

/** Screens that draw their own top bar (welcome, goal, intro, post flow) hide the site header and tab bar.
 *  Layout effect: the chrome is gone before the first paint, so it never flashes for a frame (CLS 0). */
export function useFullscreen(active = true) {
  useLayoutEffect(() => {
    if (!active) return undefined
    document.body.dataset.chrome = 'off'
    return () => { delete document.body.dataset.chrome }
  }, [active])
}
