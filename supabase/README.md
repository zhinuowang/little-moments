# Supabase (cloud sync)

Cloud sync is optional. Without the two build settings below, Little Moments is the original
local-only app.

## What is public and what is secret

| Value | Where it may go |
| --- | --- |
| Project URL (`https://<ref>.supabase.co`) | `.env.local`, GitHub Actions **variables** — public |
| Publishable / anon key (`sb_publishable_…`) | `.env.local`, GitHub Actions **variables** — public by design; Row Level Security protects the data |
| Database password | Your password manager only |
| Secret / service_role key (`sb_secret_…`) | **Nowhere in this repo, the app, chats or GitHub.** It bypasses all security rules. The app refuses to start sync if given one. |

## Applying the schema

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the whole of `migrations/20261022000000_cloud_sync_schema.sql` and **Run**.
   It is safe to run again; it never deletes data.
3. Check: **Table Editor** shows `journal_entries`, `journal_photos`, `plans`, `user_settings`, each
   marked **RLS enabled**; **Storage** shows a private bucket `journal-photos`.

## Testing the security rules

```bash
npm run test:db
```

Runs the migration in an in-process Postgres and checks that one user can never read, change,
delete or upload into another user's data, and that signed-out visitors get nothing. CI runs it
on every pull request and push to `develop`.

## Data model

| Table | Holds | Key |
| --- | --- | --- |
| `journal_entries` | one diary page (`data` = the app's page JSON, incl. stickers, layout, frame) | `(user_id, id)` |
| `journal_photos` | one photo's record; the file is `journal-photos/<user_id>/<id>` in Storage | `(user_id, id)` |
| `plans` | saved ideas and own plans | `(user_id, id)` |
| `user_settings` | language, sound, motion, name, recent ideas | `user_id` |

Every row has `user_id` (defaults to the signed-in user; can never change), `updated_at` and `rev`
(set by the server), and `deleted_at` (soft delete, so other devices learn about deletions).
Deleting a user in **Authentication → Users** removes all of their rows.

## Live project checks (2026-10-22, read-only)

Project `jcvtizdyqwjiqpvjepna` (US West): all four tables have RLS enabled with the four owner-only
policies and no `anon` privileges; `journal-photos` is private (5 MB, JPEG/PNG/WebP) with only the
four owner-folder policies; Supabase's security advisor reports no issues; signed-out requests to
every table return `permission denied`, and public photo URLs don't work.
