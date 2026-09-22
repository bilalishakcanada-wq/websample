/** Removes the pre-rendered first screen from index.html (an overlay above React's root). */
export function dropBootScreen() {
  const el = document.getElementById('boot-welcome')
  if (!el) return
  // one frame later, so the React screen underneath has painted before the overlay goes
  requestAnimationFrame(() => requestAnimationFrame(() => el.remove()))
}
