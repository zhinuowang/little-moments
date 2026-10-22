# Little Moments — standing instructions

These apply to every session working on this project. Details are in DEVELOPMENT.md.

## Branches and publishing
- Work on `develop` (or a `feature/*` branch made from it). Never commit directly to `main`.
- After finishing a requested change: verify it, run `npm run typecheck` and `npm run build`, make a
  meaningful commit, push to `origin develop`, and report the commit hash and branch.
- If a push fails, say so plainly and leave the local commit in place.
- **Never deploy to production without the owner's explicit approval.** Approving a feature or design
  is not approval to publish it. Releasing = a pull request `develop` → `main`, a summary of what it
  contains, passing checks, then an explicit "yes, publish" before merging.
- Merge releases with a merge commit; don't squash history without permission.
- Tag each approved release on `main` (`v1.1.0`, …) and add it to CHANGELOG.md. Never reuse a tag.

## Never
- Force-push (`git push --force` / `--force-with-lease`) or rewrite published history.
- `git reset --hard` on a shared branch to erase commits.
- Delete or move version tags, branches or the repository.
- Commit secrets, `.env` files, backup files, diary entries or user photos.

## Rolling back
Restore an earlier version with a new commit (`git restore --source=<tag>` or `git revert`) on a
branch, confirm it builds, open a PR into `main`, and ask before deploying. Explain what will be
undone first.

## Design and data
- Preserve the approved visual design, Momo's art and animations, and all existing features unless
  the owner asks for a change. Keep changes page-specific when asked to.
- Preserve existing user data: storage changes must be backward compatible (optional new fields, or
  an IndexedDB version bump with a migration that keeps every record). A code rollback does not
  restore browser data.
- Keep both languages complete: every new string goes in `src/i18n/en.ts` and `src/i18n/zh.ts`.
- Report what changed, the commit hash(es) and the branch name at the end of each task.
