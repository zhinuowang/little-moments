import { entriesDb, kvDb, photosDb, plansDb } from '../db/db'
import type { JournalEntry, Plan, Prefs } from '../types'
import { blobToDataURL, dataURLToBlob } from './image'
import { toISODate } from './util'

interface BackupFile {
  app: 'little-moments'
  version: 1
  exportedAt: string
  entries: JournalEntry[]
  plans: Plan[]
  prefs?: Prefs
  photos: { id: string; createdAt: number; data: string }[]
}

export async function exportBackup() {
  const [entries, plans, photos, prefs] = await Promise.all([
    entriesDb.all(), plansDb.all(), photosDb.all(), kvDb.get<Prefs>('prefs'),
  ])
  const file: BackupFile = {
    app: 'little-moments',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    plans,
    prefs,
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, createdAt: p.createdAt, data: await blobToDataURL(p.blob) }))),
  }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  downloadBlob(blob, `little-moments-backup-${toISODate()}.json`)
  return { entries: entries.length, photos: photos.length, plans: plans.length }
}

export class BackupError extends Error {
  constructor(public code: 'notJson' | 'notBackup') { super(code) }
}

/** Merges a backup into this device. Items with the same id are replaced. */
export async function importBackup(file: File) {
  let data: BackupFile
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new BackupError('notJson')
  }
  if (data?.app !== 'little-moments' || !Array.isArray(data.entries)) {
    throw new BackupError('notBackup')
  }
  for (const p of data.photos ?? []) {
    if (typeof p?.data !== 'string' || !p.data.startsWith('data:image/')) continue
    await photosDb.put({ id: p.id, createdAt: p.createdAt ?? Date.now(), blob: await dataURLToBlob(p.data) })
  }
  for (const e of data.entries) if (e?.id && e.date) await entriesDb.put(e)
  for (const p of data.plans ?? []) if (p?.id) await plansDb.put(p)
  if (data.prefs) await kvDb.set('prefs', data.prefs)
  return { entries: data.entries.length, photos: data.photos?.length ?? 0, plans: data.plans?.length ?? 0 }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
