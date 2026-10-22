# Little Moments — standing instructions

These apply to every session working on this project. Details are in DEVELOPMENT.md.

Repository: https://github.com/zhinuowang/little-moments.git (remote `origin`, SSH:
`git@github.com:zhinuowang/little-moments.git`). GitHub Pages site: https://zhinuowang.github.io/little-moments/
— deployed only from `main` (`v1.0.0` is the owner's original approved baseline).
Vercel (cloud-sync version, docs/DEPLOY-VERCEL.md): `develop` → private previews only; the public
Vercel site deploys only from the `release` branch. Never create or push `release` without the
owner's explicit approval of that specific commit; push it fast-forward only, never force.

## Every requested change — follow these steps automatically
1. **Work on `develop`**, never `main`. (A short-lived `feature/*` branch made from `develop` is fine
   for bigger work; it merges back into `develop`.)
2. **Before editing**, check the current branch (`git branch --show-current`), the working tree
   (`git status`), and remote changes (`git fetch origin`). Bring `develop` up to date safely with
   `git pull --ff-only origin develop`. Never discard or overwrite local work to do so — if the pull
   can't fast-forward or there are uncommitted changes you didn't make, stop and ask.
3. Make the requested change and **preserve unrelated features**.
4. Run the checks: `npm run typecheck` and `npm run build` (plus anything relevant to the change).
5. **Commit** the finished change with a meaningful message (one logical change per commit).
6. **Push to GitHub `develop`**: `git push origin develop`.
7. **Confirm** the push succeeded (e.g. `git status -sb` shows `develop...origin/develop` level, or
   `git ls-remote origin develop` matches) and report the commit hash and branch.
   If the push fails, say so clearly, leave the local commit in place, and never claim the
   change is synchronized.

## Publishing — only when the owner says "Publish this version"
- Prepare a pull request from `develop` into `main`. Without GitHub CLI, give the owner the compare
  link https://github.com/zhinuowang/little-moments/compare/main...develop and summarize every commit
  and file it contains, with the CI result.
- **Ask for explicit approval and wait.** Do not merge or deploy until the owner approves that
  specific release. Approving a feature or design is not approval to publish it.
- Merge with a merge commit (no squash). Deployment to the live site happens only from `main`.
- After the release, tag `main` with the next version (`v1.1.0`, …) and add it to CHANGELOG.md.

## Never
- Merge `develop` into `main` or deploy the live site without explicit approval.
- Force-push (`--force` / `--force-with-lease`), rewrite published history, or `git reset --hard`
  to erase commits.
- Delete or move version tags (`v1.0.0` must always point at the original approved version),
  delete branches, or recreate/overwrite the repository.
- Commit secrets, `.env` files, backup files, diary entries or user photos.

## Rolling back
Restore an earlier version with a new commit (`git restore --source=<tag>` or `git revert`) on a
branch, confirm it builds, explain what will be undone, open a PR into `main`, and ask before
deploying. History is never deleted.

## Design and data
- Preserve the approved visual design, Momo's art and animations, and all existing features unless
  the owner asks for a change. Keep changes page-specific when asked to.
- Preserve existing user data: storage changes must be backward compatible (optional new fields, or
  an IndexedDB version bump with a migration that keeps every record). A code rollback does not
  restore browser data.
- Keep both languages complete: every new string goes in `src/i18n/en.ts` and `src/i18n/zh.ts`.
- Report what changed, the commit hash(es) and the branch name at the end of each task.
