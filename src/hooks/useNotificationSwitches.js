import { useCallback, useEffect, useState } from 'react'
import { clearDeliveredNotifications, disablePush, enablePush, PUSH_PREF_CHANGED, pushDeviceState } from '../utils/push'
import { openAppSettings } from '../utils/permissions'

/**
 * The notification switches of Postavke and Postavke obavijesti, one behaviour for both screens:
 *  - "Push obavijesti" (account) off: no push on any device, no ping, no pop-up; the phone row shows off too.
 *  - "Push obavijesti" on: this device is switched on with it (when the phone/browser allows it).
 *  - "Na ovom telefonu" on: also turns the account switch on, otherwise the device would stay silent.
 *  - "Email obavijesti": emails only.
 * device: 'loading' | 'on' | 'off' | 'blocked' | 'install' | 'unsupported' | 'native'
 */
export function useNotificationSwitches({ profile, saveProfile }) {
  // what the switch shows while a save is on its way; after it the stored value (also moved elsewhere) wins
  const [emailPending, setEmailPending] = useState(null)
  const [pushPending, setPushPending] = useState(null)
  const notifyEmail = emailPending ?? profile.notify_email !== false
  const notifyPush = pushPending ?? profile.notify_push !== false
  const [device, setDevice] = useState('loading')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const recheckDevice = useCallback(() => pushDeviceState().then(setDevice), [])
  useEffect(() => { recheckDevice() }, [recheckDevice])

  const savePref = async (patch, setPending) => {
    setBusy('prefs'); setError('')
    try {
      await saveProfile(patch)
      window.dispatchEvent(new Event(PUSH_PREF_CHANGED))
      return true
    } catch (requestError) { setError(requestError.message); return false } finally { setPending(null); setBusy('') }
  }

  const turnDeviceOn = async () => {
    const result = await enablePush()
    if (result === 'granted') setDevice('on')
    else if (result === 'denied') { setDevice('blocked'); setError('Obavijesti su blokirane za Zadatak. Dozvoli ih u postavkama telefona ili preglednika.') }
    else if (result === 'unsupported') setDevice('unsupported') // no way to deliver here: say so instead of a switch that does nothing
    return result
  }

  const togglePush = async () => {
    const next = !notifyPush
    setPushPending(next)
    // this device first: the browser asks for permission only straight from the tap, not after a save
    if (next && device === 'off') {
      setBusy('device')
      try { await turnDeviceOn() } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
    }
    if ((await savePref({ notify_push: next }, setPushPending)) && !next) clearDeliveredNotifications()
  }

  const toggleEmail = () => {
    const next = !notifyEmail
    setEmailPending(next)
    savePref({ notify_email: next }, setEmailPending)
  }

  const deviceOn = device === 'on' && notifyPush
  const toggleDevice = async () => {
    setError('')
    if (device === 'blocked') {
      if (!(await openAppSettings())) setError('Dozvoli obavijesti za Zadatak u postavkama telefona ili preglednika, pa se vrati ovdje.')
      return
    }
    setBusy('device')
    try {
      if (deviceOn) {
        await disablePush()
        setDevice('off')
        clearDeliveredNotifications()
      } else if (device === 'on') {
        // the phone is registered, only the account switch was off
        await saveProfile({ notify_push: true })
        window.dispatchEvent(new Event(PUSH_PREF_CHANGED))
      } else if ((await turnDeviceOn()) === 'granted') {
        await saveProfile({ notify_push: true }) // enablePush stored it; this keeps the screen's copy in step
      }
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  return { notifyEmail, notifyPush, device, deviceOn, busy, error, setError, recheckDevice, togglePush, toggleEmail, toggleDevice }
}
