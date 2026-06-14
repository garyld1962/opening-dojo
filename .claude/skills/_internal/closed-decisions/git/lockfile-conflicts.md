# Lock file conflicts: always take incoming, then regenerate

**Decision:** When a merge or rebase produces a conflict in a dependency lock file, resolve it by taking the incoming (main / target) side and regenerating. Never hand-edit a lock file. Never `--ours` on a sync-from-main.

**Status:** Closed. Do not relitigate per-PR.

## Files this applies to

- `pnpm-lock.yaml`
- `package-lock.json`
- `yarn.lock`
- `bun.lockb`
- `Cargo.lock`
- `poetry.lock`
- `uv.lock`
- `Pipfile.lock`
- `Gemfile.lock`
- `composer.lock`
- `go.sum`
- `flake.lock`

## Resolution procedure

When syncing your branch with main (`/sync-main`, rebase, or merge):

```bash
# 1. Take main's lock file
git checkout --theirs <lockfile>
git add <lockfile>

# 2. Continue the rebase / commit the merge
git rebase --continue   # or: git commit

# 3. Regenerate locally so your branch's deps are reflected
<install command>       # pnpm install / npm install / cargo build / etc.

# 4. Stage the regenerated lock and amend / commit
git add <lockfile>
git commit --amend --no-edit   # or: git commit -m "chore: regenerate lockfile after sync"
```

When merging your branch into main (rare; usually goes the other way):

- The branch's lock file is the incoming side. Same rule applies from main's perspective: take incoming, regenerate.

## Why

- Lock files are derived state. Hand-merging them produces invalid resolutions that may install correctly but disagree with the intent of the source manifests.
- Conflict markers in a binary or near-binary file (`bun.lockb`, large `pnpm-lock.yaml`) are rarely human-readable in any useful way.
- The only authoritative resolution comes from re-running the package manager against the merged manifest files (`package.json`, `Cargo.toml`, `pyproject.toml`, etc.). Manifest conflicts, by contrast, **must** be human-resolved — they encode intent.

## Code conflicts: opposite rule

Code files never auto-resolve. The `--theirs` / `--ours` shortcut applies only to lock files. For code, always show the conflict markers to the human and ask. This is the pair to the closed decision above; recording it here so the contrast is explicit.

## Skills that reference this decision

- `dev/sync-main`
- `dev/pr` (when sync-main is invoked as a subroutine before push)
- `dev/ship` (when sync-main is invoked as a subroutine before release)
- `dev/execute-plan` (multi-worktree merge phase — sequential rebases of lane branches)
