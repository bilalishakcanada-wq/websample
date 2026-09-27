import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/*
 * Chat photos, proof of work and verification documents live in the private "uploads" bucket.
 * The database stores a reference ("private:uploads/<path>") instead of a public link, and each
 * viewer gets a short-lived signed link that storage only hands out to people allowed to see it
 * (the sender, the other side of the chat or job, and the Poso.ba team).
 */
const PREFIX = 'private:uploads/'
const TTL_SECONDS = 60 * 60
const cache = new Map() // ref -> { url, expires }

export const isPrivateRef = (value) => typeof value === 'string' && value.startsWith(PREFIX)

/** Uploads a file under the user's own folder and returns the reference to store. */
export async function uploadPrivate(path, file, options = {}) {
  const { error } = await supabase.storage.from('uploads').upload(path, file, { contentType: file.type, ...options })
  if (error) throw error
  return `${PREFIX}${path}`
}

/** Signed link for a reference; old public links are returned as they are. */
export async function privateFileUrl(ref) {
  if (!isPrivateRef(ref)) return ref || ''
  const hit = cache.get(ref)
  if (hit && hit.expires > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('uploads').createSignedUrl(ref.slice(PREFIX.length), TTL_SECONDS)
  if (error || !data?.signedUrl) return ''
  cache.set(ref, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 60) * 1000 })
  return data.signedUrl
}

export function usePrivateFileUrl(ref) {
  const [url, setUrl] = useState(() => (isPrivateRef(ref) ? cache.get(ref)?.url || '' : ref || ''))
  useEffect(() => {
    let active = true
    privateFileUrl(ref).then((next) => { if (active) setUrl(next) })
    return () => { active = false }
  }, [ref])
  return url
}

/** Opens a document in a new tab; the tab is opened first so pop-up blockers allow it. */
export async function openPrivateFile(ref) {
  const tab = window.open('', '_blank')
  const url = await privateFileUrl(ref)
  if (tab && url) tab.location.href = url
  else if (tab) tab.close()
}
