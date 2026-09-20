import { useEffect, useState } from 'react'

/**
 * The app has two faces: "poster" (Uradi posao — I need something done) and
 * "tasker" (Zaradi — I do jobs). The choice lives on the device; the profile's
 * account_type seeds it. Screens read it with useMode().
 */
const KEY = 'poso-mode'
const EVENT = 'poso:mode'

export const MODES = { poster: 'poster', tasker: 'tasker' }

export function getMode() {
  try { return localStorage.getItem(KEY) === 'tasker' ? 'tasker' : 'poster' } catch { return 'poster' }
}

export function setMode(mode) {
  const next = mode === 'tasker' ? 'tasker' : 'poster'
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
}

/** Seed the mode from a profile's account_type when the user never chose one. */
export function seedModeFromProfile(accountType) {
  try { if (localStorage.getItem(KEY)) return } catch { return }
  if (accountType === 'provider') setMode('tasker')
}

export function useMode() {
  const [mode, set] = useState(getMode)
  useEffect(() => {
    const onChange = (event) => set(event.detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
  return [mode, setMode]
}
