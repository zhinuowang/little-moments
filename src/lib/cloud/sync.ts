import type { SupabaseClient } from '@supabase/supabase-js'
import * as store from '../../db/db'
import type { OutboxItem } from '../../db/db'
import type { Plan, Prefs } from '../../types'
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

export type SyncFailure = 'offline' | 'auth' | 'server' | 'switched'
export class SyncError extends Error {
  constructor(public kind: SyncFailure, message: string) { super(message) }
}

export interface SyncResult { applied: number; pushed: number; pending: number }

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
  await adoptLocal(sb)

  for (const item of await syncDb.outbox()) {
    if (item.table === 'plans') await (item.op === 'delete' ? pushPlanDelete(sb, item) : pushPlan(sb, item))
    else await pushSettings(sb, userId, item, hooks)
    pushed++
  }
  return { applied, pushed, pending: await syncDb.outboxCount() }
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
  const { data, error } = await sb.from('plans').update({ deleted_at: new Date().toISOString(), client_updated_at: new Date(item.at).toISOString() }).eq('id', item.id).eq('rev', item.baseRev).select('rev')
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
