import type { SupabaseClient } from '@supabase/supabase-js'
import * as store from '../../db/db'
import type { OutboxItem } from '../../db/db'
import type { JournalEntry, Plan, Prefs } from '../../types'
import { uid } from '../util'

/**
 * Cloud sync for one signed-in account — Plans and settings (Phase 3B). See docs/SYNC.md.
 *
 * 1. pull   what changed on the server since the last pull (2-minute overlap), skipping any record
 *           with a local change still waiting — the push decides those.
 * 2. adopt  account records that exist only on this device and were never uploaded.
 * 3. push   the outbox, oldest first. Every write is guarded by the server `rev` it was based on, so
 *           a stale device can't overwrite newer content. Nothing is marked done until Supabase
 *           confirms it. An empty device has nothing queued, so it can never wipe cloud data.
 *
 * Conflicts: a Plan edited on two devices keeps BOTH (the local one as a copy with a new id); a
 * delete never beats a newer edit. Settings: the most recently changed version wins.
 */

export type SyncFailure = 'offline' | 'auth' | 'server' | 'switched' | 'quota'
export class SyncError extends Error {
  constructor(public kind: SyncFailure, message: string) { super(message) }
}

export interface SyncResult {
  applied: number; pushed: number; pending: number
  /** some pages couldn't upload because this account reached its photo limit; they stay here */
  blocked?: 'quota'
}

export interface SyncHooks {
  /** settings arrived from another device and were saved locally */
  onRemotePrefs: (prefs: Prefs & { lang?: string }) => void
  /** the current interface language, stored with the settings */
  lang: () => string
}

/**
 * Every device read/write goes through this guard. The check and the call happen in the same
 * synchronous tick (each store function grabs its database before its first await), so if the
 * person signs out or switches account mid-sync, nothing is ever written into the other profile.
 */
let expectedDb = ''
function g() { if (store.currentDatabase() !== expectedDb) throw new SyncError('switched', 'profile changed during sync') }
const plansDb = { all: () => (g(), store.plansDb.all()) }
const entriesDb = { all: () => (g(), store.entriesDb.all()), get: (id: string) => (g(), store.entriesDb.get(id)) }
const photosDb = {
  get: (id: string) => (g(), store.photosDb.get(id)),
  put: (p: { id: string; blob: Blob; createdAt: number }) => (g(), store.photosDb.put(p)),
}
const applyRemoteEntry = (e: JournalEntry | null, id: string, rev: number) => (g(), store.applyRemoteEntry(e, id, rev))
const putEntryQueued = (e: JournalEntry) => (g(), store.putEntryQueued(e))
const putEntrySynced = (e: JournalEntry) => (g(), store.putEntrySynced(e))
const kvDb = {
  get: <T,>(k: string) => (g(), store.kvDb.get<T>(k)),
  set: (k: string, v: unknown) => (g(), store.kvDb.set(k, v)),
}
const syncDb = {
  outbox: () => (g(), store.syncDb.outbox()),
  outboxCount: () => (g(), store.syncDb.outboxCount()),
  revs: (t: store.SyncTable) => (g(), store.syncDb.revs(t)),
  getRev: (t: store.SyncTable, id: string) => (g(), store.syncDb.getRev(t, id)),
  setRev: (t: store.SyncTable, id: string, rev: number) => (g(), store.syncDb.setRev(t, id, rev)),
  getCursor: (t: store.SyncTable) => (g(), store.syncDb.getCursor(t)),
  setCursor: (t: store.SyncTable, iso: string) => (g(), store.syncDb.setCursor(t, iso)),
  hasOutbox: (t: store.SyncTable, id: string) => (g(), store.syncDb.hasOutbox(t, id)),
  confirmOutbox: (item: OutboxItem, rev: number | null) => (g(), store.syncDb.confirmOutbox(item, rev)),
  dropOutbox: (t: store.SyncTable, id: string) => (g(), store.syncDb.dropOutbox(t, id)),
}
const applyRemotePlan = (p: Plan | null, id: string, rev: number) => (g(), store.applyRemotePlan(p, id, rev))
const putPlanQueued = (p: Plan) => (g(), store.putPlanQueued(p))
const putPrefsQueued = (prefs: unknown, at: number) => (g(), store.putPrefsQueued(prefs, at))

const OVERLAP_MS = 2 * 60 * 1000
const PAGE = 500

function fail(err: { message?: string; code?: string; status?: number } | null | undefined): never {
  const m = `${err?.code ?? ''} ${err?.message ?? ''}`
  const status = err?.status ?? 0
  if (/failed to fetch|networkerror|load failed|network|timeout/i.test(m)) throw new SyncError('offline', m)
  if (status === 401 || /jwt|PGRST30[0-3]|not authenticated/i.test(m)) throw new SyncError('auth', m)
  throw new SyncError('server', m.trim() || `status ${status}`)
}

/** Order-independent JSON, so the same plan compares equal however its keys were written. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v)
}

const isPlan = (x: unknown, id: string): x is Plan =>
  !!x && typeof x === 'object' && (x as Plan).id === id && typeof (x as Plan).createdAt === 'number'

interface PlanRow { id: string; data: unknown; rev: number; updated_at: string; deleted_at: string | null }
interface SettingsRow { prefs: Prefs & { lang?: string }; rev: number; client_updated_at: string }

export async function syncAccount(sb: SupabaseClient, userId: string, dbName: string, hooks: SyncHooks): Promise<SyncResult> {
  expectedDb = dbName
  g()
  let applied = 0
  let pushed = 0

  applied += await pullPlans(sb)
  applied += await pullSettings(sb, hooks)
  applied += await pullEntries(sb)
  await adoptLocal(sb)

  let blocked: SyncResult['blocked']
  for (const item of await syncDb.outbox()) {
    try {
      if (item.table === 'plans') await (item.op === 'delete' ? pushPlanDelete(sb, item) : pushPlan(sb, item))
      else if (item.table === 'entries') await (item.op === 'delete' ? pushEntryDelete(sb, item) : pushEntry(sb, userId, item))
      else if (item.table === 'settings') await pushSettings(sb, userId, item, hooks)
      else await syncDb.dropOutbox(item.table, item.id) // photos travel with their page
      pushed++
    } catch (err) {
      // photo limit reached: this page stays queued here; everything else still syncs
      if (err instanceof SyncError && err.kind === 'quota') { blocked = 'quota'; continue }
      throw err
    }
  }
  applied += await fetchMissingPhotos(sb, userId)
  return { applied, pushed, pending: await syncDb.outboxCount(), blocked }
}

/* ───────────── pull ───────────── */

async function pullPlans(sb: SupabaseClient) {
  let applied = 0
  const cursor = await syncDb.getCursor('plans')
  let since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null
  let newest = cursor ?? null
  const revs = await syncDb.revs('plans')
  for (let page = 0; page < 40; page++) {
    let q = sb.from('plans').select('id,data,rev,updated_at,deleted_at').order('updated_at', { ascending: true }).limit(PAGE)
    if (since) q = q.gt('updated_at', since)
    const { data, error } = await q
    if (error) fail(error)
    const rows = (data ?? []) as PlanRow[]
    for (const row of rows) {
      if (!newest || Date.parse(row.updated_at) > Date.parse(newest)) newest = row.updated_at
      if ((revs.get(row.id) ?? 0) >= row.rev) continue // already have this version
      if (await syncDb.hasOutbox('plans', row.id)) continue // a local change is waiting; push resolves it
      if (row.deleted_at) { await applyRemotePlan(null, row.id, row.rev); applied++ }
      else if (isPlan(row.data, row.id)) { await applyRemotePlan(row.data, row.id, row.rev); applied++ }
    }
    if (rows.length < PAGE) break
    since = rows[rows.length - 1].updated_at
  }
  if (newest) await syncDb.setCursor('plans', newest)
  return applied
}

async function pullSettings(sb: SupabaseClient, hooks: SyncHooks) {
  const { data, error } = await sb.from('user_settings').select('prefs,rev,client_updated_at').maybeSingle()
  if (error) fail(error)
  const row = data as SettingsRow | null
  if (!row) return 0
  const localRev = (await syncDb.getRev('settings', 'me')) ?? 0
  if (row.rev <= localRev || (await syncDb.hasOutbox('settings', 'me'))) return 0
  const localAt = (await kvDb.get<number>('prefs:updatedAt')) ?? 0
  const remoteAt = Date.parse(row.client_updated_at)
  if (remoteAt >= localAt) {
    await saveRemotePrefs(row, hooks)
    return 1
  }
  // this device changed settings more recently but never queued them (from before sync): send ours
  await putPrefsQueued((await kvDb.get('prefs')) ?? {}, localAt)
  await syncDb.confirmOutbox({ table: 'settings', id: 'me', op: 'upsert', baseRev: null, at: -1 }, row.rev)
  return 0
}

async function saveRemotePrefs(row: SettingsRow, hooks: SyncHooks) {
  const { lang, ...prefs } = row.prefs ?? ({} as SettingsRow['prefs'])
  await kvDb.set('prefs', prefs)
  await kvDb.set('prefs:updatedAt', Date.parse(row.client_updated_at))
  await syncDb.setRev('settings', 'me', row.rev)
  hooks.onRemotePrefs({ ...(prefs as Prefs), lang })
}

/* ───────────── adopt records that exist only on this device ───────────── */

async function adoptLocal(sb: SupabaseClient) {
  void sb
  // diary pages: only those allowed to sync (new since diary sync started, or after consent) —
  // putEntrySynced leaves earlier pages strictly local
  const entryRevs = await syncDb.revs('entries')
  for (const e of await entriesDb.all()) {
    if (!entryRevs.has(e.id) && !(await syncDb.hasOutbox('entries', e.id))) await putEntrySynced(e)
  }
  const revs = await syncDb.revs('plans')
  for (const p of await plansDb.all()) {
    if (!revs.has(p.id) && !(await syncDb.hasOutbox('plans', p.id))) await putPlanQueued(p)
  }
  const settingsRev = await syncDb.getRev('settings', 'me')
  const localPrefs = await kvDb.get('prefs')
  if (settingsRev === undefined && localPrefs && !(await syncDb.hasOutbox('settings', 'me'))) {
    await putPrefsQueued(localPrefs, (await kvDb.get<number>('prefs:updatedAt')) ?? 0)
  }
}

/* ───────────── push: plans ───────────── */

async function fetchPlan(sb: SupabaseClient, id: string): Promise<PlanRow | null> {
  const { data, error } = await sb.from('plans').select('id,data,rev,updated_at,deleted_at').eq('id', id).maybeSingle()
  if (error) fail(error)
  return data as PlanRow | null
}

async function pushPlan(sb: SupabaseClient, item: OutboxItem) {
  const local = (await plansDb.all()).find((p) => p.id === item.id)
  if (!local) { await syncDb.dropOutbox('plans', item.id); return } // superseded locally
  const body = { data: local, client_updated_at: new Date(item.at).toISOString(), deleted_at: null }

  if (item.baseRev === null) {
    const { data, error } = await sb.from('plans').insert({ id: item.id, ...body }).select('rev').single()
    if (!error) return syncDb.confirmOutbox(item, (data as { rev: number }).rev)
    if (error.code !== '23505') fail(error)
    // already there — a retried upload, or uploaded earlier from this account on another device
    return resolvePlanConflict(sb, item, local, await fetchPlan(sb, item.id))
  }

  const { data, error } = await sb.from('plans').update(body).eq('id', item.id).eq('rev', item.baseRev).select('rev')
  if (error) fail(error)
  if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
  return resolvePlanConflict(sb, item, local, await fetchPlan(sb, item.id))
}

async function resolvePlanConflict(sb: SupabaseClient, item: OutboxItem, local: Plan, server: PlanRow | null) {
  if (!server) {
    // the row no longer exists at all: upload ours fresh
    const { data, error } = await sb.from('plans').insert({ id: item.id, data: local, client_updated_at: new Date(item.at).toISOString() }).select('rev').single()
    if (error) fail(error)
    return syncDb.confirmOutbox(item, (data as { rev: number }).rev)
  }
  if (!server.deleted_at && canon(server.data) === canon(local)) return syncDb.confirmOutbox(item, server.rev) // same content
  if (server.deleted_at) {
    // deleted on another device, edited here: the edit wins and the plan comes back
    const { data, error } = await sb.from('plans').update({ data: local, client_updated_at: new Date(item.at).toISOString(), deleted_at: null }).eq('id', item.id).eq('rev', server.rev).select('rev')
    if (error) fail(error)
    if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
    return // changed again meanwhile; next round
  }
  // edited on two devices: keep both. The server's version keeps this id; ours becomes a copy.
  const copy: Plan = { ...local, id: uid() }
  if (isPlan(server.data, item.id)) await applyRemotePlan(server.data, item.id, server.rev)
  await syncDb.confirmOutbox(item, server.rev)
  await putPlanQueued(copy)
}

async function pushPlanDelete(sb: SupabaseClient, item: OutboxItem) {
  if (item.baseRev === null) { await syncDb.dropOutbox('plans', item.id); return }
  // a deletion keeps only the marker other devices need, not the plan itself
  const { data, error } = await sb.from('plans').update({ data: {}, deleted_at: new Date().toISOString(), client_updated_at: new Date(item.at).toISOString() }).eq('id', item.id).eq('rev', item.baseRev).select('rev')
  if (error) fail(error)
  if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
  const server = await fetchPlan(sb, item.id)
  if (!server || server.deleted_at) return syncDb.confirmOutbox(item, server?.rev ?? null) // already gone
  // changed on another device after we deleted it here: the newer edit wins — bring it back
  if (isPlan(server.data, item.id)) await applyRemotePlan(server.data, item.id, server.rev)
  await syncDb.confirmOutbox(item, server.rev)
}

/* ───────────── push: settings ───────────── */

async function pushSettings(sb: SupabaseClient, userId: string, item: OutboxItem, hooks: SyncHooks) {
  const prefs = (await kvDb.get<Prefs>('prefs')) ?? {}
  const at = (await kvDb.get<number>('prefs:updatedAt')) ?? item.at
  const body = { prefs: { ...prefs, lang: hooks.lang() }, client_updated_at: new Date(at).toISOString() }

  if (item.baseRev === null) {
    const { data, error } = await sb.from('user_settings').insert(body).select('rev').single()
    if (!error) return syncDb.confirmOutbox(item, (data as { rev: number }).rev)
    if (error.code !== '23505') fail(error)
  } else {
    const { data, error } = await sb.from('user_settings').update(body).eq('user_id', userId).eq('rev', item.baseRev).select('rev')
    if (error) fail(error)
    if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
  }
  // the cloud copy changed elsewhere: the more recently changed settings win
  const { data, error } = await sb.from('user_settings').select('prefs,rev,client_updated_at').maybeSingle()
  if (error) fail(error)
  const row = data as SettingsRow | null
  if (!row) return // vanished; retried next round as a fresh insert
  if (Date.parse(row.client_updated_at) > at) {
    await syncDb.confirmOutbox(item, row.rev)
    await saveRemotePrefs(row, hooks)
    return
  }
  const res = await sb.from('user_settings').update(body).eq('user_id', userId).eq('rev', row.rev).select('rev')
  if (res.error) fail(res.error)
  if ((res.data ?? []).length === 1) await syncDb.confirmOutbox(item, (res.data as { rev: number }[])[0].rev)
}

/* ───────────── diary pages ───────────── */

interface EntryRow { id: string; data: unknown; rev: number; updated_at: string; deleted_at: string | null }

const isEntry = (x: unknown, id: string): x is JournalEntry =>
  !!x && typeof x === 'object' && (x as JournalEntry).id === id && typeof (x as JournalEntry).date === 'string' &&
  typeof (x as JournalEntry).createdAt === 'number' && Array.isArray((x as JournalEntry).photoIds) && Array.isArray((x as JournalEntry).stickers)

async function pullEntries(sb: SupabaseClient) {
  let applied = 0
  const cursor = await syncDb.getCursor('entries')
  let since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null
  let newest = cursor ?? null
  const revs = await syncDb.revs('entries')
  for (let page = 0; page < 40; page++) {
    let q = sb.from('journal_entries').select('id,data,rev,updated_at,deleted_at').order('updated_at', { ascending: true }).limit(PAGE)
    if (since) q = q.gt('updated_at', since)
    const { data, error } = await q
    if (error) fail(error)
    const rows = (data ?? []) as EntryRow[]
    for (const row of rows) {
      if (!newest || Date.parse(row.updated_at) > Date.parse(newest)) newest = row.updated_at
      const localRev = revs.get(row.id)
      if ((localRev ?? 0) >= row.rev) continue
      if (await syncDb.hasOutbox('entries', row.id)) continue // a local change is waiting; push resolves it
      // never overwrite a page that exists here but was never uploaded — it's resolved on upload
      if (localRev === undefined && (await entriesDb.get(row.id))) continue
      if (row.deleted_at) { await applyRemoteEntry(null, row.id, row.rev); applied++ }
      else if (isEntry(row.data, row.id)) { await applyRemoteEntry(row.data, row.id, row.rev); applied++ }
    }
    if (rows.length < PAGE) break
    since = rows[rows.length - 1].updated_at
  }
  if (newest) await syncDb.setCursor('entries', newest)
  return applied
}

async function fetchEntry(sb: SupabaseClient, id: string): Promise<EntryRow | null> {
  const { data, error } = await sb.from('journal_entries').select('id,data,rev,updated_at,deleted_at').eq('id', id).maybeSingle()
  if (error) fail(error)
  return data as EntryRow | null
}

/** Upload every photo a page uses (private bucket, the owner's folder) before the page itself. */
async function ensurePhotos(sb: SupabaseClient, userId: string, e: JournalEntry) {
  for (const pid of e.photoIds) {
    if (!pid || (await syncDb.getRev('photos', pid)) !== undefined) continue
    const rec = await photosDb.get(pid)
    if (!rec) continue // not on this device — then it came from the cloud and is already there
    const path = `${userId}/${pid}`
    const type = rec.blob.type && /^image\/(jpeg|png|webp)$/.test(rec.blob.type) ? rec.blob.type : 'image/jpeg'
    const up = await sb.storage.from('journal-photos').upload(path, rec.blob, { contentType: type, upsert: false })
    if (up.error) {
      const m = `${(up.error as { statusCode?: string }).statusCode ?? ''} ${up.error.message}`
      if (/row-level security/i.test(m)) {
        // signed in, this is the only upload rule an owner can fail; without a session it's sign-in
        if (!(await sb.auth.getSession()).data.session) throw new SyncError('auth', 'session ended')
        throw new SyncError('quota', 'photo limit reached')
      }
      if (!/409|already exists|duplicate/i.test(m)) fail({ message: up.error.message })
    }
    const row = await sb.from('journal_photos').insert({ id: pid, storage_path: path, mime_type: type, bytes: rec.blob.size, client_updated_at: new Date().toISOString() })
    if (row.error && row.error.code !== '23505') fail(row.error)
    await syncDb.setRev('photos', pid, 1)
  }
}

async function pushEntry(sb: SupabaseClient, userId: string, item: OutboxItem) {
  const local = await entriesDb.get(item.id)
  if (!local) { await syncDb.dropOutbox('entries', item.id); return } // superseded locally
  await ensurePhotos(sb, userId, local)
  const body = { entry_date: local.date, data: local, client_updated_at: new Date(local.updatedAt || item.at).toISOString(), deleted_at: null }

  if (item.baseRev === null) {
    const { data, error } = await sb.from('journal_entries').insert({ id: item.id, ...body }).select('rev').single()
    if (!error) return syncDb.confirmOutbox(item, (data as { rev: number }).rev)
    if (error.code !== '23505') fail(error)
    return resolveEntryConflict(sb, item, local, await fetchEntry(sb, item.id))
  }
  const { data, error } = await sb.from('journal_entries').update(body).eq('id', item.id).eq('rev', item.baseRev).select('rev')
  if (error) fail(error)
  if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
  return resolveEntryConflict(sb, item, local, await fetchEntry(sb, item.id))
}

async function resolveEntryConflict(sb: SupabaseClient, item: OutboxItem, local: JournalEntry, server: EntryRow | null) {
  const body = { entry_date: local.date, data: local, client_updated_at: new Date(local.updatedAt || item.at).toISOString(), deleted_at: null }
  if (!server) {
    const { data, error } = await sb.from('journal_entries').insert({ id: item.id, ...body }).select('rev').single()
    if (error) fail(error)
    return syncDb.confirmOutbox(item, (data as { rev: number }).rev)
  }
  if (!server.deleted_at && canon(server.data) === canon(local)) return syncDb.confirmOutbox(item, server.rev) // same page
  if (server.deleted_at) {
    // deleted on another device, edited here: the writing wins and the page comes back
    const { data, error } = await sb.from('journal_entries').update(body).eq('id', item.id).eq('rev', server.rev).select('rev')
    if (error) fail(error)
    if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
    return
  }
  // written on two devices: keep BOTH. The cloud version keeps this id; ours becomes its own page.
  const copy: JournalEntry = { ...local, id: uid(), title: local.title ? `${local.title} (2)` : local.title, updatedAt: Date.now() }
  if (isEntry(server.data, item.id)) await applyRemoteEntry(server.data, item.id, server.rev)
  await syncDb.confirmOutbox(item, server.rev)
  await putEntryQueued(copy)
}

async function pushEntryDelete(sb: SupabaseClient, item: OutboxItem) {
  if (item.baseRev === null) { await syncDb.dropOutbox('entries', item.id); return }
  // a deletion keeps only the marker other devices need, not the page's words
  const { data, error } = await sb.from('journal_entries').update({ data: {}, deleted_at: new Date().toISOString(), client_updated_at: new Date(item.at).toISOString() }).eq('id', item.id).eq('rev', item.baseRev).select('rev')
  if (error) fail(error)
  if ((data ?? []).length === 1) return syncDb.confirmOutbox(item, (data as { rev: number }[])[0].rev)
  const server = await fetchEntry(sb, item.id)
  if (!server || server.deleted_at) return syncDb.confirmOutbox(item, server?.rev ?? null)
  // written on another device after it was deleted here: the newer writing wins — bring it back
  if (isEntry(server.data, item.id)) await applyRemoteEntry(server.data, item.id, server.rev)
  await syncDb.confirmOutbox(item, server.rev)
}

/** Download photos used by pages on this device that aren't here yet (e.g. a fresh browser). */
async function fetchMissingPhotos(sb: SupabaseClient, userId: string) {
  let got = 0
  for (const e of await entriesDb.all()) {
    for (const pid of e.photoIds) {
      if (!pid || (await photosDb.get(pid))) continue
      const blob = await downloadPhoto(sb, userId, pid)
      if (!blob) continue
      await photosDb.put({ id: pid, blob, createdAt: Date.now() })
      await syncDb.setRev('photos', pid, 1)
      got++
      if (got >= 40) return got // the rest next round
    }
  }
  return got
}

/** One private photo, read with the signed-in person's own session. Null if it isn't there. */
export async function downloadPhoto(sb: SupabaseClient, userId: string, photoId: string): Promise<Blob | null> {
  const { data, error } = await sb.storage.from('journal-photos').download(`${userId}/${photoId}`)
  if (error) {
    const m = `${(error as { statusCode?: string }).statusCode ?? ''} ${error.message}`
    if (/404|not found|object not found/i.test(m)) return null
    fail({ message: error.message })
  }
  return data
}
