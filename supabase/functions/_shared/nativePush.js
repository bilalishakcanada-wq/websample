const encode = (value) => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const text = new TextEncoder()
const jsonPart = (value) => encode(text.encode(JSON.stringify(value)))
const pemBytes = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), (char) => char.charCodeAt(0))

/** APNs + FCM HTTP v1 delivery. Only server-side Edge Function secrets are accepted. */
export function createNativePushSender({ getEnv, fetchImpl = fetch, cryptoImpl = crypto, now = Date.now }) {
  let fcmAuth = null
  let fcmPending = null
  let apnsAuth = null
  const signJwt = async (header, claims, pem, algorithm) => {
    const signingInput = `${jsonPart(header)}.${jsonPart(claims)}`
    const key = await cryptoImpl.subtle.importKey('pkcs8', pemBytes(pem), algorithm, false, ['sign'])
    const signature = await cryptoImpl.subtle.sign(algorithm, key, text.encode(signingInput))
    return `${signingInput}.${encode(signature)}`
  }
  const loadFcmCredential = async () => {
    if (fcmAuth && fcmAuth.expires > now() + 60000) return fcmAuth
    const config = getEnv('FCM_SERVICE_ACCOUNT_JSON')
    if (!config) return null
    const account = JSON.parse(config)
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error('FCM_CONFIG_INVALID')
    const issued = Math.floor(now() / 1000)
    const assertion = await signJwt({ alg: 'RS256', typ: 'JWT' }, {
      iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600,
    }, account.private_key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' })
    const response = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000),
    })
    const result = await response.json()
    if (!response.ok || !result.access_token) throw new Error('FCM_AUTH_FAILED')
    fcmAuth = { token: result.access_token, projectId: account.project_id, expires: now() + Number(result.expires_in || 3600) * 1000 }
    return fcmAuth
  }
  const fcmCredential = () => {
    if (fcmAuth && fcmAuth.expires > now() + 60000) return Promise.resolve(fcmAuth)
    if (!fcmPending) fcmPending = loadFcmCredential().finally(() => { fcmPending = null })
    return fcmPending
  }
  const apnsCredential = async () => {
    if (apnsAuth && apnsAuth.expires > now()) return apnsAuth.token
    const pem = getEnv('APNS_PRIVATE_KEY'), keyId = getEnv('APNS_KEY_ID'), teamId = getEnv('APNS_TEAM_ID')
    if (!pem || !keyId || !teamId) return null
    const token = await signJwt({ alg: 'ES256', kid: keyId }, { iss: teamId, iat: Math.floor(now() / 1000) }, pem.replace(/\\n/g, '\n'), { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' })
    apnsAuth = { token, expires: now() + 45 * 60 * 1000 }
    return token
  }
  async function send(device, notification) {
    const link = typeof notification.link === 'string' && notification.link.startsWith('/') && !notification.link.startsWith('//')
      && !notification.link.includes('\\') && !Array.from(notification.link).some((char) => char.charCodeAt(0) < 32) ? notification.link : '/account/obavijesti'
    const data = { notification_id: notification.id, user_id: notification.user_id, type: notification.type || 'zadatak', link }
    let response
    if (device.platform === 'android' || (device.platform === 'ios' && device.provider === 'fcm')) {
      const credential = await fcmCredential()
      if (!credential) return { state: 'not_configured', provider: 'fcm' }
      response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credential.projectId)}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token: device.token, notification: { title: notification.title, body: notification.message || '' }, data,
          ...(device.platform === 'android' ? {
            android: { priority: 'HIGH', ttl: '86400s', notification: { channel_id: 'zadatak-updates', icon: 'ic_notification', sound: 'default', tag: notification.id, visibility: 'PRIVATE' } },
          } : {
            apns: { headers: { 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-topic': getEnv('APNS_TOPIC') || 'ba.zadatak.app', 'apns-collapse-id': notification.id },
              payload: { aps: { sound: 'default', 'thread-id': notification.type || 'zadatak' } } },
          }),
        } }), signal: AbortSignal.timeout(15000),
      })
      if (response.ok) return { state: 'sent', provider: 'fcm' }
      const result = await response.json().catch(() => ({}))
      const unregistered = result.error?.details?.some((item) => item.errorCode === 'UNREGISTERED')
      if (response.status === 401) fcmAuth = null
      return { state: unregistered ? 'expired' : 'failed', provider: 'fcm', status: response.status }
    }
    if (device.platform !== 'ios') return { state: 'failed', provider: 'unsupported' }
    const credential = await apnsCredential()
    if (!credential) return { state: 'not_configured', provider: 'apns' }
    const host = device.environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'
    response = await fetchImpl(`https://${host}/3/device/${encodeURIComponent(device.token)}`, {
      method: 'POST', headers: {
        authorization: `bearer ${credential}`, 'apns-topic': getEnv('APNS_TOPIC') || 'ba.zadatak.app',
        'apns-push-type': 'alert', 'apns-priority': '10', 'apns-expiration': String(Math.floor(now() / 1000) + 86400),
        'apns-collapse-id': notification.id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ aps: { alert: { title: notification.title, body: notification.message || '' }, sound: 'default', 'thread-id': notification.type || 'zadatak' }, ...data }),
      signal: AbortSignal.timeout(15000),
    })
    if (response.ok) return { state: 'sent', provider: 'apns' }
    const result = await response.json().catch(() => ({}))
    if (result.reason === 'ExpiredProviderToken') apnsAuth = null
    // A bad token may belong to the other environment/config; only 410 is terminal.
    return { state: response.status === 410 ? 'expired' : 'failed', provider: 'apns', status: response.status }
  }
  return { send }
}
