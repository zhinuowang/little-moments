// Offline security test for supabase/migrations: runs the real SQL in an in-process Postgres
// (PGlite) with small stand-ins for Supabase's `auth` and `storage` schemas, then tries every
// way one user could read or change another user's journal.
//
//   npm run test:db
//
// Exit code 1 if any check fails.

import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

const db = new PGlite()
let failed = 0
let passed = 0
const ok = (name) => { passed++; console.log(`  ✓ ${name}`) }
const bad = (name, why) => { failed++; console.log(`  ✗ ${name}${why ? ` — ${why}` : ''}`) }

async function expectRows(name, sql, n, params = []) {
  try {
    const r = await db.query(sql, params)
    const got = r.affectedRows && !/^\s*select/i.test(sql) ? r.affectedRows : r.rows.length
    got === n ? ok(name) : bad(name, `expected ${n} rows, got ${got}`)
  } catch (e) { bad(name, e.message) }
}
async function expectError(name, sql, params = [], match) {
  try {
    await db.query(sql, params)
    bad(name, 'was allowed')
  } catch (e) {
    if (match && !match.test(e.message)) bad(name, `wrong error: ${e.message}`)
    else ok(name)
  }
}
async function expectOk(name, sql, params = []) {
  try { await db.query(sql, params); ok(name) } catch (e) { bad(name, e.message) }
}

async function as(who) {
  await db.exec('reset role')
  if (who === 'admin') return
  if (who === 'anon') { await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false)`); return }
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${who}', false)`)
}

// ── stand-ins for what Supabase provides ──
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id), name text not null, owner uuid
  );
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;

  grant usage on schema public to anon, authenticated;
  -- like Supabase: new tables in public start with every privilege for these roles
  alter default privileges in schema public grant all on tables to anon, authenticated;
  insert into auth.users values ('${A}'), ('${B}');
`)

// ── the real migrations, twice (they must be safe to re-run) ──
const dir = new URL('../supabase/migrations/', import.meta.url).pathname
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
for (let round = 1; round <= 2; round++) {
  for (const f of files) {
    try { await db.exec(readFileSync(join(dir, f), 'utf8')) } catch (e) { bad(`migration ${f} (run ${round})`, e.message) }
  }
}
ok(`migrations applied twice: ${files.join(', ')}`)

const entry = (id, title) => JSON.stringify({ id, title, text: 'private words', stickers: [{ kind: 'heart' }] })
const now = new Date().toISOString()

console.log('\nOwner can use their own data')
await as(A)
await expectOk('A adds a diary page', `insert into journal_entries (id, entry_date, data, client_updated_at) values ('e1', '2026-10-21', $1, $2)`, [entry('e1', 'A secret'), now])
await expectOk('A adds a photo record', `insert into journal_photos (id, storage_path, mime_type, bytes, client_updated_at) values ('p1', '${A}/p1', 'image/jpeg', 2000, $1)`, [now])
await expectOk('A adds a plan', `insert into plans (id, data, client_updated_at) values ('pl1', '{"title":"tea"}', $1)`, [now])
await expectOk('A saves settings', `insert into user_settings (prefs, client_updated_at) values ('{"name":"A"}', $1)`, [now])
await expectRows('A reads their page', `select * from journal_entries`, 1)
await expectOk('A uploads a photo file to their folder', `insert into storage.objects (bucket_id, name, owner) values ('journal-photos', '${A}/p1', '${A}')`)
await expectRows('A sees their photo file', `select * from storage.objects`, 1)

console.log('\nAnother user can\'t see or touch it')
await as(B)
for (const t of ['journal_entries', 'journal_photos', 'plans', 'user_settings']) await expectRows(`B sees none of A's ${t}`, `select * from ${t}`, 0)
await expectRows('B can\'t edit A\'s page', `update journal_entries set data = '{"title":"hacked"}' where id = 'e1'`, 0)
await expectRows('B can\'t delete A\'s page', `delete from journal_entries where id = 'e1'`, 0)
await expectRows('B can\'t soft-delete A\'s plan', `update plans set deleted_at = now() where id = 'pl1'`, 0)
await expectError('B can\'t write a page into A\'s account', `insert into journal_entries (user_id, id, entry_date, data, client_updated_at) values ('${A}', 'x', '2026-10-21', '{}', now())`, [], /row-level security/)
await expectError('B can\'t overwrite A\'s settings', `insert into user_settings (user_id, prefs, client_updated_at) values ('${A}', '{}', now())`, [], /row-level security/)
await expectRows('B sees none of A\'s photo files', `select * from storage.objects`, 0)
await expectError('B can\'t upload into A\'s folder', `insert into storage.objects (bucket_id, name, owner) values ('journal-photos', '${A}/evil', '${B}')`, [], /row-level security/)
await expectRows('B can\'t delete A\'s photo file', `delete from storage.objects where name = '${A}/p1'`, 0)
await expectError('B can\'t point a photo record at A\'s folder', `insert into journal_photos (id, storage_path, mime_type, bytes, client_updated_at) values ('p2', '${A}/p1', 'image/jpeg', 10, now())`, [], /check constraint/)
await expectError('B can\'t use another bucket', `insert into storage.objects (bucket_id, name) values ('other', '${B}/x')`, [], /row-level security|foreign key/)
await expectOk('B adds their own page', `insert into journal_entries (id, entry_date, data, client_updated_at) values ('e1', '2026-10-22', $1, now())`, [entry('e1', 'B page')])
await expectRows('B sees only their own page', `select * from journal_entries where data->>'title' = 'B page'`, 1)

console.log('\nSigned-out visitors get nothing')
await as('anon')
for (const t of ['journal_entries', 'plans', 'user_settings']) await expectError(`anon can't read ${t}`, `select * from ${t}`, [], /permission denied/)
await expectError('anon can\'t add a page', `insert into journal_entries (id, entry_date, data, client_updated_at) values ('z', '2026-10-21', '{}', now())`, [], /permission denied/)
await expectRows('anon sees no photo files', `select * from storage.objects`, 0)

console.log('\nServer keeps the bookkeeping honest')
await as(A)
await expectOk('A edits their page (client tries to fake rev)', `update journal_entries set data = $1, rev = 999 where id = 'e1'`, [entry('e1', 'A edited')])
{
  const r = await db.query(`select rev from journal_entries where id = 'e1'`)
  r.rows[0]?.rev == 2 ? ok('rev is bumped by the server (2), not set by the client') : bad('server rev', JSON.stringify(r.rows))
}
await expectError('A can\'t hand a page to B', `update journal_entries set user_id = '${B}' where id = 'e1'`, [], /row-level security|cannot change owner/)
await expectError('oversized page is refused', `insert into journal_entries (id, entry_date, data, client_updated_at) values ('big', '2026-10-21', jsonb_build_object('text', repeat('x', 70000)), now())`, [], /check constraint/)
await expectError('non-image photo type is refused', `insert into journal_photos (id, storage_path, mime_type, bytes, client_updated_at) values ('p3', '${A}/p3', 'text/html', 10, now())`, [], /check constraint/)

await expectRows('A deletes a page: the marker keeps no words', `update journal_entries set data = '{}', deleted_at = now() where id = 'e1'`, 1)
{
  const r = await db.query(`select data, deleted_at is not null as gone from journal_entries where id = 'e1'`)
  const row = r.rows[0]
  row?.gone && JSON.stringify(row.data) === '{}' ? ok('deleted page is only a marker') : bad('deleted page marker', JSON.stringify(row))
}

console.log('\nSigned-in users hold only the privileges row-level security covers')
{
  const maint = (await db.query(`select current_setting('server_version_num')::int >= 170000 as v`)).rows[0].v
  const extra = ['TRUNCATE', 'TRIGGER', 'REFERENCES', ...(maint ? ['MAINTAIN'] : [])]
  for (const t of ['journal_entries', 'journal_photos', 'plans', 'user_settings']) {
    const r = await db.query(`select ${extra.map((p) => `has_table_privilege('authenticated', 'public.${t}', '${p}') as "${p}"`).join(', ')},
      has_table_privilege('authenticated', 'public.${t}', 'SELECT, INSERT, UPDATE, DELETE') as crud,
      has_table_privilege('anon', 'public.${t}', 'SELECT') as anon_select`)
    const row = r.rows[0]
    const held = extra.filter((p) => row[p])
    held.length === 0 && row.crud && !row.anon_select
      ? ok(`${t}: only select/insert/update/delete for signed-in users, nothing for anon`)
      : bad(`${t} privileges`, JSON.stringify(row))
  }
}
await as(A)
await expectError('A can\'t truncate a table', `truncate journal_entries`, [], /permission denied/)

console.log('\nEach account can store at most 500 photo files')
await as('admin')
await db.exec(`insert into storage.objects (bucket_id, name, owner) select 'journal-photos', '${B}/fill' || g, '${B}' from generate_series(1, 499) g`)
await as(B)
await expectOk('B uploads photo 500', `insert into storage.objects (bucket_id, name, owner) values ('journal-photos', '${B}/p500', '${B}')`)
await expectError('B\'s photo 501 is refused', `insert into storage.objects (bucket_id, name, owner) values ('journal-photos', '${B}/p501', '${B}')`, [], /row-level security/)
await expectRows('B still sees all 500 of their files', `select * from storage.objects`, 500)
await as(A)
await expectOk('A is unaffected by B\'s limit', `insert into storage.objects (bucket_id, name, owner) values ('journal-photos', '${A}/p2', '${A}')`)
await as('admin')
await db.exec(`delete from storage.objects where name like '${B}/%'`)

console.log('\nDeleting an account removes only that account\'s rows')
await as('admin')
await db.exec(`delete from auth.users where id = '${A}'`)
await expectRows('A\'s pages are gone', `select * from journal_entries where user_id = '${A}'`, 0)
await expectRows('B\'s page is untouched', `select * from journal_entries where user_id = '${B}'`, 1)
{
  const r = await db.query(`select public from storage.buckets where id = 'journal-photos'`)
  r.rows[0]?.public === false ? ok('photo bucket is private') : bad('photo bucket is private', JSON.stringify(r.rows))
}

console.log(`\n${passed} passed, ${failed} failed`)
await db.close()
process.exit(failed ? 1 : 0)
