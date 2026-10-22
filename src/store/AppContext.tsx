import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { GUEST_DB, accountDbName, consentUploadEntries, currentDatabase, entriesDb, initStorage, kvDb, localOnlyEntries, markDiarySyncStart, photosDb, plansDb, putEntrySynced, putPlanQueued, putPrefsQueued, removeEntrySynced, removePlanQueued, switchDatabase, syncDb } from '../db/db'
import { getClient } from '../lib/cloud/client'
import { downloadPhoto } from '../lib/cloud/sync'
import { useCloudSync, type SyncState } from './useCloudSync'
import { forgetAllPhotoURLs, setRemotePhotoFetcher } from '../lib/usePhoto'
import { useAuth } from './AuthContext'
import { setSoundEnabled } from '../lib/sound'
import { defaultPrefs, type JournalEntry, type Plan, type Prefs } from '../types'

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'love' }

interface Ctx {
  loaded: boolean
  /** whose data is on screen: the guest diary on this device, or the signed-in account's */
  profile: 'guest' | 'account'
  /** nothing has ever been saved on this device (no settings, pages or plans) — a first visit */
  fresh: boolean
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
  /** cloud sync for the signed-in account ('off' for guests) */
  sync: SyncState
  retrySync: () => void
  /** signed in: diary pages on this device that predate diary sync and are not in the cloud */
  localOnlyPages: number
  /** the person agreed to upload those pages (copies — they stay on the device) */
  uploadLocalOnlyPages: () => Promise<number>
  /** how many local changes haven't reached the cloud yet (checked on demand, e.g. before sign-out) */
  pendingChanges: () => Promise<number>
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
  const [fresh, setFresh] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [localOnlyPages, setLocalOnlyPages] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const { t, lang, setLang } = useI18n()
  const auth = useAuth()
  // which device database to use; null while a saved session is still being checked
  const dbName = auth.status === 'checking' ? null
    : auth.status === 'signed-in' && auth.userId ? accountDbName(auth.userId) : GUEST_DB

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
    setFresh(!pr && e.length === 0 && p.length === 0)
    setLoaded(true)
  }, [])

  const accountMode = !!dbName && dbName !== GUEST_DB && auth.status === 'signed-in'
  const langRef = useRef(lang)
  langRef.current = lang
  const applyingRemote = useRef(false)
  const { sync, kick, retry } = useCloudSync({
    userId: auth.userId,
    dbName,
    active: accountMode && loaded,
    onApplied: () => {
      // refresh what's on screen from this profile's database
      const expected = dbName
      void Promise.all([plansDb.all(), kvDb.get<Prefs>('prefs'), entriesDb.all(), localOnlyEntries()]).then(([p, pr, e, lo]) => {
        if (currentDatabase() !== expected) return
        setPlans(p.sort((a, b) => b.createdAt - a.createdAt))
        setPrefsState({ ...defaultPrefs, ...(pr ?? {}) })
        setEntries(e.sort(byDateDesc))
        setLocalOnlyPages(lo.length)
      })
    },
    onRemotePrefs: (p) => {
      const { lang: remoteLang, ...rest } = p
      setPrefsState({ ...defaultPrefs, ...(rest as Prefs) })
      if ((remoteLang === 'en' || remoteLang === 'zh') && remoteLang !== langRef.current) { applyingRemote.current = true; setLang(remoteLang) }
    },
    lang: () => langRef.current,
  })

  // a language change made on this device is a settings change for the account
  const lastLang = useRef(lang)
  useEffect(() => {
    if (lastLang.current === lang) return
    lastLang.current = lang
    if (applyingRemote.current) { applyingRemote.current = false; return }
    if (!accountMode || !loaded) return
    void putPrefsQueued(prefs, Date.now()).then(kick).catch(() => {})
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // load (or switch to) the right profile; switching never deletes anything
  useEffect(() => {
    if (!dbName) { setLoaded(false); return }
    let alive = true
    setLoaded(false)
    ;(async () => {
      await switchDatabase(dbName)
      forgetAllPhotoURLs()
      if (dbName !== GUEST_DB) {
        // pages already here before diary sync started stay local until the person agrees
        await markDiarySyncStart().catch(() => {})
        setLocalOnlyPages((await localOnlyEntries().catch(() => [])).length)
      } else setLocalOnlyPages(0)
      if (alive) await reload()
    })()
    return () => { alive = false }
  }, [dbName, reload])

  // a fresh device can show photos still in the cloud: fetched privately, kept in this profile
  useEffect(() => {
    if (!accountMode || !auth.userId || !dbName) { setRemotePhotoFetcher(null); return }
    const uid = auth.userId
    const expected = dbName
    setRemotePhotoFetcher(async (id) => {
      const blob = await downloadPhoto(await getClient(), uid, id)
      if (blob && currentDatabase() === expected) await photosDb.put({ id, blob, createdAt: Date.now() })
      return currentDatabase() === expected ? blob : null
    })
    return () => setRemotePhotoFetcher(null)
  }, [accountMode, auth.userId, dbName])

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
      const saved = accountMode ? putPrefsQueued(next, Date.now()).then(kick) : kvDb.set('prefs', next)
      saved.catch(() => toast(t('common.settingsFail'), 'error'))
      return next
    })
  }, [toast, t, accountMode, kick])

  const saveEntry = useCallback(async (e: JournalEntry) => {
    const prev = entries.find((x) => x.id === e.id)
    try {
      // signed in: saved here and (for pages that sync) queued for the cloud in one step
      if (accountMode) await putEntrySynced(e); else await entriesDb.put(e)
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
    if (accountMode) kick()
  }, [entries, toast, t, accountMode, kick])

  const deleteEntry = useCallback(async (id: string) => {
    const e = entries.find((x) => x.id === id)
    if (accountMode) await removeEntrySynced(id); else await entriesDb.remove(id)
    // photos: removed from this device; in the cloud their files are kept (never deleted in 3C)
    if (e) for (const pid of e.photoIds) if (pid) await photosDb.remove(pid).catch(() => {})
    setEntries((list) => list.filter((x) => x.id !== id))
    if (accountMode) { kick(); setLocalOnlyPages((await localOnlyEntries().catch(() => [])).length) }
  }, [entries, accountMode, kick])

  const savePlan = useCallback(async (p: Plan) => {
    try {
      // signed in: saved on the device and queued for the cloud in one step
      if (accountMode) await putPlanQueued(p); else await plansDb.put(p)
    } catch {
      toast(t('plans.saveFail'), 'error')
      return
    }
    setPlans((list) => [p, ...list.filter((x) => x.id !== p.id)].sort((a, b) => b.createdAt - a.createdAt))
    if (accountMode) kick()
  }, [toast, t, accountMode, kick])

  const removePlan = useCallback(async (id: string) => {
    if (accountMode) await removePlanQueued(id); else await plansDb.remove(id)
    setPlans((list) => list.filter((x) => x.id !== id))
    if (accountMode) kick()
  }, [accountMode, kick])

  const isSaved = useCallback((activityId: string) => plans.some((p) => p.activityId === activityId), [plans])

  const value = useMemo<Ctx>(() => ({
    loaded, profile: dbName && dbName !== GUEST_DB ? 'account' : 'guest', fresh, storageOk, prefs, setPrefs, entries, saveEntry, deleteEntry, plans, savePlan, removePlan,
    isSaved, sync, retrySync: retry, localOnlyPages,
    uploadLocalOnlyPages: async () => {
      if (!accountMode) return 0
      const n = await consentUploadEntries()
      setLocalOnlyPages(0)
      kick()
      return n
    }, pendingChanges: () => (accountMode ? syncDb.outboxCount() : Promise.resolve(0)),
    toasts, toast, dismissToast, reload,
  }), [loaded, dbName, sync, retry, accountMode, localOnlyPages, kick, fresh, storageOk, prefs, setPrefs, entries, saveEntry, deleteEntry, plans, savePlan, removePlan, isSaved, toasts, toast, dismissToast, reload])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp must be used inside AppProvider')
  return c
}
