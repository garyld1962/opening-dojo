---
name: ship
description: "Ship completed work through the repo's actual delivery flow: checkpoint, commit, push, PR, and release steps. Reads project-specific delivery commands from config."
---

# /ship — Deliver Completed Work

**Purpose:** Move completed work through the repo's actual delivery flow. Runs checkpoint, creates a clean commit, pushes, creates a PR, and optionally runs release steps — all using the project's configured commands.

## When to Use

- Repo has a configured delivery flow (`ship.config.md` or `CLAUDE.md` Ship section)
- Work needs project-specific release steps beyond a standard PR
- You want a single command from completion through release

## When NOT to Use

- No ship config exists — use `/pr` for the standard PR flow
- You only need the quality gate — use `/checkpoint`
- Work is mid-implementation — finish first

## Pre-flight Required Config

Before proceeding, verify:

1. Check `<project>/.claude/ship.config.md` exists, OR check that `<project>/CLAUDE.md` has a `## Ship` or `## Delivery` section with build/test/ship commands.

   If neither exists, halt:
   > This skill needs delivery commands for your project.
   >
   > Set up interactively:
   > ```
   > /configure ship
   > ```
   >
   > Or copy the template and edit:
   > ```
   > cp claude/ship/config.template.md <project>/.claude/ship.config.md
   > ```

2. Verify `build_command`, `test_command`, and `ship_command` are present and non-placeholder.

3. If healthy, proceed silently.

## Arguments

- (no argument) — run the full delivery flow
- `--skip-checkpoint` — skip lint/build/test gate (use with care)
- `--draft` — create a draft PR instead of a ready PR

## Rubrics

This skill references:
- `_internal/repo-delivery` — ship contract and guardrails

## Workflow

### Step 1: Confirm State

- Check current branch, staged changes, and working tree
- Verify we're not on the default branch (main/master)
- Show what will be shipped: files changed, commit count

### Step 2: Checkpoint

Unless `--skip-checkpoint`:
- Run the project's build command
- Run the project's test command
- Run lint if configured
- Report PASS/FAIL per check
- Halt on failure — do not ship broken code

### Step 2.5: Security Quick Check (when warranted)

Apply the **security-quick-check** rubric
(`_internal/security-quick-check/SKILL.md`) when the diff matches the
canonical trigger criteria defined there (sensitive functional
surfaces or sensitive paths). Skip criteria are also defined there;
do not restate them here.

Halt on findings; do not ship until resolved.

### Step 3: Commit

- Create a clean commit with a message that reflects the actual changes
- Follow the project's commit conventions if defined in CLAUDE.md

### Step 4: Push

- Push to the remote with upstream tracking
- Report the remote branch name

### Step 5: Create PR

- Create a PR with a summary based on the commit(s)
- Use `--draft` if requested
- Report the PR URL

### Step 6: Release Steps (Optional)

If the project config defines `tag_command`, `release_command`, or `deploy_command`, offer to run them:
> "Project has release steps configured. Run them? (tag / release / deploy)"

Only run with user confirmation.

## CRITICAL: Do Not Guess

- Do NOT assume the package manager, branch name, or script names. Read from config.
- Do NOT auto-ship unrelated changes.
- Do NOT claim success without build/test passing.
- Do NOT run release steps without user confirmation.
- Do NOT push to main/master without explicit user instruction.

## Contract

- **Inputs:** current working tree with uncommitted changes (or commits ahead of default). Optional release flags. Calls `/checkpoint` (mandatory) and `_internal/security-quick-check` (conditional, per its trigger criteria).
- **Preconditions:** CLAUDE.md `## Commands` declares lint/build/test/default_branch/package_manager (per `_internal/repo-delivery`); remote configured; `gh` CLI authenticated when opening a PR.
- **Outputs:** clean commit, pushed branch, optionally a PR (delegated to `/pr`), optionally tag/release/deploy steps when configured and confirmed.
- **Postconditions:** code is on the remote on the user-confirmed branch; release steps run only after explicit confirmation.
- **Failure modes:** `/checkpoint` FAIL → halt. Security findings → halt until resolved. Push to main/master without explicit instruction → refuse. Never `git push --force` to a shared branch.
