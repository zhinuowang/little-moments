/**
 * Cloud sync settings, read at build time.
 *
 * Sync is OFF unless both values are present, so a build without them is exactly the
 * local-only app. Only the public project URL and the publishable (anon) key may ever be
 * used here; anything that looks like a secret / service-role key is refused outright,
 * because it would bypass Row Level Security for every user.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || ''

/** True when a key must never ship to a browser. */
export function looksSecret(k: string) {
  if (k.startsWith('sb_secret_')) return true
  const parts = k.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload?.role === 'service_role'
    } catch {
      return false
    }
  }
  return false
}

const unsafe = !!key && looksSecret(key)
if (unsafe) console.error('Little Moments: a Supabase secret/service-role key was supplied to the browser build. Cloud sync is disabled.')

export const cloudConfig = { url, key }
export const cloudEnabled = !!url && !!key && !unsafe && /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(url)
