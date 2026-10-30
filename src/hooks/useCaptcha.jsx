import { useCallback, useRef, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
export const CAPTCHA_ON = Boolean(SITE_KEY)

/**
 * Cloudflare Turnstile for the auth calls Supabase checks (sign-in, sign-up, password reset, resend).
 * A token works once, so call reset() after every attempt: the widget then fetches a fresh one.
 * Without VITE_TURNSTILE_SITE_KEY (local builds, the robot) there is no widget and no token.
 */
export function useCaptcha() {
  const ref = useRef(null)
  const [token, setToken] = useState('')
  const reset = useCallback(() => {
    setToken('')
    ref.current?.reset()
  }, [])
  const widget = CAPTCHA_ON
    ? <Turnstile ref={ref} siteKey={SITE_KEY} onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />
    : null
  return { token, reset, widget }
}
