import { useCallback, useEffect, useRef, useState } from 'react'
import { syncDb } from '../db/db'
import { getClient, withTimeout } from '../lib/cloud/client'
import { SyncError, syncAccount, type SyncFailure } from '../lib/cloud/sync'
import type { Prefs } from '../types'

/**
 * Runs cloud sync for the signed-in account: on start, shortly after each local change, when the
 * connection comes back, when the tab is shown again, and on a retry timer with back-off.
 * One sync at a time. Guests never sync.
 */

export interface SyncState {
  /** 'off' for guests; 'synced' only after Supabase confirmed everything */
  status: 'off' | 'syncing' | 'synced' | 'waiting' | 'error'
  pending: number
  failure: SyncFailure | null
  lastSynced: number | null
}

const BACKOFF = [5_000, 15_000, 60_000, 180_000]

export function useCloudSync(opts: {
  userId: string | null
  dbName: string | null
  active: boolean
  onApplied: () => void
  onRemotePrefs: (p: Prefs & { lang?: string }) => void
  lang: () => string
}) {
  const { userId, dbName, active } = opts
  const [state, setState] = useState<SyncState>({ status: 'off', pending: 0, failure: null, lastSynced: null })
  const running = useRef(false)
  const again = useRef(false)
  const attempt = useRef(0)
  const retryTimer = useRef(0)
  const debounce = useRef(0)
  const hooks = useRef(opts)
  hooks.current = opts

  const run = useCallback(async () => {
    if (!active || !userId || !dbName) return
    if (running.current) { again.current = true; return }
    running.current = true
    clearTimeout(retryTimer.current)
    setState((s) => ({ ...s, status: 'syncing' }))
    try {
      const sb = await withTimeout(getClient())
      const r = await withTimeout(syncAccount(sb, userId, dbName, {
        onRemotePrefs: (p) => hooks.current.onRemotePrefs(p),
        lang: () => hooks.current.lang(),
      }), 45_000)
      attempt.current = 0
      if (r.applied > 0 || r.pushed > 0) hooks.current.onApplied()
      if (r.blocked) {
        // nothing a retry can fix: say so once and wait for the next change or visit
        setState({ status: 'error', pending: r.pending, failure: r.blocked, lastSynced: Date.now() })
      } else {
        setState({ status: r.pending === 0 ? 'synced' : 'waiting', pending: r.pending, failure: null, lastSynced: Date.now() })
        if (r.pending > 0) again.current = true
      }
    } catch (err) {
      const failure: SyncFailure = err instanceof SyncError ? err.kind : (err as Error)?.message === 'timeout' || !navigator.onLine ? 'offline' : 'server'
      if (failure === 'switched') { running.current = false; return } // signed out mid-sync: stop quietly
      let pending = 0
      try { pending = await syncDb.outboxCount() } catch { /* fine */ }
      setState((s) => ({ ...s, status: failure === 'offline' ? 'waiting' : 'error', pending, failure }))
      const wait = BACKOFF[Math.min(attempt.current++, BACKOFF.length - 1)]
      if (failure !== 'auth') retryTimer.current = window.setTimeout(() => void run(), wait)
    } finally {
      running.current = false
    }
    if (again.current) { again.current = false; window.setTimeout(() => void run(), 400) }
  }, [active, userId, dbName])

  /** call after any local change: syncs shortly after, batching quick edits together */
  const kick = useCallback(() => {
    if (!active) return
    setState((s) => (s.status === 'off' ? s : { ...s, status: s.status === 'syncing' ? 'syncing' : 'waiting', pending: Math.max(1, s.pending) }))
    clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => void run(), 800)
  }, [active, run])

  useEffect(() => {
    if (!active) { setState({ status: 'off', pending: 0, failure: null, lastSynced: null }); return }
    attempt.current = 0
    void run()
    const online = () => { attempt.current = 0; void run() }
    const visible = () => { if (document.visibilityState === 'visible') void run() }
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visible)
    const tick = window.setInterval(() => void run(), 5 * 60_000)
    return () => {
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', visible)
      clearInterval(tick); clearTimeout(retryTimer.current); clearTimeout(debounce.current)
    }
  }, [active, run])

  return { sync: state, kick, retry: () => { attempt.current = 0; void run() } }
}
