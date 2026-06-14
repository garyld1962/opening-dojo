---
name: repo-status
description: "Reports live repo state: branch, working tree, unpushed commits, stashes, and open PRs. Read-only snapshot for orienting at the start of a session or after a long break."
model: haiku
---

# /repo-status — Live Repo Snapshot

**Purpose:** Print a concise, current view of the repo's git and PR state. No memory, no narrative — just the facts the agent and user both need to decide what to do next.

This skill complements the `remember` plugin (which auto-injects session memory at start-up). `remember` answers "what was I doing?"; `repo-status` answers "what's the repo actually look like right now?"

## When to Use

- Start of a session, after `remember` has loaded prior context, to confirm the working tree matches what memory claims.
- After switching machines.
- Before opening a PR, to confirm the branch is pushed and clean.
- Any time the agent is unsure of branch, push state, or PR status.

## When NOT to Use

- To save or restore session memory — that's the `remember` plugin's job.
- To make changes. This skill is strictly read-only.

## Arguments

- _(none)_ — current repo, summary form
- `--full` — include 10-commit log, full PR details, and remote tracking detail

## Workflow

### 1. Repo identity

- `git rev-parse --show-toplevel` — repo root
- Repo name from the basename of that path
- `hostname` — current machine

### 2. Branch and tracking

- `git branch --show-current` — current branch
- `git rev-parse --abbrev-ref --symbolic-full-name @{u}` — upstream (capture failure: branch has no upstream)
- `git rev-list --left-right --count @{u}...HEAD` — ahead/behind counts (skip if no upstream)

### 3. Working tree

- `git status --short` — modified/untracked summary
- `git stash list` — stashes (count + first line of each)

### 4. Commits

- `git log --oneline -5` (or `-10` with `--full`) — recent commits on current branch
- If ahead of upstream: `git log --oneline @{u}..HEAD` — list the unpushed commits explicitly

### 5. Open PRs

- `gh pr list --author @me --state open --json number,title,headRefName,updatedAt,isDraft,statusCheckRollup`
- Identify whether the current branch has an open PR
- Flag PRs older than 3 days as stale
- With `--full`: include CI status rollup per PR

### 6. Print briefing

Default form:

```
📍 <repo> — <branch> @ <machine>
Tracking: <upstream> (<ahead> ahead, <behind> behind)   [or: no upstream]
Working tree: <clean | N modified, M untracked>
Stashes: <count>   [omit if zero]

Unpushed commits:
  <sha> <subject>
  ...
[omit section if ahead == 0]

Recent commits:
  <sha> <subject>
  ...

Open PRs (you): <count>
  #<num> <title> — <branch> [draft] [CI: pass/fail/pending] (updated <relative>)
  ...
[omit section if zero]
```

### 7. Warnings

Append at the bottom only when triggered:

- ⚠️  Branch has no upstream — push with `-u` before opening a PR.
- ⚠️  Behind upstream by N — pull or rebase before continuing.
- ⚠️  Unpushed commits on current branch — N commits not on remote.
- ⚠️  Stashed work exists — N stashes, oldest from <date>.
- ⚠️  Open PR on current branch is stale — last update <relative>.
- ⚠️  Detached HEAD — not on any branch.

## Rules

- **Read-only.** Never run anything that mutates state (no `fetch`, no `pull`, no `push`, no stash apply). The user decides what to do next.
- **One screen.** Default output should fit on a single screen. Use `--full` for detail.
- **Facts, not memory.** Do not interpret or compare against `remember.md`. That's a separate concern.
- **Fail gracefully.** If `gh` is missing or unauthenticated, print the git portion and note "PR check skipped: gh unavailable." Don't abort the briefing.
- **No network calls beyond `gh pr list`.** Do not `git fetch` — the user may be offline or on a slow connection.
