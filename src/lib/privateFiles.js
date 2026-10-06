import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/*
 * Chat photos, proof of work and verification documents live in the private "uploads" bucket.
 * The database stores a reference ("private:uploads/<path>") instead of a public link, and each
 * viewer gets a short-lived signed link that storage only hands out to people allowed to see it
 * (the sender, the other side of the chat or job, and the Zadatak team).
 * Until the database has those rules (supabase/security/06), uploads keep going to the old public
 * "media" bucket, so the site and the SQL can go live in either order.
 */
const PREFIX = 'private:uploads/'
const TTL_SECONDS = 60 * 60
const cache = new Map() // ref -> { url, expires }

export const isPrivateRef = (value) => typeof value === 'string' && value.startsWith(PREFIX)

let enabled = false
let askedAt = 0
/** True once security/06 is on the database. A "yes" is kept; a "no" is asked again after a minute. */
export async function privateUploadsEnabled() {
  if (enabled) return true
  if (Date.now() - askedAt < 60_000) return false
  askedAt = Date.now()
  const { data, error } = await supabase.rpc('private_uploads_enabled')
  enabled = !error && data === true
  return enabled
}

/** Uploads a file under the user's own folder and returns the reference to store. */
export async function uploadPrivate(path, file, options = {}) {
  const { error } = await supabase.storage.from('uploads').upload(path, file, { contentType: file.type, ...options })
  if (error) throw error
  return `${PREFIX}${path}`
}

/**
 * Private bucket when the database has it, otherwise the old public "media" bucket
 * (publicPath, defaults to the same path). Returns what to store: a reference or a public link.
 */
export async function uploadUserFile({ path, publicPath = path, file, cacheControl = '3600', contentType = file.type }) {
  if (await privateUploadsEnabled()) return uploadPrivate(path, file, { cacheControl, contentType })
  const { error } = await supabase.storage.from('media').upload(publicPath, file, { cacheControl, contentType })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(publicPath).data.publicUrl
}

/** Signed link for a reference ('' if this person may not open it); old public links are returned as they are. */
export async function privateFileUrl(ref) {
  if (!isPrivateRef(ref)) return ref || ''
  const hit = cache.get(ref)
  if (hit && hit.expires > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('uploads').createSignedUrl(ref.slice(PREFIX.length), TTL_SECONDS)
  if (error || !data?.signedUrl) return ''
  cache.set(ref, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 60) * 1000 })
  return data.signedUrl
}

/** { url, failed }: url is '' while the signed link loads. */
export function usePrivateFile(ref) {
  const initial = isPrivateRef(ref) ? cache.get(ref)?.url || '' : ref || ''
  const [state, setState] = useState({ ref, url: initial, failed: false })
  useEffect(() => {
    let active = true
    privateFileUrl(ref).then((url) => { if (active) setState({ ref, url, failed: !url }) })
    return () => { active = false }
  }, [ref])
  // a new ref shows its own cached link (or the placeholder), never the previous file
  return state.ref === ref ? state : { ref, url: initial, failed: false }
}

/** Opens a document in a new tab; the tab is opened first so pop-up blockers allow it. */
export async function openPrivateFile(ref) {
  const tab = window.open('', '_blank')
  const url = await privateFileUrl(ref)
  if (tab && url) tab.location.href = url
  else if (tab) tab.close()
}
