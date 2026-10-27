-- Undo supabase/migrations/20261027000000_prelaunch_hardening.sql.
-- Permissions and one storage policy only. No rows or photo files are changed or deleted.
-- Kept outside migrations/ so it is never applied by accident. Run it in one transaction.

begin;

-- Part A — the photo limit: back to the original upload rule (owner's own folder, no limit).
drop policy if exists "journal photos: owner can add" on storage.objects;
create policy "journal photos: owner can add" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop function if exists lm_private.my_photo_file_count();
drop schema if exists lm_private; -- not cascade: refuses if anything else was added there

-- Part B — only if a problem is traced to the privilege change. Re-granting reopens the gap the
-- migration closed (row-level security does not cover these), so leave it commented otherwise.
-- grant truncate, trigger, references
--   on public.journal_entries, public.journal_photos, public.plans, public.user_settings
--   to authenticated;
-- grant maintain
--   on public.journal_entries, public.journal_photos, public.plans, public.user_settings
--   to authenticated;

commit;
