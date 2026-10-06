// Fingerprint / Face ID before money leaves escrow, when the site runs inside the app.
// Native side: ZadatakNativePlugin (android/…/ZadatakNativePlugin.java, ios/App/App/ZadatakNative.swift).
import { isNativeApp } from './native'

const plugin = () => (isNativeApp() ? window.Capacitor?.Plugins?.ZadatakNative : null)

/**
 * Asks the phone's own lock (fingerprint, face, or PIN when neither is set up) to confirm a payment.
 * Resolves true when confirmed, false when the person cancelled or failed it.
 * Resolves true without asking in a browser, in an older app build without the plugin, or on a phone
 * with no screen lock at all: the in-app confirm dialog the caller already showed is the check there.
 */
export async function confirmPaymentIdentity(reason) {
  const native = plugin()
  if (!native?.confirmIdentity) return true
  try {
    const info = await native.biometricInfo()
    if (!info?.available) return true
    const result = await native.confirmIdentity({ title: 'Potvrdi isplatu', reason })
    return Boolean(result?.ok)
  } catch {
    // a build where the bridge exists but the method fails: don't lock people out of paying
    return true
  }
}
