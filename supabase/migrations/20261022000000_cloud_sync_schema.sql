-- Little Moments — cloud sync schema (Phase 1)
--
-- Private journals: every row belongs to exactly one signed-in user, and Row Level Security
-- lets a user see and change only their own rows. Signed-out visitors (the `anon` role) can't
-- read or write anything. Photos live in a private Storage bucket under a folder named after
-- the owner's user id.
--
-- Records keep the app's own JSON shape in `data`, so new optional fields (like `frame`,
-- `place`, `sealed`) never need a schema change and older app versions keep working.
-- Deletions are soft (`deleted_at`) so other devices learn about them when they sync.
--
-- Safe to run more than once.

-- ─────────────────────────── tables ───────────────────────────

create table if not exists public.journal_entries (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  entry_date        date        not null,
  data              jsonb       not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  rev               bigint      not null default 1,
  primary key (user_id, id)
);

create table if not exists public.journal_photos (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  storage_path      text        not null,
  mime_type         text        not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes             integer     not null check (bytes > 0 and bytes <= 5242880),
  created_at        timestamptz not null default now(),
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  rev               bigint      not null default 1,
  primary key (user_id, id),
  -- a photo row can only point into its owner's own folder
  check (storage_path = user_id::text || '/' || id)
);

create table if not exists public.plans (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null check (char_length(id) between 1 and 64),
  data              jsonb       not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  rev               bigint      not null default 1,
  primary key (user_id, id)
);

-- one row per user: language, sound, motion, name, recent ideas …
create table if not exists public.user_settings (
  user_id           uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  prefs             jsonb       not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) <= 16384),
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  rev               bigint      not null default 1
);

-- "what changed since my last sync?"
create index if not exists journal_entries_user_updated on public.journal_entries (user_id, updated_at);
create index if not exists journal_photos_user_updated  on public.journal_photos (user_id, updated_at);
create index if not exists plans_user_updated           on public.plans (user_id, updated_at);

-- ─────────────────────────── server-kept bookkeeping ───────────────────────────
-- The server, not the device clock, sets updated_at and bumps rev, and a row can never be
-- moved to another user.

create or replace function public.lm_touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := now();
    new.rev := 1;
  else
    if new.user_id is distinct from old.user_id then
      raise exception 'rows cannot change owner';
    end if;
    new.updated_at := now();
    new.rev := old.rev + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists lm_touch on public.journal_entries;
create trigger lm_touch before insert or update on public.journal_entries
  for each row execute function public.lm_touch_row();
drop trigger if exists lm_touch on public.journal_photos;
create trigger lm_touch before insert or update on public.journal_photos
  for each row execute function public.lm_touch_row();
drop trigger if exists lm_touch on public.plans;
create trigger lm_touch before insert or update on public.plans
  for each row execute function public.lm_touch_row();
drop trigger if exists lm_touch on public.user_settings;
create trigger lm_touch before insert or update on public.user_settings
  for each row execute function public.lm_touch_row();

-- ─────────────────────────── access: owner only ───────────────────────────

alter table public.journal_entries enable row level security;
alter table public.journal_photos  enable row level security;
alter table public.plans           enable row level security;
alter table public.user_settings   enable row level security;

-- belt and braces: signed-out visitors get no table privileges at all
revoke all on public.journal_entries, public.journal_photos, public.plans, public.user_settings from anon;
revoke all on public.journal_entries, public.journal_photos, public.plans, public.user_settings from public;
grant select, insert, update, delete on public.journal_entries, public.journal_photos, public.plans, public.user_settings to authenticated;

do $$
declare t text;
begin
  foreach t in array array['journal_entries', 'journal_photos', 'plans', 'user_settings'] loop
    execute format('drop policy if exists "owner can read" on public.%I', t);
    execute format('drop policy if exists "owner can add" on public.%I', t);
    execute format('drop policy if exists "owner can change" on public.%I', t);
    execute format('drop policy if exists "owner can remove" on public.%I', t);
    execute format($p$create policy "owner can read" on public.%I for select to authenticated
                      using ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "owner can add" on public.%I for insert to authenticated
                      with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "owner can change" on public.%I for update to authenticated
                      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "owner can remove" on public.%I for delete to authenticated
                      using ((select auth.uid()) = user_id)$p$, t);
  end loop;
end
$$;

-- ─────────────────────────── private photo storage ───────────────────────────
-- Bucket is private: no public URLs. Files are read with the owner's session (or a short-lived
-- signed URL made with it). Path must be "<user id>/<photo id>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-photos', 'journal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "journal photos: owner can read"   on storage.objects;
drop policy if exists "journal photos: owner can add"    on storage.objects;
drop policy if exists "journal photos: owner can change" on storage.objects;
drop policy if exists "journal photos: owner can remove" on storage.objects;

create policy "journal photos: owner can read" on storage.objects for select to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "journal photos: owner can add" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "journal photos: owner can change" on storage.objects for update to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "journal photos: owner can remove" on storage.objects for delete to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
