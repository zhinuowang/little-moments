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
 * Sends the sign-in email. The email templates turn it into a link back to `redirectTo` with a
 * one-time `token_hash`; the app then calls verifyOtp itself (see authReturn.ts / AuthContext).
 * That works when the link is opened in another browser or a mail app, keeps session tokens out
 * of the address bar, and isn't used up by mail scanners that pre-open links.
 */
export async function sendEmailSignIn(email: string, redirectTo: string) {
  const sb = await getClient()
  return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } })
}

/** True if this browser already holds a session, without loading the library. */
export function hasStoredSession() {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY) } catch { return false }
}

/** Rejects if `p` takes longer than `ms`, so a slow network never leaves the UI hanging. */
export function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}
