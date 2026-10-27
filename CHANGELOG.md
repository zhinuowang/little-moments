# Changelog

All notable changes to Little Moments. Versions follow [Semantic Versioning](https://semver.org/);
each released version has a matching Git tag.

## [Unreleased]

### Pre-launch: security and storage limits
- Migration `20261027000000_prelaunch_hardening.sql` (permissions and one policy only, no data
  changes): signed-in users lose the TRUNCATE, TRIGGER, REFERENCES and MAINTAIN privileges that
  row-level security doesn't cover. Photo uploads are limited to 500 files per account, so one
  account can't fill the shared storage. **Written and tested locally (48 checks); not yet applied
  to the live project.**
- Sync: when an account reaches the photo limit, pages with new photos stay on the device, every
  other change still syncs, and a clear message appears instead of endless retries.
- Deleting a page or plan now also clears its contents in the cloud, leaving only the deletion
  marker that other devices need. Records deleted earlier are not changed.

### Pre-launch: privacy and user rights
- `public/privacy.html`: bilingual (English / 简体中文) Privacy Policy, a plain page that needs no
  account and no JavaScript. It covers what is stored and where (Supabase, Oregon), the absence of
  ads, analytics and tracking, device copies, retention, rights, and a manual account-deletion
  process that includes private photo files. It is a **draft** until the owner fills in the marked
  details (operator name, country, contact email, dates, response time).
- A "Privacy Policy" link on the welcome screen and in Settings → About. Signed-in accounts also
  see where to request deletion.
- Settings now describes the signed-in case correctly: data is also saved to the cloud, and
  "Erase everything on this device" removes only this device's copy.
- `docs/ACCOUNT-DELETION.md`: the owner's step-by-step deletion runbook (photo files first, then
  the account, then verification).

### Vercel deployment preparation
- `vercel.json`: Vite build into `dist`, `npm ci`, `main` excluded from Vercel, cache rules (no-cache
  for `sw.js`/`index.html`/manifest, immutable hashed assets), security headers and a report-only
  Content-Security-Policy (tested enforced locally: no violations). The app already builds for `/`
  when `BASE_PATH` is unset and returns from Google to its own origin, so no code change was needed.
- `docs/DEPLOY-VERCEL.md`: dashboard settings, environment variables, Supabase redirect URLs, Google
  client changes, and the release-branch rule (develop = private previews; public only from `release`).

### Phase 3C — cloud saving for Diary pages and photos (signed-in accounts)
- Pages (dates, moods, stickers, layouts, frames, place, seal, photo ids) sync to
  `journal_entries`; photos upload to the private `journal-photos/<user id>/` folder before the page
  that uses them, and a fresh browser downloads them (in the background and when shown).
- Same safety as Plans: saved here + queued in one transaction, revision-guarded writes, tombstones
  for deletes, both versions kept when a page was written on two devices ("(2)" copy), a delete
  never beats newer writing, pull never overwrites a page that exists here but was never uploaded.
- **Existing pages are never uploaded automatically.** Pages already in an account database when
  diary sync first runs there stay local — even when edited — until the person taps **Upload** in a
  quiet notice on the Diary shelf, which also offers **Download a backup**. Uploads are copies.
- Photo files in the cloud are never deleted in this phase (removing a photo removes the local copy).
- Sync status line on the Diary shelf and in month notebooks.

### Phase 3B — cloud saving for Plans and settings (signed-in accounts)
- For a Google account, each Plan or settings change (including language) is saved on the device
  and queued for the cloud in one transaction, then uploaded with revision-guarded writes; deletes
  become cloud tombstones. Pull runs first, with a 2-minute overlap; an empty device never
  overwrites or deletes cloud data. Conflicts: Plans edited on two devices keep both; a delete never
  beats a newer edit; settings — newest wins.
- Sync runs on start, after changes, on reconnect, on tab focus and on a back-off timer; it stops
  safely if the profile changes mid-sync. Failed uploads, lost connections, expired sessions and
  sign-outs keep every queued change on the device; sign-out says how many are waiting.
- A quiet status line on Plans and in Settings → Account: Saved to cloud / Syncing / Saved on this
  device · waiting to sync / Couldn't sync · Retry. Guests: unchanged, no cloud requests.
- Bookkeeping lives in the account database's existing `kv` store — no database version bump; the
  guest database is untouched. Diary pages and photos are not synced yet (Phase 3C).

### Phase 3A — Google or guest, with separate data per account
- The welcome screen and Settings offer only **Continue with Google** and **Continue as Guest**;
  email sign-in (link and code), its email template and the `VITE_EMAIL_SIGNIN` setting are removed.
- Each Google account now has its **own** database on the device (`little-moments-acct-<id>`); the
  guest diary stays in `little-moments`, untouched. Signing in, out, switching accounts or a session
  ending only changes which one is shown — nothing is deleted — and cached photo previews are cleared.
- A saved session is restored from the device, even offline. `docs/SYNC.md` maps every Diary, photo,
  Plan and settings field to Supabase and lists the risks handled in the sync phases.

### Simpler welcome screen
- Momo, "little moments ♡", a short tagline, then **Continue with Google** (shown only when Google
  is enabled in Supabase *and* reachable), **Continue with Email**, and a quiet **Continue as guest**
  link. Where Google is off or blocked (e.g. mainland China), email becomes the main button.
- While email delivery is limited (Resend test sender), the email step says so plainly;
  `VITE_EMAIL_SIGNIN=open` removes the note once real inboxes have been tested.

### Welcome screen and email-link sign-in
- First-time visitors see a welcome screen with Momo — *Continue with Email* or *Continue as Guest*
  — remembered on the device, so returning guests, signed-in people and existing users go straight
  in. Settings → Account can show it again. Builds without Supabase settings never show it.
- Email sign-in is now a **link** (no six-digit code): "Check your inbox ✉", then the link returns
  to the home page. The link carries a one-time token hash that the app verifies with `verifyOtp`,
  which survives mail-scanner pre-opening and works with the GitHub Pages `/little-moments/` path.
- A session that ends on its own is handled as a gentle note; nothing local is touched.
- `supabase/templates/email-link.html` replaces the code template.

### Sign-in — clearer email-sending errors
- When the email service refuses or fails to send a code (Supabase HTTP 5xx), the sheet now says so
  in EN / 中文 instead of a generic error, with a small "details for support" line (status and error
  code only — never the address or code).

### Sign-in — six-digit code first
- The email step now says **Send verification code**; the code box accepts a pasted "123 456",
  refuses letters with a hint, signs in on the 6th digit, and explains wrong/expired codes and
  Supabase's rate limit in EN / 中文. The sign-in link is no longer mentioned.

### Sign-in — Phase 2 (optional; guest stays the default)
- Settings → **Account** (only in builds with Supabase settings): sign in with an email, or stay a
  guest. Signing in or out never changes the diary, photos or plans on the device; cloud sync is
  not on yet.
- Sign-in sheet in EN / 中文: email → 6-digit code box, which also explains the emailed link
  (Supabase's default email sends a link until custom SMTP enables the code template).
  Email links use the implicit flow so they work in another browser or a mail app; Google uses PKCE
  and appears only when it is enabled in Supabase *and* reachable on the current network.
- Credentials returning in the URL are removed before routing; expired or failed links show a
  gentle message and return to the starting page. Network failures time out with a calm message.
- The Supabase library loads only when someone opens sign-in or already has a session; builds
  without settings contain no project address or key.

### Cloud sync — Phase 1 (schema and security; no app behaviour change yet)
- `supabase/migrations/…_cloud_sync_schema.sql`: owner-only tables for diary pages, photo records,
  plans and settings, with Row Level Security, server-kept `updated_at` / `rev`, soft deletes for
  sync, and a private `journal-photos` storage bucket limited to each user's own folder.
- `npm run test:db`: 37 offline checks (PGlite) that one user can never read or change another's
  data and signed-out visitors get nothing; runs in CI.
- `docs/AUTH.md`: sign-in design for North America and mainland China (email code first, optional
  Google, guest by default), with measured reachability from mainland China and email-delivery options.
- `npm run check:china`: re-runnable reachability measurement from mainland-China probes.
- Build-time Supabase settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`); sync stays off
  without them, and secret / service-role keys are refused.

### Documentation
- CLAUDE.md: the step-by-step develop workflow for every change (check, pull safely, build,
  commit, push to `develop`, confirm the hash) and the "Publish this version" release rule.

## [1.0.0] — 2026-10-21

The first approved version, published to GitHub and GitHub Pages.

### Features
- Mood-first home with Momo, a monochrome doodle tabby cat with page-specific poses and subtle live
  interactions (hover glances, taps, double-tap hug, idle stretches, noticing the fish cursor).
- Capsule-machine idea draw with a layered first-draw ritual, quick *Try another*, *Draw again*,
  skip, and a clickable knob; 42 activities chosen by a deterministic tag-based recommender.
- Mini rituals for reading, tea, walks and creative time.
- Plans: save ideas or custom plans, add dates, start later.
- Diary bookshelf with one notebook per month; month notebooks list their pages; selecting and
  deleting one or many pages with confirmation.
- Journal editor with photos, five layouts, paper tones, stamp / ticket / postcard keepsake frames,
  place and mood, draggable doodle stickers, and an optional red date seal.
- Save ritual: the page closes into its month's notebook and returns to the shelf (full once per
  visit, quick afterwards; reduced-motion aware).
- Backup to a JSON file and restore from it; save a page as an image.
- English and Simplified Chinese throughout, switchable and remembered.
- Typography: Comic Sans MS → Short Stack for English; Xiaolai SC with Gamja Flower for Chinese.
- Dried-fish cursor on devices with a mouse.
- Installable PWA with offline app shell.

### Publishing
- Vite base path from `BASE_PATH` so the app runs under `/little-moments/` on GitHub Pages;
  manifest, service worker and its registration use relative paths.
- GitHub Actions: CI checks for pull requests and `develop`; deployment from `main` only.
