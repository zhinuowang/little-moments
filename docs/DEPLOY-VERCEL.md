# Deploying Little Moments on Vercel

GitHub Pages (`main`, `v1.0.0`, https://zhinuowang.github.io/little-moments/) is **not** affected by
anything here. Vercel serves the cloud-sync version built from `develop` at the root path `/`.

## Publish-only-on-approval with Vercel

Vercel deploys every push. To keep the rule *"save every version, publish only when approved"*:

| Branch | On Vercel | Who sees it |
| --- | --- | --- |
| `develop` | **Preview** deployments (one per push, plus a stable branch URL) | Only you — protected by Vercel Authentication |
| `release` | **Production** (the public site) | Everyone |
| `main` | Not deployed on Vercel (Ignored Build Step; `vercel.json → git.deploymentEnabled.main = false`) | — (GitHub Pages only) |

Releasing = after the owner's explicit approval of that commit,
`git push origin <approved develop commit>:refs/heads/release` (fast-forward only, never force). Rolling back = Vercel → Deployments → previous production
deployment → **Instant Rollback**, then point `release` at the matching commit with a normal push of
a revert commit.

## Current setup (2026-10-27)

- Project `little-moments` in team `nora-740d`, connected to `zhinuowang/little-moments`.
- **Production Branch:** `release` (created at `a1aa56d` with the owner's approval; nothing public yet).
- **Ignored Build Step:** builds only `develop` and `release`:
  `if [ "$VERCEL_GIT_COMMIT_REF" = "develop" ] || [ "$VERCEL_GIT_COMMIT_REF" = "release" ]; then exit 1; else exit 0; fi`
- **Deployment Protection:** Vercel Authentication on **All Deployments** (`ssoProtection.deploymentType
  = "all"`), so every URL — production domain included — needs a Vercel login. Keep it there until a
  public release is approved; only then, after checking the production deployment is the approved
  `release` commit, switch to *Standard Protection*.
  - Note: the default *Standard Protection* (`all_except_custom_domains`) does **not** protect the
    production domain, even a `*.vercel.app` one like `little-moments-eta.vercel.app`.
- Domains: production `little-moments-eta.vercel.app`; stable `develop` preview
  `little-moments-git-develop-nora-740d.vercel.app`.
- **The first deployment becomes Production.** On 2026-10-27 the project's first build, `develop` at
  `c1a19c1`, was deployed with target `production` (`isFirstBranchDeployment: true`), although the
  Production Branch was already `release`. The project had no deployment yet, and Vercel gave the
  first one the production slot. With Standard Protection that made the app public at
  `little-moments-eta.vercel.app` for about a minute, until protection was set to All Deployments.
  No user data was exposed. Since a production deployment now exists, later `develop` pushes go to
  Preview. Still check each one: right after a push, read the deployment's `target` with
  `vercel api "/v6/deployments?projectId=<id>"`. If it says `production`, stop.
- The folder's `.vercel/` link is gitignored. If `vercel link` adds a `VERCEL_OIDC_TOKEN` to
  `.env.local`, it can be removed — the app doesn't use it.

## Vercel Dashboard settings

**New Project → Import Git Repository → `zhinuowang/little-moments`**

| Setting | Value |
| --- | --- |
| Framework Preset | **Vite** |
| Root Directory | `./` |
| Build Command | `npm run build` (also set in `vercel.json`) |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version (Settings → Build and Deployment) | **22.x** |

**Settings → Git → Production Branch:** `release`.

**Settings → Environment Variables** (both are public by design — they are inside every visitor's
browser; Row Level Security protects the data):

| Name | Value | Environments |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://jcvtizdyqwjiqpvjepna.supabase.co` | Production, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key (Supabase → Project Settings → API Keys) | Production, Preview |

Never add the Supabase **secret / service_role** key, the database password or the Google client
secret to Vercel — the frontend never needs them, and the app refuses a secret key.
**Do not set `BASE_PATH`** on Vercel (it's only for GitHub Pages).

**Settings → Deployment Protection → Vercel Authentication:** **All Deployments** until the first
approved public release; then **Standard Protection** (previews protected, production public).

## Supabase → Authentication → URL Configuration

Keep the existing entries and add:

- **Redirect URLs**
  - `https://<production-domain>/**` — e.g. `https://little-moments.vercel.app/**` (whatever Vercel assigns
    or your custom domain)
  - `https://little-moments-git-develop-<vercel-scope>.vercel.app/**` — the stable `develop` preview URL
- **Site URL:** change to the production Vercel URL **when you approve the public release** (it is the
  fallback address; GitHub Pages v1 doesn't use sign-in, so this doesn't affect it).

The app sends Google back to `window.location.origin + '/'`, so on Vercel it returns to that exact
Vercel address automatically — it must simply be in the Redirect URLs list.

## Google Cloud → Google Auth Platform

- **Clients → your Web client → Authorized JavaScript origins:** add the production Vercel URL (and
  the develop preview URL if you sign in there). **Authorized redirect URIs** stay
  `https://jcvtizdyqwjiqpvjepna.supabase.co/auth/v1/callback` — unchanged.
- **Audience → Publishing status:** while **Testing**, only listed test users can sign in. Before a
  public release, choose **Publish app**. With only `openid`, `email`, `profile` no verification
  review is needed, but Google expects a privacy policy link (`https://<production>/privacy.html`) and app home page in **Branding**
  (an app domain you own is needed for verification; `*.vercel.app` can't be verified).

## What `vercel.json` adds

- Build settings above; `main` is excluded from Vercel deployments.
- Caching: `/sw.js` never cached, `index.html` and the manifest revalidated, hashed `/assets/*`
  cached for a year (immutable) — new releases reach people promptly.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`,
  a restrictive `Permissions-Policy`, and a **Content-Security-Policy in report-only mode**
  (self + this Supabase project + `accounts.google.com`). Tested locally with the policy enforced:
  no violations on any page. Switch the header name to `Content-Security-Policy` after checking a
  Vercel preview's browser console shows no violations during sign-in, sync and photo upload.

## Checklist on the first `develop` preview (before any public release)

1. Home, Ideas, Plans, Diary, Settings load; refresh on `#/diary?month=…` works.
2. Continue with Google returns to the **same preview URL** signed in.
3. A disposable plan and a disposable diary page with a photo show "Saved to cloud" and appear in
   another browser signed in to the same account; the photo loads.
4. DevTools → Application → Service Workers: `sw.js` activated; Manifest has no errors; reload offline.
5. DevTools → Console: no Content-Security-Policy report messages.
