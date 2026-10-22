# Changelog

All notable changes to Little Moments. Versions follow [Semantic Versioning](https://semver.org/);
each released version has a matching Git tag.

## [Unreleased]

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
