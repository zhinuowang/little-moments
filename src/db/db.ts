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
