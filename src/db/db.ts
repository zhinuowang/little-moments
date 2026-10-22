import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { JournalEntry, PhotoRecord, Plan } from '../types'

interface LMSchema extends DBSchema {
  entries: { key: string; value: JournalEntry; indexes: { date: string } }
  photos: { key: string; value: PhotoRecord }
  plans: { key: string; value: Plan }
  kv: { key: string; value: unknown }
}

type StoreName = 'entries' | 'photos' | 'plans' | 'kv'

/**
 * A tiny storage layer. Everything lives in IndexedDB on this device.
 * If IndexedDB is unavailable (some private windows), we fall back to memory
 * and tell the user that changes won't survive a refresh.
 *
 * Each profile has its own database: the guest diary is `little-moments` (exactly as v1.0.0
 * wrote it), and each signed-in account gets `little-moments-acct-<user id>`. Switching profile
 * never deletes anything — it only changes which database the app reads and writes.
 */
export const GUEST_DB = 'little-moments'
export const accountDbName = (userId: string) => `little-moments-acct-${userId}`

let dbName = GUEST_DB
let dbPromise: Promise<IDBPDatabase<LMSchema> | null> | null = null
const emptyMemory = (): Record<StoreName, Map<string, unknown>> => ({
  entries: new Map(), photos: new Map(), plans: new Map(), kv: new Map(),
})
const memories = new Map<string, Record<StoreName, Map<string, unknown>>>()
let memory = emptyMemory()
memories.set(dbName, memory)
export let storageAvailable = true

/** Point every store at another profile's database. Closes the old connection; deletes nothing. */
export async function switchDatabase(name: string) {
  if (name === dbName) return
  const old = dbPromise
  dbName = name
  dbPromise = null
  memory = memories.get(name) ?? emptyMemory()
  memories.set(name, memory)
  try { (await old)?.close() } catch { /* already closed */ }
}

export const currentDatabase = () => dbName

function db() {
  if (!dbPromise) {
    dbPromise = openDB<LMSchema>(dbName, 1, {
      upgrade(d) {
        const entries = d.createObjectStore('entries', { keyPath: 'id' })
        entries.createIndex('date', 'date')
        d.createObjectStore('photos', { keyPath: 'id' })
        d.createObjectStore('plans', { keyPath: 'id' })
        d.createObjectStore('kv')
      },
    }).catch((err) => {
      console.warn('IndexedDB unavailable, using memory only', err)
      storageAvailable = false
      return null
    })
  }
  return dbPromise
}

async function getAll<T>(store: Exclude<StoreName, 'kv'>): Promise<T[]> {
  const d = await db()
  if (!d) return [...memory[store].values()] as T[]
  return (await d.getAll(store)) as T[]
}

async function put<T extends { id: string }>(store: Exclude<StoreName, 'kv'>, value: T) {
  const d = await db()
  if (!d) { memory[store].set(value.id, value); return }
  await d.put(store, value as never)
}

async function del(store: StoreName, id: string) {
  const d = await db()
  if (!d) { memory[store].delete(id); return }
  await d.delete(store, id)
}

export const entriesDb = {
  all: () => getAll<JournalEntry>('entries'),
  async get(id: string): Promise<JournalEntry | undefined> {
    const d = await db()
    if (!d) return memory.entries.get(id) as JournalEntry | undefined
    return d.get('entries', id)
  },
  put: (e: JournalEntry) => put('entries', e),
  remove: (id: string) => del('entries', id),
}

export const plansDb = {
  all: () => getAll<Plan>('plans'),
  put: (p: Plan) => put('plans', p),
  remove: (id: string) => del('plans', id),
}

export const photosDb = {
  async get(id: string): Promise<PhotoRecord | undefined> {
    const d = await db()
    if (!d) return memory.photos.get(id) as PhotoRecord | undefined
    return d.get('photos', id)
  },
  all: () => getAll<PhotoRecord>('photos'),
  put: (p: PhotoRecord) => put('photos', p),
  remove: (id: string) => del('photos', id),
}

export const kvDb = {
  async get<T>(key: string): Promise<T | undefined> {
    const d = await db()
    if (!d) return memory.kv.get(key) as T | undefined
    return (await d.get('kv', key)) as T | undefined
  },
  async set(key: string, value: unknown) {
    const d = await db()
    if (!d) { memory.kv.set(key, value); return }
    await d.put('kv', value, key)
  },
}

/** Erases the CURRENT profile's data on this device only (Settings → Erase). */
export async function clearEverything() {
  const d = await db()
  if (!d) { Object.values(memory).forEach((m) => m.clear()); return }
  const tx = d.transaction(['entries', 'photos', 'plans', 'kv'], 'readwrite')
  await Promise.all([
    tx.objectStore('entries').clear(),
    tx.objectStore('photos').clear(),
    tx.objectStore('plans').clear(),
    tx.objectStore('kv').clear(),
    tx.done,
  ])
}

/** Ready-check used at boot so we can show a gentle warning when storage is off. */
export async function initStorage() {
  await db()
  return storageAvailable
}

/* ───────────────────────── sync bookkeeping (account databases only) ─────────────────────────
 * Kept in the existing `kv` store, so no database version bump is needed: the guest database
 * stays exactly at v1 and older app versions can still open every database.
 *   outbox:<table>:<id>  → OutboxItem (one per record; later edits replace the op, keep baseRev)
 *   rev:<table>:<id>     → last server rev this device has for that record
 *   cursor:<table>       → ISO time of the newest server change pulled
 *   prefs:updatedAt      → when settings last changed on this device (ms)
 */

export type SyncTable = 'plans' | 'settings' | 'entries' | 'photos'

export interface OutboxItem {
  table: SyncTable
  id: string
  op: 'upsert' | 'delete'
  /** the server rev this change was made from; null = never uploaded */
  baseRev: number | null
  at: number
}

const outboxKey = (table: SyncTable, id: string) => `outbox:${table}:${id}`
const revKey = (table: SyncTable, id: string) => `rev:${table}:${id}`

async function kvAll(prefix: string): Promise<[string, unknown][]> {
  const d = await db()
  if (!d) return [...memory.kv.entries()].filter(([k]) => k.startsWith(prefix))
  const range = IDBKeyRange.bound(prefix, prefix + '￿')
  const tx = d.transaction('kv')
  const [keys, values] = await Promise.all([tx.store.getAllKeys(range), tx.store.getAll(range)])
  return keys.map((k, i) => [String(k), values[i]])
}

/** Queue entry for a change, merged with any change still waiting for the same record. */
function nextOutbox(prev: OutboxItem | undefined, table: SyncTable, id: string, op: OutboxItem['op'], currentRev: number | null): OutboxItem | null {
  const baseRev = prev ? prev.baseRev : currentRev
  // created and deleted before ever reaching the cloud: nothing to tell the server
  if (op === 'delete' && baseRev === null) return null
  return { table, id, op, baseRev, at: Date.now() }
}

export const syncDb = {
  outbox: async () => (await kvAll('outbox:')).map(([, v]) => v as OutboxItem).sort((a, b) => a.at - b.at),
  outboxCount: async () => (await kvAll('outbox:')).length,
  revs: async (table: SyncTable) => new Map((await kvAll(`rev:${table}:`)).map(([k, v]) => [k.slice(`rev:${table}:`.length), v as number])),
  getRev: (table: SyncTable, id: string) => kvDb.get<number>(revKey(table, id)),
  setRev: (table: SyncTable, id: string, rev: number) => kvDb.set(revKey(table, id), rev),
  getCursor: (table: SyncTable) => kvDb.get<string>(`cursor:${table}`),
  setCursor: (table: SyncTable, iso: string) => kvDb.set(`cursor:${table}`, iso),
  hasOutbox: async (table: SyncTable, id: string) => (await kvDb.get(outboxKey(table, id))) !== undefined,
  /**
   * After the server confirmed `item`: record the new rev and remove the queue entry — unless a
   * newer local edit was queued meanwhile, in which case that edit is re-based on the new rev
   * (so it isn't mistaken for a conflict). One transaction.
   */
  async confirmOutbox(item: OutboxItem, newRev: number | null) {
    const k = outboxKey(item.table, item.id)
    const d = await db()
    if (!d) {
      const cur = memory.kv.get(k) as OutboxItem | undefined
      if (newRev !== null) memory.kv.set(revKey(item.table, item.id), newRev)
      if (cur?.at === item.at) memory.kv.delete(k); else if (cur) memory.kv.set(k, { ...cur, baseRev: newRev })
      return
    }
    const tx = d.transaction('kv', 'readwrite')
    const cur = (await tx.store.get(k)) as OutboxItem | undefined
    if (newRev !== null) await tx.store.put(newRev, revKey(item.table, item.id))
    if (cur && cur.at === item.at) await tx.store.delete(k)
    else if (cur) await tx.store.put({ ...cur, baseRev: newRev }, k)
    await tx.done
  },
  async dropOutbox(table: SyncTable, id: string) {
    const d = await db()
    if (!d) { memory.kv.delete(outboxKey(table, id)); return }
    await d.delete('kv', outboxKey(table, id))
  },
}

/** Save a plan and queue it for upload in ONE transaction, so a change can never be saved unqueued. */
export async function putPlanQueued(p: Plan) {
  const d = await db()
  if (!d) {
    memory.plans.set(p.id, p)
    const it = nextOutbox(memory.kv.get(outboxKey('plans', p.id)) as OutboxItem | undefined, 'plans', p.id, 'upsert', (memory.kv.get(revKey('plans', p.id)) as number | undefined) ?? null)
    if (it) memory.kv.set(outboxKey('plans', p.id), it)
    return
  }
  const tx = d.transaction(['plans', 'kv'], 'readwrite')
  const kv = tx.objectStore('kv')
  const [prev, rev] = await Promise.all([kv.get(outboxKey('plans', p.id)) as Promise<OutboxItem | undefined>, kv.get(revKey('plans', p.id)) as Promise<number | undefined>])
  await tx.objectStore('plans').put(p)
  const it = nextOutbox(prev, 'plans', p.id, 'upsert', rev ?? null)
  if (it) await kv.put(it, outboxKey('plans', p.id))
  await tx.done
}

/** Remove a plan locally and queue a cloud tombstone in one transaction. */
export async function removePlanQueued(id: string) {
  const d = await db()
  if (!d) {
    memory.plans.delete(id)
    const it = nextOutbox(memory.kv.get(outboxKey('plans', id)) as OutboxItem | undefined, 'plans', id, 'delete', (memory.kv.get(revKey('plans', id)) as number | undefined) ?? null)
    if (it) memory.kv.set(outboxKey('plans', id), it); else memory.kv.delete(outboxKey('plans', id))
    return
  }
  const tx = d.transaction(['plans', 'kv'], 'readwrite')
  const kv = tx.objectStore('kv')
  const [prev, rev] = await Promise.all([kv.get(outboxKey('plans', id)) as Promise<OutboxItem | undefined>, kv.get(revKey('plans', id)) as Promise<number | undefined>])
  await tx.objectStore('plans').delete(id)
  const it = nextOutbox(prev, 'plans', id, 'delete', rev ?? null)
  if (it) await kv.put(it, outboxKey('plans', id)); else await kv.delete(outboxKey('plans', id))
  await tx.done
}

/** Save settings and queue them in one transaction. */
export async function putPrefsQueued(prefs: unknown, updatedAt: number) {
  const d = await db()
  if (!d) {
    memory.kv.set('prefs', prefs); memory.kv.set('prefs:updatedAt', updatedAt)
    const it = nextOutbox(memory.kv.get(outboxKey('settings', 'me')) as OutboxItem | undefined, 'settings', 'me', 'upsert', (memory.kv.get(revKey('settings', 'me')) as number | undefined) ?? null)
    if (it) memory.kv.set(outboxKey('settings', 'me'), it)
    return
  }
  const tx = d.transaction('kv', 'readwrite')
  const [prev, rev] = await Promise.all([tx.store.get(outboxKey('settings', 'me')) as Promise<OutboxItem | undefined>, tx.store.get(revKey('settings', 'me')) as Promise<number | undefined>])
  await tx.store.put(prefs, 'prefs')
  await tx.store.put(updatedAt, 'prefs:updatedAt')
  const it = nextOutbox(prev, 'settings', 'me', 'upsert', rev ?? null)
  if (it) await tx.store.put(it, outboxKey('settings', 'me'))
  await tx.done
}

/** Apply a record that came from the cloud (and remember its rev) in one transaction. */
export async function applyRemotePlan(p: Plan | null, id: string, rev: number) {
  const d = await db()
  if (!d) { if (p) memory.plans.set(id, p); else memory.plans.delete(id); memory.kv.set(revKey('plans', id), rev); return }
  const tx = d.transaction(['plans', 'kv'], 'readwrite')
  if (p) await tx.objectStore('plans').put(p); else await tx.objectStore('plans').delete(id)
  await tx.objectStore('kv').put(rev, revKey('plans', id))
  await tx.done
}

/* ───────────────────────── diary pages (Phase 3C) ─────────────────────────
 * Pages that were already on this device before diary sync started here are NEVER uploaded
 * automatically — not even when edited — until the person explicitly agrees (Diary → Upload).
 *   sync:entriesSince   → when diary sync first ran in this account database (ms)
 *   sync:entriesConsent → true once the person chose to upload their earlier pages
 * A page syncs automatically if it came from the cloud (has a rev), was queued before, was
 * created after `entriesSince`, or consent was given.
 */

async function entrySyncs(kv: { get: (k: string) => Promise<unknown> }, e: Pick<JournalEntry, 'id' | 'createdAt'>) {
  const [since, consent, rev, queued] = await Promise.all([
    kv.get('sync:entriesSince') as Promise<number | undefined>,
    kv.get('sync:entriesConsent') as Promise<boolean | undefined>,
    kv.get(revKey('entries', e.id)) as Promise<number | undefined>,
    kv.get(outboxKey('entries', e.id)) as Promise<OutboxItem | undefined>,
  ])
  return { syncs: consent === true || rev !== undefined || queued !== undefined || (since !== undefined && e.createdAt >= since), rev: rev ?? null, queued }
}

/** First run of diary sync in this account database: remember when, so earlier pages stay local. */
export async function markDiarySyncStart() {
  if ((await kvDb.get('sync:entriesSince')) === undefined) await kvDb.set('sync:entriesSince', Date.now())
}

/** Save a page; if it is one that syncs, queue it in the same transaction. */
export async function putEntrySynced(e: JournalEntry) {
  const d = await db()
  if (!d) { memory.entries.set(e.id, e); return }
  const tx = d.transaction(['entries', 'kv'], 'readwrite')
  const kv = tx.objectStore('kv')
  const { syncs, rev, queued } = await entrySyncs(kv, e)
  await tx.objectStore('entries').put(e)
  if (syncs) {
    const it = nextOutbox(queued, 'entries', e.id, 'upsert', rev)
    if (it) await kv.put(it, outboxKey('entries', e.id))
  }
  await tx.done
}

/** Delete a page locally; if it was in the cloud (or queued), queue a cloud tombstone too. */
export async function removeEntrySynced(id: string) {
  const d = await db()
  if (!d) { memory.entries.delete(id); return }
  const tx = d.transaction(['entries', 'kv'], 'readwrite')
  const kv = tx.objectStore('kv')
  const [rev, queued] = await Promise.all([kv.get(revKey('entries', id)) as Promise<number | undefined>, kv.get(outboxKey('entries', id)) as Promise<OutboxItem | undefined>])
  await tx.objectStore('entries').delete(id)
  if (rev !== undefined || queued) {
    const it = nextOutbox(queued, 'entries', id, 'delete', rev ?? null)
    if (it) await kv.put(it, outboxKey('entries', id)); else await kv.delete(outboxKey('entries', id))
  }
  await tx.done
}

/** Pages on this device that are not in the cloud and won't upload without explicit consent. */
export async function localOnlyEntries(): Promise<JournalEntry[]> {
  const [all, revs, outbox, since, consent] = await Promise.all([
    entriesDb.all(), syncDb.revs('entries'), kvAll('outbox:entries:'),
    kvDb.get<number>('sync:entriesSince'), kvDb.get<boolean>('sync:entriesConsent'),
  ])
  if (consent === true) return []
  const queued = new Set(outbox.map(([k]) => k.slice('outbox:entries:'.length)))
  return all.filter((e) => !revs.has(e.id) && !queued.has(e.id) && (since === undefined || e.createdAt < since))
}

/** The person agreed: queue every local-only page for upload (copies — the pages stay here). */
export async function consentUploadEntries() {
  const pending = await localOnlyEntries()
  await kvDb.set('sync:entriesConsent', true)
  for (const e of pending) await putEntrySynced(e)
  return pending.length
}

/** Apply a page that came from the cloud (and remember its rev) in one transaction. */
export async function applyRemoteEntry(e: JournalEntry | null, id: string, rev: number) {
  const d = await db()
  if (!d) { if (e) memory.entries.set(id, e); else memory.entries.delete(id); memory.kv.set(revKey('entries', id), rev); return }
  const tx = d.transaction(['entries', 'kv'], 'readwrite')
  if (e) await tx.objectStore('entries').put(e); else await tx.objectStore('entries').delete(id)
  await tx.objectStore('kv').put(rev, revKey('entries', id))
  await tx.done
}

/** Queue a page that must be (re)uploaded — used for a conflict copy. */
export async function putEntryQueued(e: JournalEntry) {
  const d = await db()
  if (!d) { memory.entries.set(e.id, e); return }
  const tx = d.transaction(['entries', 'kv'], 'readwrite')
  const kv = tx.objectStore('kv')
  const [prev, rev] = await Promise.all([kv.get(outboxKey('entries', e.id)) as Promise<OutboxItem | undefined>, kv.get(revKey('entries', e.id)) as Promise<number | undefined>])
  await tx.objectStore('entries').put(e)
  const it = nextOutbox(prev, 'entries', e.id, 'upsert', rev ?? null)
  if (it) await kv.put(it, outboxKey('entries', e.id))
  await tx.done
}
