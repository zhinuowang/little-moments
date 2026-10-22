import type { SupabaseClient } from '@supabase/supabase-js'
import { cloudConfig, cloudEnabled } from './config'

/**
 * The Supabase client, loaded on demand. Guests never download it: it's fetched only when
 * someone opens the sign-in sheet, returns from a sign-in link, or already has a session.
 */

export const AUTH_STORAGE_KEY = 'lm-auth'

let main: Promise<SupabaseClient> | null = null

export function getClient(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('cloud sync is not configured'))
  if (!main) {
    main = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(cloudConfig.url, cloudConfig.key, {
        auth: {
          flowType: 'pkce', // Google: ?code= comes back to this same browser
          detectSessionInUrl: false, // the app reads the URL itself (it uses #/ routes)
          persistSession: true,
          autoRefreshToken: true,
          storageKey: AUTH_STORAGE_KEY,
        },
      }),
    )
    main.catch(() => { main = null })
  }
  return main
}

/** True if this browser already holds a session, without loading the library. */
export function hasStoredSession() {
  return storedUserId() !== null
}

/** The signed-in user's id from the saved session — read locally, so it works offline. */
export function storedUserId(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const id = raw ? (JSON.parse(raw) as { user?: { id?: unknown } })?.user?.id : null
    return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null
  } catch { return null }
}

/** Rejects if `p` takes longer than `ms`, so a slow network never leaves the UI hanging. */
export function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}
