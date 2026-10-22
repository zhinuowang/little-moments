import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { entriesDb, initStorage, kvDb, photosDb, plansDb } from '../db/db'
import { setSoundEnabled } from '../lib/sound'
import { defaultPrefs, type JournalEntry, type Plan, type Prefs } from '../types'

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'love' }

interface Ctx {
  loaded: boolean
  storageOk: boolean
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  entries: JournalEntry[]
  saveEntry: (e: JournalEntry) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  plans: Plan[]
  savePlan: (p: Plan) => Promise<void>
  removePlan: (id: string) => Promise<void>
  isSaved: (activityId: string) => boolean
  toasts: Toast[]
  toast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
  reload: () => Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)

const byDateDesc = (a: JournalEntry, b: JournalEntry) =>
  b.date.localeCompare(a.date) || b.createdAt - a.createdAt

export function AppProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const { t } = useI18n()

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const reload = useCallback(async () => {
    const ok = await initStorage()
    setStorageOk(ok)
    const [e, p, pr] = await Promise.all([entriesDb.all(), plansDb.all(), kvDb.get<Prefs>('prefs')])
    setEntries(e.sort(byDateDesc))
    setPlans(p.sort((a, b) => b.createdAt - a.createdAt))
    setPrefsState({ ...defaultPrefs, ...(pr ?? {}) })
    setLoaded(true)
  }, [])

  useEffect(() => { void reload() }, [reload])

  // apply motion + sound preferences globally
  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('motion-reduce', prefs.motion === 'reduced')
    html.classList.toggle('motion-full', prefs.motion === 'full')
    setSoundEnabled(prefs.sound)
  }, [prefs.motion, prefs.sound])

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...patch }
      kvDb.set('prefs', next).catch(() => toast(t('common.settingsFail'), 'error'))
      return next
    })
  }, [toast, t])

  const saveEntry = useCallback(async (e: JournalEntry) => {
    const prev = entries.find((x) => x.id === e.id)
    try {
      await entriesDb.put(e)
    } catch (err) {
      const quota = err instanceof DOMException && err.name === 'QuotaExceededError'
      toast(quota ? t('editor.saveFull') : t('editor.saveFail'), 'error')
      throw err
    }
    // clean up photos that were replaced or removed
    if (prev) {
      const keep = new Set(e.photoIds.filter(Boolean))
      for (const pid of prev.photoIds) if (pid && !keep.has(pid)) await photosDb.remove(pid).catch(() => {})
    }
    setEntries((list) => [...list.filter((x) => x.id !== e.id), e].sort(byDateDesc))
  }, [entries, toast, t])

  const deleteEntry = useCallback(async (id: string) => {
    const e = entries.find((x) => x.id === id)
    await entriesDb.remove(id)
    if (e) for (const pid of e.photoIds) if (pid) await photosDb.remove(pid).catch(() => {})
    setEntries((list) => list.filter((x) => x.id !== id))
  }, [entries])

  const savePlan = useCallback(async (p: Plan) => {
    try {
      await plansDb.put(p)
    } catch {
      toast(t('plans.saveFail'), 'error')
      return
    }
    setPlans((list) => [p, ...list.filter((x) => x.id !== p.id)].sort((a, b) => b.createdAt - a.createdAt))
  }, [toast, t])

  const removePlan = useCallback(async (id: string) => {
    await plansDb.remove(id)
    setPlans((list) => list.filter((x) => x.id !== id))
  }, [])

  const isSaved = useCallback((activityId: string) => plans.some((p) => p.activityId === activityId), [plans])

  const value = useMemo<Ctx>(() => ({
    loaded, storageOk, prefs, setPrefs, entries, saveEntry, deleteEntry, plans, savePlan, removePlan,
    isSaved, toasts, toast, dismissToast, reload,
  }), [loaded, storageOk, prefs, setPrefs, entries, saveEntry, deleteEntry, plans, savePlan, removePlan, isSaved, toasts, toast, dismissToast, reload])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp must be used inside AppProvider')
  return c
}
