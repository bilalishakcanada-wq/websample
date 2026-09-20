import { supabase } from '../lib/supabase'

/** Job alerts for providers: "tell me when a job like this appears" (category / city / keyword). */
export const alertService = {
  async listMine() {
    const { data, error } = await supabase.from('task_alerts').select('id, keyword, category, city, created_at').order('created_at', { ascending: false })
    if (error) throw new Error('Alarmi trenutno nisu dostupni.')
    return data || []
  },
  async create({ userId, keyword = '', category = '', city = '' }) {
    const { data, error } = await supabase.from('task_alerts').insert({ user_id: userId, keyword: keyword.trim().slice(0, 60) || null, category: category || null, city: city || null }).select('id, keyword, category, city, created_at').single()
    if (error) throw new Error('Alarm nije sačuvan. Pokušaj ponovo.')
    return data
  },
  async remove(id) {
    const { error } = await supabase.from('task_alerts').delete().eq('id', id)
    if (error) throw new Error('Alarm nije obrisan.')
  },
}
