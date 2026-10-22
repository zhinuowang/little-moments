# Development workflow

**The rule: save every version. Publish only when approved. Never destroy the previous version.**

## Branches

| Branch | Purpose | Deploys? |
| --- | --- | --- |
| `main` | The approved, live version. Changes arrive **only** through an approved pull request. | Yes — every push to `main` deploys to GitHub Pages |
| `develop` | Ongoing work. Every finished change is committed and pushed here. | **Never** |
| `feature/<short-name>` | Optional short-lived branch off `develop` for a bigger change; merged back into `develop`. | Never |

Releases are marked with tags: `v1.0.0`, `v1.1.0`, `v1.2.0`, … A tag is never moved, reused or deleted.

## Day-to-day changes (on `develop`)

```bash
git switch develop
git pull --ff-only origin develop
# …make the change…
npm run typecheck
npm run build
git add -A
git commit -m "Diary: soften the shelf plank line"
git push origin develop
```

One logical change per commit, with a message that says what changed and where. Pushing to
`develop` runs the CI checks (type-check + build) but does **not** touch the live site.

### A bigger change on a feature branch

```bash
git switch develop && git pull --ff-only
git switch -c feature/new-sticker-pack
# …commits…
git push -u origin feature/new-sticker-pack
# open a pull request into develop, or merge it locally:
git switch develop && git merge --no-ff feature/new-sticker-pack && git push origin develop
```

## Previewing changes before release

- **Locally:** `npm run dev` (hot reload), or `npm run preview:pages` to see the exact production build
  under `/little-moments/` on <http://localhost:4174/little-moments/>.
- **Someone else's machine:** clone, `git switch develop`, `npm install`, `npm run dev`.
- `develop` is deliberately not published anywhere, so the live site only ever shows approved work.

## Releasing an approved version

1. Update `CHANGELOG.md` on `develop`: move the *Unreleased* notes under the new version number
   and date, and bump `version` in `package.json`. Commit and push.
2. Open a pull request from `develop` into `main`:
   ```bash
   gh pr create --base main --head develop --title "Release v1.1.0" --body-file CHANGELOG-excerpt.md
   ```
3. Wait for the **CI** check to pass and review the list of commits and files in the PR.
4. **The owner approves the release explicitly.** Asking for a feature is not approval to publish it.
5. Merge the PR with a merge commit (not squash), so every development commit stays in history:
   ```bash
   gh pr merge --merge
   ```
6. The **Deploy to GitHub Pages** workflow runs on `main`. If the build fails, nothing is deployed and
   the previous site stays live.
7. Tag the release on `main` and push the tag:
   ```bash
   git switch main && git pull --ff-only
   git tag -a v1.1.0 -m "Little Moments v1.1.0"
   git push origin v1.1.0
   ```

## Restoring an earlier version

History is never rewritten. Rolling back means **adding** a commit that brings back old code.

**Restore the previous approved release on the live site** (example: go back from v1.1.0 to v1.0.0):

```bash
git switch develop && git pull --ff-only
git switch -c restore/v1.0.0
git diff --stat v1.0.0 HEAD                 # see exactly what will be undone
git restore --source=v1.0.0 --staged --worktree -- .
git commit -m "Restore v1.0.0 (reverts changes from v1.1.0)"
npm ci && npm run typecheck && npm run build   # make sure it builds
git push -u origin restore/v1.0.0
gh pr create --base main --head restore/v1.0.0 --title "Restore v1.0.0"
```

Then the release steps above apply: CI must pass and the owner must approve before the PR is merged
and deployed. Afterwards, merge `main` back into `develop` so both branches agree.

**Undo one unwanted commit on `develop`:** `git revert <commit-hash>` and push.

**Look at an old version without changing anything:** `git switch --detach v1.0.0`, then
`git switch develop` to come back.

Never: `git reset --hard` on a shared branch, `git push --force`, deleting tags, or squashing history
without the owner's permission.

### Rollback and diary data

Code and diary data are separate. Rolling back code **does not** restore, change or delete anything
stored in people's browsers. If a change ever alters how pages are stored (`src/db/db.ts` or the
`JournalEntry` shape in `src/types.ts`), it must:

- stay **backward compatible** — new fields optional, old pages still open (see `frame`, `place`,
  `sealed` for the pattern);
- or bump the IndexedDB version with a migration that keeps every existing record;
- and never drop a store or field that an older release still reads, so rolling the code back
  stays safe.

Encourage a **Settings → Download a backup** before any release that touches storage.

## GitHub Pages deployment

- Workflow: `.github/workflows/deploy.yml`. Runs on pushes to `main` (and can be started by hand, but
  only for `main`).
- Job 1 installs, type-checks and builds with `BASE_PATH=/<repo-name>/`, then uploads `dist/`.
- Job 2 deploys that artifact to the `github-pages` environment. It only runs if job 1 succeeded.
- Repository setting: **Settings → Pages → Source: GitHub Actions**.
- `.github/workflows/ci.yml` runs on every pull request and on pushes to `develop` / `feature/**`.
  It has no deploy step and no permission to deploy.

## Protection on `main`

`main` is protected (when the repository plan allows it): changes need a pull request, the **CI**
check must pass, and force-pushes and deletion are blocked. Version tags `v*` are protected from
deletion and from being moved.
