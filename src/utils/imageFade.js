/**
 * Lazy images fade in once they have loaded, instead of popping in line by line. Opt-in by
 * class on <html> after images that are already there are marked, so pre-rendered or cached
 * images never go invisible; broken images are marked too (they keep their alt / fallback).
 */
export function installImageFade() {
  if (typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const mark = (event) => { if (event.target instanceof HTMLImageElement) event.target.classList.add('is-loaded') }
  document.addEventListener('load', mark, true)
  document.addEventListener('error', mark, true)
  document.querySelectorAll('img').forEach((img) => { if (img.complete) img.classList.add('is-loaded') })
  document.documentElement.classList.add('img-fade')
}
