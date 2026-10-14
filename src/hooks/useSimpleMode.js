import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { keys } from './queryKeys'

/**
 * Jednostavan način za majstore: velika dugmad i prijava na posao bez kucanja.
 * Sam se uključi kad osoba ima 40 ili više godina (datum rođenja iz verifikacije
 * identiteta ili iz profila); svako ga može sam uključiti ili isključiti.
 * Izbor se čuva u bazi (profiles.simple_mode); dok baza nema funkciju, na ovom uređaju.
 */
const LOCAL_KEY = 'zadatak-simple-mode'

function readLocal() {
  try {
    const value = localStorage.getItem(LOCAL_KEY)
    return value === '1' ? true : value === '0' ? false : null
  } catch { return null }
}

function writeLocal(on) {
  try {
    if (on == null) localStorage.removeItem(LOCAL_KEY)
    else localStorage.setItem(LOCAL_KEY, on ? '1' : '0')
  } catch { /* ignore */ }
}

async function fetchSimpleMode() {
  const { data, error } = await supabase.rpc('my_simple_mode')
  if (error || !data) {
    const choice = readLocal()
    return { enabled: choice === true, choice, age: null, auto: false }
  }
  return data
}

export function useSimpleMode(userId) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: keys.simpleMode(userId),
    queryFn: fetchSimpleMode,
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
  })
  const state = data || { enabled: false, choice: null, age: null, auto: false }

  /** true / false = izbor korisnika; null = vrati na automatski (prema godinama). */
  const setChoice = async (on) => {
    writeLocal(on)
    const { data: fresh, error } = await supabase.rpc('set_simple_mode', { p_on: on })
    const next = !error && fresh ? fresh : { ...state, choice: on, enabled: on == null ? state.auto : on }
    queryClient.setQueryData(keys.simpleMode(userId), next)
    return next
  }

  return { ...state, enabled: Boolean(userId) && Boolean(state.enabled), setChoice }
}
