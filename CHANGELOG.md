# Changelog

All notable changes to Little Moments. Versions follow [Semantic Versioning](https://semver.org/);
each released version has a matching Git tag.

## [Unreleased]

### Cloud sync — Phase 1 (schema and security; no app behaviour change yet)
- `supabase/migrations/…_cloud_sync_schema.sql`: owner-only tables for diary pages, photo records,
  plans and settings, with Row Level Security, server-kept `updated_at` / `rev`, soft deletes for
  sync, and a private `journal-photos` storage bucket limited to each user's own folder.
- `npm run test:db`: 37 offline checks (PGlite) that one user can never read or change another's
  data and signed-out visitors get nothing; runs in CI.
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
