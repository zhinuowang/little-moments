-- Little Moments — pre-launch hardening (permissions and one storage policy only).
-- No rows are changed or deleted. Safe to run more than once.

-- ─────────────────────────── table privileges ───────────────────────────
-- Signed-in users need only select / insert / update / delete (all limited by row-level security).
-- Supabase's default privileges also gave them TRUNCATE, TRIGGER, REFERENCES and, on Postgres 17,
-- MAINTAIN. Row-level security does not apply to those, and the app never uses them.
revoke truncate, trigger, references
  on public.journal_entries, public.journal_photos, public.plans, public.user_settings
  from authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on public.journal_entries, public.journal_photos, public.plans, public.user_settings from authenticated';
  end if;
end $$;

-- ─────────────────────────── photo storage limit ───────────────────────────
-- At most 500 photo files per account, so one account can't fill the project's shared storage.
-- Existing files are never touched; only new uploads past the limit are refused.
-- A policy on storage.objects can't query storage.objects directly (Postgres reports infinite
-- recursion), so the count lives in a small function. It runs with the caller's own rights
-- (security invoker), so the owner-only read rule limits it to the caller's folder, and it sits in
-- a schema the Supabase API does not expose.
create schema if not exists lm_private;
revoke all on schema lm_private from public;
grant usage on schema lm_private to authenticated;

create or replace function lm_private.my_photo_file_count()
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  return (
    select count(*) from storage.objects o
    where o.bucket_id = 'journal-photos' and (storage.foldername(o.name))[1] = (select auth.uid())::text
  );
end
$$;
revoke all on function lm_private.my_photo_file_count() from public;
grant execute on function lm_private.my_photo_file_count() to authenticated;

drop policy if exists "journal photos: owner can add" on storage.objects;
create policy "journal photos: owner can add" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lm_private.my_photo_file_count() < 500
  );
