import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { takeAuthReturn, rememberReturnRoute } from '../lib/cloud/authReturn'
import { getClient, hasStoredSession, sendEmailSignIn, withTimeout } from '../lib/cloud/client'
import { cloudConfig, cloudEnabled } from '../lib/cloud/config'

/**
 * Who is using the app. Guest is the default and needs nothing from the network.
 * Signing in or out never touches the diary, plans or photos stored on this device —
 * cloud sync is a later phase.
 */

export type AuthStatus = 'off' | 'guest' | 'checking' | 'signed-in'
export type AuthError = 'offline' | 'rate-limit' | 'bad-code' | 'expired' | 'bad-email' | 'send-failed' | 'unknown'

interface Ctx {
  status: AuthStatus
  email: string | null
  /** present only when cloud sign-in is configured for this build */
  enabled: boolean
  sendLink: (email: string) => Promise<AuthError | null>
  verifyCode: (email: string, code: string) => Promise<AuthError | null>
  googleAvailable: () => Promise<'yes' | 'off' | 'unreachable'>
  signInWithGoogle: () => Promise<AuthError | null>
  signOut: () => Promise<void>
  /** status and Supabase error code of the last failure, e.g. "500 · unexpected_failure" — no personal data */
  lastErrorDetail: string | null
  /** set once after returning from a sign-in link: 'signed-in' or an error */
  arrival: 'signed-in' | AuthError | null
  clearArrival: () => void
}

const AuthCtx = createContext<Ctx | null>(null)

let lastDetail: string | null = null

function classify(err: unknown, sending = false): AuthError {
  const e = err as { status?: number; code?: string; message?: string } | null
  const msg = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase()
  lastDetail = [e?.status, e?.code].filter(Boolean).join(' · ') || null
  if (lastDetail) console.warn('Little Moments sign-in:', lastDetail) // status + code only, never the address or code
  // the email service refused or failed to send (e.g. Resend's test sender only reaches its own account)
  if (sending && ((e?.status ?? 0) >= 500 || msg.includes('unexpected_failure') || msg.includes('sending') || msg.includes('smtp'))) return 'send-failed'
  if (!navigator.onLine || msg.includes('timeout') || msg.includes('fetch') || msg.includes('network')) return 'offline'
  if (e?.status === 429 || msg.includes('rate') || msg.includes('too many')) return 'rate-limit'
  if (msg.includes('expired')) return 'expired'
  if (msg.includes('invalid') && msg.includes('email')) return 'bad-email'
  if (msg.includes('otp') || msg.includes('token') || msg.includes('invalid')) return 'bad-code'
  return 'unknown'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(cloudEnabled ? 'guest' : 'off')
  const [email, setEmail] = useState<string | null>(null)
  const [arrival, setArrival] = useState<Ctx['arrival']>(null)
  const watching = useRef(false)

  const watch = useCallback((sb: SupabaseClient) => {
    if (watching.current) return
    watching.current = true
    sb.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null)
      setStatus(session ? 'signed-in' : 'guest')
    })
  }, [])

  // On start: finish a sign-in that came back through the URL, or restore a saved session.
  useEffect(() => {
    if (!cloudEnabled) return
    const ret = takeAuthReturn()
    if (!ret && !hasStoredSession()) return // a guest — don't load anything
    let alive = true
    setStatus('checking')
    ;(async () => {
      try {
        const sb = await withTimeout(getClient())
        watch(sb)
        if (ret?.kind === 'error') {
          setArrival(ret.code.includes('expired') ? 'expired' : 'unknown')
        } else if (ret?.kind === 'tokens') {
          const { error } = await withTimeout(sb.auth.setSession({ access_token: ret.accessToken, refresh_token: ret.refreshToken }))
          setArrival(error ? classify(error) : 'signed-in')
        } else if (ret?.kind === 'code') {
          const { error } = await withTimeout(sb.auth.exchangeCodeForSession(ret.code))
          setArrival(error ? classify(error) : 'signed-in')
        }
        const { data } = await withTimeout(sb.auth.getSession())
        if (!alive) return
        setEmail(data.session?.user.email ?? null)
        setStatus(data.session ? 'signed-in' : 'guest')
      } catch (err) {
        // can't reach the cloud: keep a saved session as-is and stay usable on this device
        if (!alive) return
        if (ret && ret.kind !== 'error') setArrival(classify(err))
        setStatus(hasStoredSession() ? 'signed-in' : 'guest')
      }
    })()
    return () => { alive = false }
  }, [watch])

  const redirectTo = () => `${window.location.origin}${import.meta.env.BASE_URL}`

  const sendLink = useCallback(async (address: string) => {
    try {
      rememberReturnRoute()
      lastDetail = null
      const { error } = await withTimeout(sendEmailSignIn(address.trim(), redirectTo()))
      return error ? classify(error, true) : null
    } catch (err) { return classify(err, true) }
  }, [])

  const verifyCode = useCallback(async (address: string, code: string) => {
    try {
      const sb = await withTimeout(getClient())
      watch(sb)
      const { error } = await withTimeout(sb.auth.verifyOtp({ email: address.trim(), token: code, type: 'email' }))
      return error ? classify(error) : null
    } catch (err) { return classify(err) }
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

  const signInWithGoogle = useCallback(async () => {
    try {
      const sb = await withTimeout(getClient())
      rememberReturnRoute()
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
      return error ? classify(error) : null
    } catch (err) { return classify(err) }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const sb = await withTimeout(getClient())
      await withTimeout(sb.auth.signOut({ scope: 'local' }))
    } catch {
      try { localStorage.removeItem('lm-auth') } catch { /* fine */ }
    }
    setEmail(null)
    setStatus('guest')
  }, [])

  const value = useMemo<Ctx>(() => ({
    status, email, enabled: cloudEnabled, sendLink, verifyCode, googleAvailable, signInWithGoogle, signOut,
    get lastErrorDetail() { return lastDetail },
    arrival, clearArrival: () => setArrival(null),
  }), [status, email, sendLink, verifyCode, googleAvailable, signInWithGoogle, signOut, arrival])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
