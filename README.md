# Little Moments ♡

*A little more magic in ordinary days.*

Little Moments is a cozy, bilingual (English / 简体中文) journaling companion that runs in the browser
and installs like an app. Momo — a hand-drawn tabby cat — asks how you feel, draws a small idea for
you from a capsule machine, keeps your plans, and tucks each diary page into a monthly notebook on a
little bookshelf.

No accounts, no AI, no tracking, no server. Everything you write stays on your own device.

**Live site:** https://zhinuowang.github.io/little-moments/

---

## Features

- **Mood check-in** — six moods, each with its own Momo pose and line. Skippable.
- **Activity ideas** — 42 hand-written activities picked by a deterministic, tag-based recommender
  (mood, category, energy, time, place, cost). No AI.
- **Capsule machine** — a layered draw animation: the first draw plays the full ritual, *Try another*
  switches quickly, *Draw again* replays it, and you can skip at any time. The knob is clickable too.
- **Momo** — a monochrome doodle mascot with page-specific poses and small live reactions: hover
  glances, taps, double-tap hugs, idle stretches, and noticing the dried-fish cursor.
- **Mini rituals** — guided reading, tea, walk and creative moments.
- **Plans** — save ideas or your own plans, pencil in a date, start them later.
- **Diary bookshelf** — one notebook per month. Notebooks grow thicker as pages are added, the
  current month wears a ribbon, and a sticker peeks out when a month has them.
- **Journal editor** — title, words, photos (resized on-device), five layouts, paper tones,
  stamp / ticket / postcard keepsake frames, place and mood, and draggable doodle stickers.
- **Save ritual** — the page closes into its month's notebook and slides back onto the shelf
  (full version once per visit, a quick one after).
- **Red seal** — an optional red date stamp for a finished page.
- **Multi-select delete** — choose one or many pages in a month and delete them after a confirmation.
- **Backup & restore** — export everything (pages, photos, plans, settings) to one JSON file and
  import it on any device.
- **Bilingual** — every interface string in English and Simplified Chinese; switch any time.
- **PWA** — installable, works offline after the first visit.
- **Accessible** — keyboard-friendly, screen-reader labels, and a reduced-motion setting.

## Tech stack

| | |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Animation | Motion (`motion/react`) and CSS keyframes |
| Build | Vite |
| Storage | IndexedDB via `idb` (in-memory fallback) |
| Export | `html-to-image` for "Save as image" |
| Fonts | Comic Sans MS (device) → Short Stack; Xiaolai SC + Gamja Flower for Chinese; Courier Prime for tiny labels |
| Hosting | GitHub Pages via GitHub Actions |

## Getting started

Requires **Node.js 20.19 or newer** (22 LTS recommended).

```bash
git clone https://github.com/zhinuowang/little-moments.git
cd little-moments
npm install
npm run dev            # http://localhost:5173
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload on <http://localhost:5173> |
| `npm run typecheck` | TypeScript checks only |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build on <http://localhost:4173> (service worker active) |
| `npm run preview:pages` | Build and serve exactly as GitHub Pages will, under `/little-moments/`, on <http://localhost:4174/little-moments/> |

There is no linter or automated test suite yet; CI runs the type-check and production build.

## Project structure

```
index.html                  app shell
public/                     icons, manifest, service worker, fish cursor
src/
  main.tsx                  entry: fonts, providers, service-worker registration
  App.tsx                   layout, hash routes
  views/                    Home, Discover (capsule machine), Ritual, Plans,
                            Diary (bookshelf + month notebooks), Editor, EntryView, Settings
  components/
    momo/                   Momo.tsx (all poses), LiveMomo.tsx (interactions)
    journal/JournalPage.tsx keepsake page renderer, stickers, red seal
    Gashapon.tsx            capsule machine and draw button
    art/                    line icons, mood art, doodle stickers
    ui/                     nav, sheets, toasts, yarn progress
  data/                     activities (EN + ZH), moods and categories
  lib/                      recommender, backup, image resizing, sounds, utilities
  db/db.ts                  IndexedDB stores
  store/                    app state (React context) and hash router
  i18n/                     en.ts, zh.ts (zh is typed against en — a missing key fails the build)
  styles/index.css          design tokens, fonts, components, animations
.github/workflows/          CI checks and the GitHub Pages deployment
```

## Your data

- Diary pages, photos, plans and settings are stored in **this browser's IndexedDB** on this device.
- Nothing is uploaded anywhere. This repository contains **code only** — never anyone's diary.
- Different browsers and devices don't share data. To move or keep a copy, use
  **Settings → Download a backup**, then **Restore from a backup** on the other device.
- Clearing site data in the browser deletes the diary. Keep a backup.
- Backup files contain your diary and photos, so `.gitignore` keeps `little-moments-backup-*.json`
  out of Git.

## Languages and type

The header has an **EN / 中文** switch (also in Settings). The choice is saved in `localStorage`
(`lm-lang`); on a first visit the browser language is used. Every interface string lives in
`src/i18n/en.ts` and `zh.ts`. Your own journal text is never translated.

Type follows the language. In **English** it is **Comic Sans MS** from the device; where that isn't
installed, **Short Stack** (SIL OFL, self-hosted) is used — no Comic Sans files are bundled. In
**中文** it is **Xiaolai SC 小赖** for Chinese with **Gamja Flower** for Latin letters. All bundled
fonts are SIL Open Font License and self-hosted, so there are no third-party requests.

## Deployment

The site is a static build, so it is hosted on **GitHub Pages**:

- `.github/workflows/deploy.yml` builds and deploys **only from `main`** (and only after the build
  succeeds — a failed build never replaces the live site).
- `.github/workflows/ci.yml` type-checks and builds every pull request and every push to `develop`.
  It never deploys.
- Vite's `base` comes from the `BASE_PATH` environment variable, which the workflows set to
  `/<repository-name>/`. Local development stays at `/`.
- Routing uses the URL hash (`#/diary`), so Pages needs no 404 rewrites.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the branch workflow, releasing, previewing and rolling back,
and [CHANGELOG.md](CHANGELOG.md) for version history.

## Licence

The code and illustrations are © the author, all rights reserved, unless a licence file says
otherwise. Bundled fonts are under the SIL Open Font License 1.1.
