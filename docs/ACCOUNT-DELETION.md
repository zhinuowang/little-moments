# Deleting a user's account and data (owner runbook)

Little Moments has no in-app "delete account" button yet. The Privacy Policy (`public/privacy.html`,
section 11) promises this manual process instead. Follow every step. Deleting the sign-in account
removes the database rows automatically, but **not the photo files**. Those must be deleted first.

## 1. Check the request
- It must come **from the Google email address the account signs in with**. If it doesn't, reply
  and ask the person to write from that address.
- Supabase → **Authentication → Users** → search the email → open it → copy the **User UID**.

## 2. See what will be deleted (read-only)
Supabase → **SQL Editor** (replace `USER-ID` with the UID; run as one query):

```sql
select 'pages' what, count(*) from public.journal_entries where user_id = 'USER-ID'
union all select 'photo records', count(*) from public.journal_photos where user_id = 'USER-ID'
union all select 'plans', count(*) from public.plans where user_id = 'USER-ID'
union all select 'settings', count(*) from public.user_settings where user_id = 'USER-ID'
union all select 'photo files', count(*) from storage.objects
  where bucket_id = 'journal-photos' and name like 'USER-ID/%';
```

If the person asked for a copy of their data first, send it before going on.

## 3. Delete the photo files — first
Supabase → **Storage → journal-photos** → open the folder named with the **User UID** → select all
files → **Delete**. Repeat until the folder is gone, because large folders list in pages. Do **not**
use SQL to delete rows from `storage.objects`: that leaves the files themselves behind.

## 4. Delete the account
Supabase → **Authentication → Users** → the user → **Delete user**. This also deletes all of
their pages (including ones marked deleted), photo records, plans and settings
(`on delete cascade`).

## 5. Verify
Run the query from step 2 again. **Every count must be 0.** If anything remains, delete it, then
check again.

## 6. Reply
Tell the person it is done, within the time the policy states. Explain that copies on their own
devices can only be removed by clearing the site's data in each browser. Keep only a note of the
request and completion dates, with no content.

Notes:
- The Free plan has no database backups, so deleted data is gone for good. If backups are turned
  on later, update the policy to say how long they are kept.
- Service providers keep request logs (IP address, time) for a short time on their own schedule.
