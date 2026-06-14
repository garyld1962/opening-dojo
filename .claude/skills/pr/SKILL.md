---
name: pr
description: "Full PR lifecycle: branch, commit, checkpoint, push, create PR, and optionally squash-merge. Automates the entire pull request workflow with quality gates."
---

# /pr — Pull Request Lifecycle

**Purpose:** Automate the full PR lifecycle from branch creation through optional merge.

## When to Use

- Implementation is complete and ready for review/merge
- You want branch + commit + checkpoint + push + PR creation in one flow
- Squash-merge is the repo's standard and you want optional auto-merge

## When NOT to Use

- Repo has project-specific release steps beyond a PR — use `/ship`
- You only need the quality gate — use `/checkpoint`
- Work isn't ready — finish implementation and tests first

## Arguments

- `--skip-checkpoint` — skip the /checkpoint quality gate
- `--merge` — auto-merge after PR creation (skip merge prompt)
- `--no-merge` — skip merge prompt entirely (PR stays open)
- `--draft` — create PR as draft

## Workflow

Execute these steps in order. Stop and report if any step fails.

### Step 1: Branch Check

```bash
git branch --show-current
```

If on `main` (or the repo's default branch):
- Ask the user for a branch name
- Create and switch to the new branch: `git checkout -b <branch-name>`

If already on a feature branch, continue.

### Step 2: Stage & Commit

Check for unstaged or staged changes:

```bash
git status
git diff HEAD
```

If there are changes:
- Stage relevant files: `git add <files>` (review `git status` first — avoid staging untracked junk like .exe, .zip, Zone.Identifier files)
- Generate a commit message from the diff (follow Conventional Commits if the project uses them, check recent `git log --oneline -10` for style)
- Show the commit message to the user for approval
- Commit: `git commit -m "<message>"`

If no changes and no new commits ahead of origin, stop — nothing to PR.

### Step 3: Run /checkpoint (unless --skip-checkpoint)

Invoke the `/checkpoint` skill to run the quality gate (lint, typecheck, tests, reviews).

- If checkpoint **fails**: stop and report failures. Do not continue to push.
- If checkpoint **passes**: continue.

### Step 3.5: Security Quick Check (when warranted)

Apply the **security-quick-check** rubric
(`_internal/security-quick-check/SKILL.md`) when the diff matches the
canonical trigger criteria defined there (sensitive functional
surfaces or sensitive paths). Skip criteria are also defined there;
do not restate them here.

- If the rubric reports findings: stop and address them before push.
- If clean: continue.

### Step 4: Push

```bash
git push -u origin HEAD
```

If the remote branch doesn't exist, this creates it. If push fails (e.g., rejected), report the error.

### Step 5: Generate PR Content

Gather context for the PR:

```bash
git log origin/main..HEAD --oneline
git diff origin/main..HEAD --stat
```

Auto-generate:
- **Title**: Short (under 70 chars), derived from branch name or commit messages
- **Body**: Using this format:

```markdown
## Summary
- <bullet 1: what changed>
- <bullet 2: why>
- <bullet 3: notable details, if any>

## Test plan
- [ ] <test item 1>
- [ ] <test item 2>

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Show the title and body to the user for approval before creating the PR.** Wait for confirmation or edits.

### Step 6: Create PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Add `--draft` flag if `--draft` argument was passed.

Report the PR URL to the user.

### Step 7: Merge Decision

- If `--no-merge` was passed: done. Report PR URL.
- If `--merge` was passed: proceed to merge immediately.
- Otherwise: ask the user "Merge this PR now?"

If merging:

```bash
gh pr merge <pr-number> --squash --delete-branch
git checkout main
git pull origin main
```

Report: "PR merged and branch cleaned up."

If not merging: "PR created and ready for review." Report the PR URL.

## Error Handling

- **Push rejected**: Report the error. Suggest `git pull --rebase origin <branch>` if behind remote.
- **PR already exists**: Report the existing PR URL. Ask if user wants to update it.
- **Merge conflicts**: Report conflicts. Do not force-merge. Ask user to resolve.
- **Checkpoint fails**: Stop before push. List failures clearly.

## Notes

- This skill always uses **squash merge** to keep main history clean.
- After merge, both remote and local feature branches are deleted.
- The PR body is always shown for approval — never auto-submitted without user seeing it.

## Contract

- **Inputs:** current branch with committed changes. Optional flags: `--draft`, `--merge`, `--no-merge`. Calls `/checkpoint` (mandatory) and `_internal/security-quick-check` (conditional, per its trigger criteria).
- **Preconditions:** branch has commits ahead of default; remote configured; `gh` CLI authenticated; CLAUDE.md `## Commands` declares lint/build/test.
- **Outputs:** opened PR URL; on `--merge`, merged commit on default branch and deleted feature branch.
- **Postconditions:** PR exists and is visible to reviewers; PR title/body shown to user before creation; squash merge if merged.
- **Failure modes:** `/checkpoint` FAIL → halt before push. Security findings → halt until resolved. Push reject / merge conflict → halt and report; never force-push.
