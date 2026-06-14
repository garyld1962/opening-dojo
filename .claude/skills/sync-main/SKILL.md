---
name: sync-main
description: "Sync current branch with main: fetch, rebase, resolve conflicts. Use when your branch is behind main or before creating a PR."
---

# /sync-main — Sync Branch with Main

**Purpose:** Bring your current feature branch up to date with the main branch. Fetches latest changes, rebases your work on top, and handles conflicts. Project-agnostic.

## When to Use

- Before creating a PR (ensure no merge conflicts)
- When main has moved ahead and you need the latest changes
- After another PR was merged and you need its changes
- Before running /checkpoint or /code-review (ensure you're testing against current main)

## When NOT to Use

- You're already on main — just `git pull`
- You have uncommitted changes — commit or stash first

## Usage

```
/sync-main                    # Rebase current branch on main
/sync-main --stash            # Auto-stash uncommitted changes, sync, pop stash
/sync-main --merge            # Use merge instead of rebase (for shared branches)
```

## Arguments

- `--stash` — automatically stash and pop uncommitted changes around the sync
- `--merge` — use merge instead of rebase (safer for branches with multiple contributors)

## Step 1: Pre-flight Checks

```bash
CURRENT=$(git branch --show-current)
```

If on `main` (or default branch): stop — "Already on main. Use `git pull` instead."

Check for uncommitted changes:

```bash
git status --porcelain
```

If dirty and `--stash` was passed:
```bash
git stash push -m "sync-main auto-stash"
```

If dirty and `--stash` was NOT passed: stop — "Uncommitted changes detected. Commit, stash, or re-run with `--stash`."

## Step 2: Fetch Latest

```bash
# Detect default branch name
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$MAIN" ]; then
  git show-ref --verify --quiet refs/remotes/origin/master && MAIN=master || MAIN=main
fi

git fetch origin "$MAIN"
```

## Step 3: Check Divergence

```bash
BEHIND=$(git rev-list --count HEAD..origin/$MAIN)
AHEAD=$(git rev-list --count origin/$MAIN..HEAD)
```

Report:
```
Branch: <current>
Behind main: <N> commits
Ahead of main: <N> commits
```

If behind is 0: "Already up to date with main." Pop stash if applicable and stop.

## Step 4: Sync

### Rebase (default)

```bash
git rebase origin/$MAIN
```

If conflicts occur:
1. List conflicted files: `git diff --name-only --diff-filter=U`
2. For each file, attempt auto-resolution:
   - **Lock files** — follow `dev/closed-decisions/git/lockfile-conflicts.md`: take main's side, then regenerate via the project's install command and amend.
   - **Code conflicts** — show the conflict markers and ask the user how to resolve. Never auto-resolve code.
3. After resolution: `git rebase --continue`
4. If resolution fails after 2 attempts: `git rebase --abort` and report

### Merge (with `--merge`)

```bash
git merge origin/$MAIN --no-edit
```

Handle conflicts the same way as rebase.

## Step 5: Post-sync

If `--stash` was used:
```bash
git stash pop
```

If stash pop has conflicts, report them but don't abort — the sync succeeded.

## Step 6: Report

```
Sync Complete
  Branch:    <current>
  Strategy:  rebase / merge
  Commits:   <N> from main applied
  Your work: <N> commits replayed on top
  Status:    clean / stash conflicts (manual resolution needed)

Next: run /checkpoint to verify everything still builds and passes.
```

## Key Rules

1. **Never force-push without asking.** After a rebase, the branch history changes. If the branch has been pushed, warn the user that they'll need `--force-with-lease`.
2. **Lock files get auto-resolved per closed decision.** See `dev/closed-decisions/git/lockfile-conflicts.md`. Never hand-edit a lock file.
3. **Code conflicts require human input.** Never silently pick a side on code conflicts.
4. **Abort is safe.** If anything goes wrong, `git rebase --abort` or `git merge --abort` restores the previous state.
5. **Always report divergence.** The user should know how far behind they are before deciding to sync.
