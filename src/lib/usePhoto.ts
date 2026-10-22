import { useEffect, useState } from 'react'
import { photosDb } from '../db/db'

const cache = new Map<string, string>()

export function forgetPhotoURL(id: string) {
  const u = cache.get(id)
  if (u) URL.revokeObjectURL(u)
  cache.delete(id)
}

export async function photoURL(id: string): Promise<string | null> {
  const hit = cache.get(id)
  if (hit) return hit
  const rec = await photosDb.get(id)
  if (!rec) return null
  const url = URL.createObjectURL(rec.blob)
  cache.set(id, url)
  return url
}

/** Resolves a stored photo id into an object URL (cached for the session). */
export function usePhotoURL(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(id ? cache.get(id) ?? null : null)
  useEffect(() => {
    let alive = true
    if (!id) { setUrl(null); return }
    photoURL(id).then((u) => { if (alive) setUrl(u) }).catch(() => { if (alive) setUrl(null) })
    return () => { alive = false }
  }, [id])
  return url
}

/** Unsaved photos live only in memory until the page is saved. */
export function registerTempPhoto(id: string, blob: Blob) {
  cache.set(id, URL.createObjectURL(blob))
}
