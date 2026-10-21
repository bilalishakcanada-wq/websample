import { supabase } from '../lib/supabase'

// radius_km and mode come with supabase/airtasker-lokacija/03; until it runs, alerts work as before
const FULL = 'id, keyword, category, city, radius_km, mode, created_at'
const BASIC = 'id, keyword, category, city, created_at'
const isMissingColumn = (error) => error?.code === 'PGRST204' || error?.code === '42703'

/**
 * Job alerts for providers, like Airtasker's: "tell me when a job like this appears" (category, keyword,
 * a place and how far from it, in person / online).
 */
export const alertService = {
  async listMine() {
    let { data, error } = await supabase.from('task_alerts').select(FULL).order('created_at', { ascending: false })
    if (error && isMissingColumn(error)) ({ data, error } = await supabase.from('task_alerts').select(BASIC).order('created_at', { ascending: false }))
    if (error) throw new Error('Alarmi trenutno nisu dostupni.')
    return data || []
  },
  async create({ userId, keyword = '', category = '', city = '', radiusKm = null, mode = 'all' }) {
    const row = { user_id: userId, keyword: keyword.trim().slice(0, 60) || null, category: category || null, city: city || null }
    const extra = { radius_km: city && Number(radiusKm) > 0 ? Number(radiusKm) : null, mode: ['in_person', 'remote'].includes(mode) ? mode : 'all' }
    let { data, error } = await supabase.from('task_alerts').insert({ ...row, ...extra }).select(FULL).single()
    if (error && isMissingColumn(error)) ({ data, error } = await supabase.from('task_alerts').insert(row).select(BASIC).single())
    if (error) throw new Error('Alarm nije sačuvan. Pokušaj ponovo.')
    return data
  },
  async remove(id) {
    const { error } = await supabase.from('task_alerts').delete().eq('id', id)
    if (error) throw new Error('Alarm nije obrisan.')
  },
}
