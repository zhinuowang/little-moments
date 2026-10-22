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

/**
 * Email links are sent with the implicit flow, so a link opened in a different browser or in a
 * mail app's built-in browser still signs in (PKCE would need the original browser). The tokens
 * come back in the URL fragment and are handed to the main client.
 */
export async function sendEmailSignIn(email: string, redirectTo: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const mailer = createClient(cloudConfig.url, cloudConfig.key, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return mailer.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } })
}

/** True if this browser already holds a session, without loading the library. */
export function hasStoredSession() {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY) } catch { return false }
}

/** Rejects if `p` takes longer than `ms`, so a slow network never leaves the UI hanging. */
export function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}
