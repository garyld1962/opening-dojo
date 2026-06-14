---
name: hotfix
description: "Apply an expedited fix for a critical production issue: branch from main, apply a scoped fix, run targeted tests, and fast-track merge."
---

# /hotfix -- Expedited Production Fix

**Purpose:** Apply a targeted fix for a critical issue with minimal ceremony. Branches from the main branch (or a release tag), fixes the specific problem, runs affected tests, and fast-tracks to merge. Project-agnostic -- adapts to any codebase by reading `CLAUDE.md`.

## When to Use

- Production is broken and needs an immediate fix
- A critical bug was found right after a release
- The normal /plan, /code-review, /checkpoint pipeline is too slow

## When NOT to Use

- The bug is not critical -- use /triage then the normal pipeline
- You don't understand the root cause yet -- use /triage first
- The fix requires significant refactoring -- use the normal pipeline

## Usage

```
/hotfix "describe what is broken and how to fix it"
/hotfix "login 500s on expired refresh token" --from v2.4.1
/hotfix "payment rounding error" --ado 12345
/hotfix "auth bypass on API endpoint" --linear BF-99
```

## Arguments

- `<description>` -- what is broken and how to fix it (required)
- `--from <tag|sha>` -- branch from a specific tag or commit instead of the main branch
- `--ado <item-id>` -- link to an Azure DevOps work item for tracking
- `--linear <issue-id>` -- link to a Linear issue for tracking

## Step 1: Project Discovery

Read `CLAUDE.md` from the repo root to discover:
- Package manager and monorepo tool
- Lint/format command (check mode)
- TypeScript check command
- Test runner command
- Branch naming conventions
- Commit message conventions

## Step 2: Create Hotfix Branch

```bash
git fetch origin
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
# Fallback: try master, then main
if [ -z "$MAIN" ]; then
  git show-ref --verify --quiet refs/remotes/origin/master && MAIN=master || MAIN=main
fi
git checkout "$MAIN" && git pull origin "$MAIN"
git checkout -b hotfix/<short-description> "$MAIN"
```

If `--from <tag|sha>` is provided, branch from that ref instead of the main branch.

## Step 3: Confirm Scope

Before writing any code, state:

- **What is broken:** one sentence
- **Root cause:** one sentence
- **Fix:** one sentence
- **Files to touch:** exact list

Ask the user to confirm. The fix must be **minimal** -- the smallest correct change.

## Step 4: Apply the Fix

Rules:
- Touch only what is necessary. No refactors, no cleanup, no style fixes.
- Write a regression test for the specific bug. This is the one thing you do not skip.
- No new features. No "while I'm here" improvements.
- Follow the project's error handling and logging conventions from `CLAUDE.md`.

## Step 5: Run Targeted Tests

Run the project's test command (discovered from `CLAUDE.md`) scoped to affected packages or files. If the project uses a monorepo tool with filtering, filter to only changed packages.

Also run lint and typecheck:

```bash
# Adapt to project tooling discovered in Step 1:
# {lint-command}
# {typecheck-command}
# {test-command --filter=<affected-package>}
```

If tests or build fail: attempt to fix (max 2 attempts). If still failing after 2 attempts, stop and report the failure -- do not force through.

## Step 6: Security Quick Check

Apply the **security-quick-check** rubric (`_internal/security-quick-check/SKILL.md`) to the diff. All 7 points are mandatory on a hotfix — this is the one review step you do not skip.

If the rubric reports findings, halt and address them before continuing to commit. Override is permitted only with `--security-override <reason>` and an explicit justification recorded in the PR body.

## Step 7: Commit

Use conventional commits format:

```
hotfix(<scope>): <description>
```

Include tracking reference if provided:

```
hotfix(auth): handle expired refresh token gracefully

Fixes token refresh flow that returned 500 when the refresh token
was expired instead of redirecting to login.

ADO: #12345
```

or

```
hotfix(payments): correct rounding on partial refunds

Ref: BF-99
```

## Step 8: Push and Create PR

```bash
git push -u origin HEAD
```

Create the PR with `gh`:

```bash
gh pr create \
  --title "hotfix(<scope>): <description>" \
  --body "$(cat <<'EOF'
## Hotfix

**What broke:** <one sentence>
**Root cause:** <one sentence>
**Fix:** <one sentence>

## Changes
- <file>: <what changed>

## Testing
- [x] Regression test added
- [x] Targeted tests pass
- [x] Lint + typecheck pass
- [x] Security quick check done

## Tracking
<ADO/Linear reference if provided>

---
*Created via /hotfix -- expedited production fix*
EOF
)"
```

## Step 9: Merge (Only If User Confirms)

Do NOT merge without explicit user confirmation. When the user says to merge:

```bash
gh pr merge <pr-number> --squash --delete-branch
```

## Step 10: Report

Present a summary:

```
Hotfix Complete
  Branch:  hotfix/<name>
  PR:      #<number> (<url>)
  Commit:  <sha> <message>
  Tests:   <N> passed, <N> failed
  Fix:     <one-sentence summary>

Follow-up:
  - <any deeper fix needed, noted for backlog>
  - <any monitoring to watch>
```

## Key Rules

1. **Speed over ceremony.** Skip full /code-review and multi-specialist analysis. Keep the security check.
2. **Minimal scope.** The smallest correct change. Nothing more.
3. **Always add a test.** The one thing you do not skip is the regression test.
4. **Document for follow-up.** If the root cause needs a deeper fix, note it in the PR and report.
5. **Do not use hotfix for non-critical issues.** The normal pipeline exists for a reason.
6. **Never merge without user confirmation.** Step 9 requires explicit approval.

## Contract

- **Inputs:** bug description; optional `--ado <id>` / `--linear <id>` (delegates to `/work-item`). Calls `_internal/security-quick-check` (mandatory, all 7 points).
- **Preconditions:** repository on a clean working tree; ability to branch from default; tests are runnable; tracker auth if `--ado`/`--linear`.
- **Outputs:** minimal-scope fix on a `hotfix/<slug>` branch; regression test that fails before the fix and passes after; PR with follow-up note if root cause warrants deeper work.
- **Postconditions:** fix landed on default branch only after explicit user approval (Step 9); follow-up captured in PR body or report.
- **Failure modes:** security-quick-check FAIL → halt unless user passes `--security-override <reason>`. Missing regression test → halt. Push to default without approval → refuse.
