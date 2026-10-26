import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Prekidači (feature_switches): an admin turns one feature off without a new app version. Every switch
 * counts as on until the database says otherwise, so a failed read or a missing table never locks anyone out.
 */
export const switchesQuery = {
  queryKey: ['switches'],
  queryFn: async () => {
    const { data, error } = await supabase.from('feature_switches').select('key, label, enabled, message, value, updated_at')
    if (error) throw error
    return Object.fromEntries((data || []).map((row) => [row.key, row]))
  },
  staleTime: 60 * 1000,
  retry: false,
  meta: { persist: false },
}

export function useSwitch(key) {
  const row = useQuery(switchesQuery).data?.[key]
  return { on: row ? row.enabled !== false : true, message: row?.message || '', value: row?.value || null }
}
