import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { takeAuthReturn, rememberReturnRoute } from '../lib/cloud/authReturn'
import { AUTH_STORAGE_KEY, getClient, storedUserId, withTimeout } from '../lib/cloud/client'
import { cloudConfig, cloudEnabled } from '../lib/cloud/config'
import { setEntry } from '../lib/entry'

/**
 * Who is using the app: a guest (the default, nothing from the network) or a Google account.
 * Signing in, signing out or a session ending never deletes anything on this device; the app
 * just switches which profile's data it shows (see AppContext / db.ts).
 */

export type AuthStatus = 'off' | 'guest' | 'checking' | 'signed-in'
export type AuthError = 'offline' | 'cancelled' | 'unknown'

interface Ctx {
  status: AuthStatus
  /** the signed-in account's id — known from the saved session even when offline */
  userId: string | null
  email: string | null
  /** cloud sign-in is configured for this build */
  enabled: boolean
  googleAvailable: () => Promise<'yes' | 'off' | 'unreachable'>
  signInWithGoogle: () => Promise<AuthError | null>
  signOut: () => Promise<void>
  /** set once after returning from Google, or when a session ran out */
  arrival: 'signed-in' | 'session-ended' | AuthError | null
  clearArrival: () => void
}

const AuthCtx = createContext<Ctx | null>(null)

function classify(err: unknown): AuthError {
  const e = err as { status?: number; code?: string; message?: string } | null
  const msg = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase()
  const detail = [e?.status, e?.code].filter(Boolean).join(' · ')
  if (detail) console.warn('Little Moments sign-in:', detail) // status + code only, never tokens
  if (!navigator.onLine || msg.includes('timeout') || msg.includes('fetch') || msg.includes('network')) return 'offline'
  if (msg.includes('access_denied') || msg.includes('cancel')) return 'cancelled'
  return 'unknown'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialUser = cloudEnabled ? storedUserId() : null
  const [status, setStatus] = useState<AuthStatus>(!cloudEnabled ? 'off' : initialUser ? 'checking' : 'guest')
  const [userId, setUserId] = useState<string | null>(initialUser)
  const [email, setEmail] = useState<string | null>(null)
  const [arrival, setArrival] = useState<Ctx['arrival']>(null)
  const watching = useRef(false)
  const leaving = useRef(false) // true while we sign out on purpose
  const wasSignedIn = useRef(false)

  const watch = useCallback((sb: SupabaseClient) => {
    if (watching.current) return
    watching.current = true
    sb.auth.onAuthStateChange((event, session) => {
      if (session) {
        wasSignedIn.current = true
        setEntry('account')
      } else if (event === 'SIGNED_OUT' && wasSignedIn.current && !leaving.current) {
        // the session ran out or was revoked elsewhere: show the guest view, keep everything
        setArrival('session-ended')
      }
      if (!session) wasSignedIn.current = false
      setUserId(session?.user.id ?? null)
      setEmail(session?.user.email ?? null)
      setStatus(session ? 'signed-in' : 'guest')
    })
  }, [])

  // On start: finish a Google sign-in that came back through the URL, or restore a saved session.
  useEffect(() => {
    if (!cloudEnabled) return
    const ret = takeAuthReturn()
    if (!ret && !storedUserId()) return // a guest — don't load anything
    let alive = true
    setStatus('checking')
    ;(async () => {
      try {
        const sb = await withTimeout(getClient())
        watch(sb)
        if (ret?.kind === 'error') {
          setArrival(ret.code.includes('access_denied') ? 'cancelled' : 'unknown')
        } else if (ret?.kind === 'code') {
          const { error } = await withTimeout(sb.auth.exchangeCodeForSession(ret.code))
          setArrival(error ? classify(error) : 'signed-in')
        }
        const { data } = await withTimeout(sb.auth.getSession())
        if (!alive) return
        if (data.session) { wasSignedIn.current = true; setEntry('account') }
        setUserId(data.session?.user.id ?? null)
        setEmail(data.session?.user.email ?? null)
        setStatus(data.session ? 'signed-in' : 'guest')
      } catch (err) {
        // offline: keep the saved session's account (its data is on this device) and carry on
        if (!alive) return
        if (ret && ret.kind !== 'error') setArrival(classify(err))
        const id = storedUserId()
        setUserId(id)
        setStatus(id ? 'signed-in' : 'guest')
      }
    })()
    return () => { alive = false }
  }, [watch])

  const googleAvailable = useCallback(async (): Promise<'yes' | 'off' | 'unreachable'> => {
    try {
      const res = await withTimeout(fetch(`${cloudConfig.url}/auth/v1/settings`, { headers: { apikey: cloudConfig.key } }), 6000)
      const s = await res.json()
      if (!s?.external?.google) return 'off'
    } catch { return 'unreachable' }
    try {
      // where Google is blocked this never connects; don't send people to a dead page
      await withTimeout(fetch('https://accounts.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' }), 3500)
      return 'yes'
    } catch { return 'unreachable' }
  }, [])

  // Google comes back here — locally or under /little-moments/ on GitHub Pages
  const signInWithGoogle = useCallback(async () => {
    try {
      const sb = await withTimeout(getClient())
      rememberReturnRoute()
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`, queryParams: { prompt: 'select_account' } },
      })
      return error ? classify(error) : null
    } catch (err) { return classify(err) }
  }, [])

  const signOut = useCallback(async () => {
    leaving.current = true
    try {
      const sb = await withTimeout(getClient())
      await withTimeout(sb.auth.signOut({ scope: 'local' }))
    } catch {
      try { localStorage.removeItem(AUTH_STORAGE_KEY) } catch { /* fine */ }
    }
    leaving.current = false
    wasSignedIn.current = false
    setUserId(null)
    setEmail(null)
    setStatus('guest')
  }, [])

  const value = useMemo<Ctx>(() => ({
    status, userId, email, enabled: cloudEnabled, googleAvailable, signInWithGoogle, signOut,
    arrival, clearArrival: () => setArrival(null),
  }), [status, userId, email, googleAvailable, signInWithGoogle, signOut, arrival])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
