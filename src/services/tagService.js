import { supabase } from '../lib/supabase'
import { apiRequest } from './api'
import { appConfig } from '../config/appConfig'
import { publicError } from '../utils/validation'
import { parseInput, tagInputSchema } from '../utils/inputSchemas'

export const tagService = {
  async list() {
    if (appConfig.apiBaseUrl) return apiRequest('/api/tags')
    const { data, error } = await supabase.from('tags').select('id, name').order('name')
    if (error) throw publicError()
    return data
  },

  async createForListing(listingId, names, userId) {
    const cleanNames = [...new Set(names.map((name) => parseInput(tagInputSchema, { name }).name).filter(Boolean))].slice(0, 10)
    if (cleanNames.length === 0) return

    if (appConfig.apiBaseUrl) {
      const tags = []
      for (const name of cleanNames) tags.push(await apiRequest('/api/tags', { method: 'POST', body: { name } }))
      await apiRequest(`/api/listings/${listingId}`, { method: 'PATCH', body: { tagIds: tags.map((tag) => tag.id) } })
      return
    }

    for (const name of cleanNames) {
      const { data: existing, error: findError } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
      if (findError) throw publicError()
      const tag = existing || (await supabase.from('tags').insert({ name, created_by: userId }).select('id').single()).data
      if (!tag) throw publicError()
      const { error } = await supabase.from('listing_tags').upsert({ listing_id: listingId, tag_id: tag.id, created_by: userId })
      if (error) throw publicError()
    }
  },

  async replaceForListing(listingId, names, userId) {
    if (!appConfig.apiBaseUrl) {
      const { error } = await supabase.from('listing_tags').delete().eq('listing_id', listingId).eq('created_by', userId)
      if (error) throw publicError()
    }
    return this.createForListing(listingId, names, userId)
  },
}