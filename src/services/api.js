import { appConfig } from '../config/appConfig'
import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

export async function apiRequest(path, { method = 'GET', body, headers } = {}) {
  const url = `${appConfig.apiBaseUrl}${path}`
  const { data: { session } } = await supabase.auth.getSession()

  const isFormData = body instanceof FormData
  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(headers || {}),
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch {
    throw new Error('Server trenutno nije dostupan. Pokušajte ponovo za nekoliko trenutaka.')
  }

  if (!response.ok) {
    throw publicError()
  }

  return response.headers.get('content-type')?.includes('application/json')
    ? response.json()
    : response.text()
}
