# Cloud persistence plan (Phase 3)

Status: Phase 3A (Google-only sign-in, per-account local data) and Phase 3B (Plans and settings
sync — `src/lib/cloud/sync.ts`, `src/store/useCloudSync.ts`) are on `develop`; 3C–3E follow,
each tested and approved separately. The outbox, revs and pull cursor live in the account
database's existing `kv` store (`outbox:…`, `rev:…`, `cursor:…`, `prefs:updatedAt`), so no
IndexedDB version bump was needed and the guest database stays at v1.

## What exists today (inspected 2026-10-22)

**On the device — IndexedDB database `little-moments`, version 1** (`src/db/db.ts`):

| Store | Key | Holds |
| --- | --- | --- |
| `entries` | `id` (index `date`) | `JournalEntry` — see below |
| `photos` | `id` | `PhotoRecord { id, blob (JPEG ≤1600 px), createdAt }` |
| `plans` | `id` | `Plan { id, activityId?, custom?{title, note, category}, date?, createdAt }` |
| `kv` | `'prefs'` | `Prefs { name, sound, motion, lamp, cushion, rug, todayMood?, recentActivityIds, backupHintDismissed? }` |

The language choice lives in `localStorage['lm-lang']`, not in IndexedDB. Every read and write of
the four stores goes through `db.ts` (call sites: AppContext, Editor, usePhoto, backup, Settings).

`JournalEntry`: `id, date (YYYY-MM-DD), createdAt, updatedAt, mood?, activityId?, activityTitle?,
title, text (≤900 chars), photoIds (string|null)[], stickers [{id, kind, x, y, rotate, scale}],
layout, theme, frame?, place?, sealed?`. The monthly notebooks are **derived** from `date`; there is
no separate notebook record to store. IDs come from `crypto.randomUUID()` — stable and globally
unique, so they can be used as cloud keys unchanged.

**In Supabase** (`supabase/migrations/…_cloud_sync_schema.sql`, RLS owner-only, 37 tests):
`journal_entries(user_id, id, entry_date, data jsonb ≤64 KB, client_updated_at, updated_at, deleted_at, rev)`,
`journal_photos(user_id, id, storage_path = '<user>/<id>', mime_type, bytes ≤5 MB, …)` plus the
private `journal-photos` bucket, `plans(user_id, id, data jsonb ≤16 KB, …)`,
`user_settings(user_id, prefs jsonb ≤16 KB, …)`. The server sets `updated_at` and bumps `rev`.

## Mapping — nothing dropped

| Device | Cloud |
| --- | --- |
| `JournalEntry` (every field, incl. stickers, positions, layout, theme, frame, place, seal, mood, photoIds) | `journal_entries.data` = the whole object; `entry_date` = `date`; `client_updated_at` = `updatedAt` |
| `PhotoRecord.blob` | Storage `journal-photos/<user id>/<photo id>` (private), plus a `journal_photos` row (`mime_type`, `bytes`) |
| `Plan` (every field) | `plans.data` = the whole object |
| `Prefs` + language (`lm-lang`) | `user_settings.prefs` = `{ ...Prefs, lang }` |

Storing whole objects in `jsonb` means fields added later (as `frame`, `place`, `sealed` were) sync
with no schema change, and an older app version reading newer data simply ignores extra fields.

**Not present today:** Plans have **no completion status** field. Syncing one requires first adding
an optional `done?: boolean` to `Plan` (backward compatible) — a small feature decision, flagged
for you rather than invented here.

## Separation of guest and account data (Phase 3A)

- **Guest data stays in `little-moments`, exactly as v1.0.0 wrote it.** It is never renamed,
  migrated or uploaded automatically, so rolling the code back to v1.0.0 still finds it.
- Each Google account gets its **own** device database, `little-moments-acct-<user id>`. Two
  Google accounts in one browser never see each other's pages; neither sees the guest diary.
- Signing in switches the app to that account's database; signing out (or a session ending)
  switches back to the guest database. **Nothing is deleted on switch**, so changes that haven't
  reached the cloud yet are kept and resume when that account signs in again.
- The account is chosen from the saved session without a network call, so it works offline.
- Photo previews cached in memory are cleared on every switch.

Limit to know: "hidden" means hidden from the app. Someone with the browser's developer tools on
the same device could still read another profile's local copy — the same as any web app's
offline cache. Phase 3E adds an optional "remove this account's copy from this device", allowed
only when nothing is waiting to sync.

## Sync design (Phases 3B–3D)

**Local-first.** Every change is written to the device database first (as now) and, for a signed-in
account, recorded in an **outbox** in the same transaction: `{ table, id, op: upsert|delete,
baseRev }`. The UI never waits for the network.

**Push.** The outbox is processed in order when online (on change, on focus, on reconnect, with
back-off on failure). Each record goes up with its `baseRev` — the server `rev` it was edited
from:
- new record → insert; if the id already exists (a retried upload), it's treated as success only
  if the content matches, otherwise as a conflict. **No duplicates**: ids are stable.
- edit → `update … where id = ? and rev = baseRev`. One row updated = success; the server returns
  the new `rev`, stored locally. **Zero rows = someone else changed it first → conflict.**
- delete → the same guarded update setting `deleted_at` (a tombstone, never a hard delete), so other
  devices learn about it and it can't come back.
- An item is marked **"Saved to cloud" only after Supabase confirms** the write.

**Pull.** `select … where updated_at > lastPulledAt − 2 min` (the overlap covers transactions that
commit out of order), applied only when the server `rev` is newer than the local one and the local
record has no pending outbox change. Tombstones remove the item locally.

**Conflicts — no silent last-write-wins for journal content.**
- **Diary page** edited on two devices: the server version stays; the local version is kept as a
  **separate page** "(edited on another device)" with a new id, so both texts survive and you choose.
- **Deleted on one device, edited on another:** the edit wins and the page is restored (a
  deletion never destroys newer writing).
- **Plans:** same as pages (both kept). **Settings:** newest wins — low-stakes, stated here.

**Photos.** Uploaded before the page that references them; the page's outbox entry waits for its
photos. Files are only removed from Storage after the page's tombstone is confirmed. A page whose
photo is still uploading shows the local copy.

**Sessions.** If the session expires, the outbox simply pauses; nothing is discarded. After signing
in again as the same account, it resumes.

## Guest → account (Phase 3D)

On the first Google sign-in on a device with guest pages or plans: a one-time offer "Bring my
memories into my account", listing what will be copied. Only on a tap: download/keep a backup →
**copy** (never move) guest items into the account (same ids; a re-run skips items already copied;
if an id exists with different content, both are kept) → photos first → verify counts → guest copy
left untouched.

## Risks found and how they're handled

| Risk | Handling |
| --- | --- |
| Signing in currently shows the guest diary as if it were the account's | 3A: separate databases per account |
| Local deletes are hard deletes | 3B/3C: tombstone + outbox for signed-in accounts |
| `saveEntry` deletes replaced photos immediately | 3C: photo deletions go through the outbox; files removed only after the page change is confirmed |
| Stale device overwriting newer content | Guarded updates on `rev`; conflict copies |
| Clock skew between devices | Server sets `updated_at`/`rev`; device clocks only label `client_updated_at` |
| Out-of-order commits missed by the pull cursor | 2-minute overlap window, de-duplicated by `rev` |
| Size limits (64 KB page, 5 MB photo) | Text is capped at 900 chars; photos are ≤1600 px JPEG — far below |
| Free plan has no backups | In-app export stays; recommend Pro or periodic export before launch |
| Free project pauses after 7 idle days | Local-first: the app keeps working; sync resumes after the project is resumed |
| Photo files outlive a deleted account | Planned account-deletion function (later phase) |

Nothing in Phase 3 changes the v1 guest database, the RLS policies, or `main`.
