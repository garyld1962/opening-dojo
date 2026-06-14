---
name: review-adversarial
description: "Cross-model adversarial code review via Codex/Gemini. Use for high-stakes diffs (auth, payments, migrations) or diffs over 200 lines after code-review passes."
---

## When to Use

- /code-review has passed and diff is 200+ lines
- Changes touch auth, payments, data migrations, or architectural boundaries
- User explicitly requests "adversarial review" or invokes `/review-adversarial`

## When NOT to Use

- Small, low-risk diffs — `/code-review` is sufficient
- BA deliverables or specs — use `/spec-review-adversarial`
- Reviewing an existing code review — use `/review-gauntlet`

# /review-adversarial — Cross-Model Adversarial Review

Spawn reviewers on a **different AI model** to challenge work. Reviewers attack from distinct
lenses grounded in project conventions. The deliverable is a synthesized verdict — do NOT make
changes.

**This is an optional quality gate.** Use it when the stakes justify the extra scrutiny:
large diffs, security-sensitive code, architectural changes, or data model migrations.

**Hard constraint:** Reviewers MUST run via a different model's CLI. Do NOT use subagents,
the Agent tool, or any internal delegation mechanism — those run on *your own* model, which
defeats the purpose of cross-model review.

## Model Selection

Pick the best available opposite model. Preference order:

| If you are | Preferred opposite | CLI command | Fallback |
|------------|-------------------|-------------|----------|
| Claude | **Codex** (o3/o4-mini) | `codex exec` | `gemini -p` |
| Codex | **Claude** (Opus/Sonnet) | `claude -p` | `gemini -p` |
| Gemini | **Claude** (Opus/Sonnet) | `claude -p` | `codex exec` |

**Why Codex is preferred from Claude:** OpenAI's reasoning models (o3/o4-mini) have genuinely
different training, reasoning patterns, and blind spots. Maximum model diversity = maximum
adversarial value. Gemini is a solid fallback if Codex has issues.

The user can override with `--model=codex` or `--model=gemini`.

## Step 0 — Preflight: opposite-model CLI available?

Before loading project context or dispatching reviewers, verify that at
least one preferred opposite-model CLI is on `PATH` and responds to a
trivial auth probe. Check in preference order (Codex → Claude → Gemini):

```
which codex      && codex --version   && codex auth status
which claude     && claude --version  && claude -p "ok" >/dev/null 2>&1
which gemini     && gemini --version  && gemini -p "ok" >/dev/null 2>&1
```

Select the first CLI for which **both** `--version` works (installed)
and the auth probe succeeds (authenticated).

### If no CLI is available

Behaviour depends on how this skill was invoked:

- **Auto mode** (invoked from `/execute-plan --adversarial=auto`):
  skip cleanly. Record in the execute-plan final report:
  ```
  Adversarial review: skipped — no opposite-model CLI available
    - codex: not on PATH
    - claude -p: on PATH but unauthenticated
    - gemini: not on PATH
  ```
  Do **not** fail the execute-plan verdict. Auto mode's job is
  best-effort; a missing CLI is an environment fact, not a quality
  finding.

- **Explicit** (user ran `/review-adversarial` directly, or invoked
  from `/execute-plan --adversarial=always`): **fail loudly**. The
  user asked for adversarial review; skipping silently would betray
  the ask.
  ```
  Adversarial review failed: no opposite-model CLI available.
  Install codex (preferred), claude, or gemini, or re-run without
  --adversarial=always.
  Detected state:
    - codex: not on PATH
    - ...
  ```
  Exit non-zero.

Record the selected CLI (or the skip reason) before proceeding. The
final report must distinguish "ran and found nothing" from
"didn't run".

## Step 1 — Load Project Context

Read `CLAUDE.md` from repo root. Your project's conventions, patterns,
and rules ARE the principles that govern reviewer judgments.

The repo-delivery schema (see `_internal/repo-delivery`) is required —
read the `## Commands` section for:

- `adversarial_triggers` — list of globs that cause `auto` mode to fire
  regardless of diff size (used by `/execute-plan` Phase 3e).

If the `## Commands` section is absent, fail fast with:

```
Repo missing required CLAUDE.md ## Commands section.
See _internal/repo-delivery for the schema.
```

Additional sections to extract from CLAUDE.md for reviewer context:
- Error handling patterns
- Shared types contract
- Import boundary rules
- Testing expectations
- Things You Must Not Do

## Step 2 — Determine Scope and Intent

Identify what to review from context (recent diffs, referenced plans, user message).

Determine the **intent** — what the author is trying to achieve. Reviewers challenge whether
the work *achieves the intent well*, not whether the intent is correct. State the intent
explicitly before proceeding.

Assess change size:

| Size | Threshold | Reviewers |
|------|-----------|-----------|
| Small | < 50 lines, 1–2 files | 1 (Skeptic) |
| Medium | 50–200 lines, 3–5 files | 2 (Skeptic + Architect) |
| Large | 200+ lines or 5+ files | 3 (Skeptic + Architect + Minimalist) |

Read `references/reviewer-lenses.md` for lens definitions.

## Step 3 — Spawn Reviewers

Create a temp directory for reviewer output:

```sh
REVIEW_DIR=$(mktemp -d /tmp/adversarial-review.XXXXXX)
```

### Using Codex (preferred from Claude):

```sh
codex exec --skip-git-repo-check -o "$REVIEW_DIR/skeptic.md" "prompt" 2>/dev/null
```

Use `--profile edit` only if the reviewer needs to run tests. Default to read-only.
Run with `run_in_background: true`, monitor via `TaskOutput` with `block: true, timeout: 600000`.

### Using Gemini (fallback):

```sh
gemini -p "prompt" > "$REVIEW_DIR/skeptic.md" 2>/dev/null
```

Run with `run_in_background: true`.

Name each output file after the lens: `skeptic.md`, `architect.md`, `minimalist.md`.

### Reviewer prompt template

Each reviewer gets a single prompt containing:

1. The stated intent (from Step 2)
2. Their assigned lens (full text from references/reviewer-lenses.md)
3. The CLAUDE.md conventions relevant to their lens (actual content, not summaries)
4. The code or diff to review
5. Instructions: "You are an adversarial reviewer. Your job is to find real problems, not
   validate the work. Be specific — cite files, lines, and concrete failure scenarios.
   Rate each finding: high (blocks ship), medium (should fix), low (worth noting).
   Write findings as a numbered markdown list to your output file."

Spawn all reviewers in parallel.

## Step 4 — Verify and Synthesize Verdict

Before reading reviewer output, log which CLI was used and confirm the output files exist:

```sh
echo "reviewer_cli=codex|gemini"
ls "$REVIEW_DIR"/*.md
```

If any output file is missing or empty, note the failure in the verdict — do not silently skip
a reviewer.

Read each reviewer's output file from `$REVIEW_DIR/`. Deduplicate overlapping findings.
Produce a single verdict:

```
## Intent
<what the author is trying to achieve>

## Verdict: PASS | CONTESTED | REJECT
<one-line summary>

## Findings
<numbered list, ordered by severity (high → medium → low)>

For each finding:
- **[severity]** Description with file:line references
- Lens: which reviewer raised it
- Convention: which CLAUDE.md rule it maps to (if any)
- Recommendation: concrete action, not vague advice

## What Went Well
<1–3 things the reviewers found no issue with — acknowledge good work>
```

**Verdict logic:**
- **PASS** — no high-severity findings
- **CONTESTED** — high-severity findings but reviewers disagree on them
- **REJECT** — high-severity findings with reviewer consensus

## Step 5 — Render Judgment

After synthesizing the reviewers, apply your own judgment. Using the stated intent and
CLAUDE.md conventions as your frame, state which findings you would accept and which you
would reject — and why. Reviewers are adversarial by design; not every finding warrants
action. Call out false positives, overreach, and findings that mistake style for substance.

Append to the verdict:

```
## Lead Judgment
<for each finding: accept or reject with a one-line rationale>
```

## Workflow Integration

This is an **optional step** in the development workflow. The typical flow:

```
working  → /code-review --quick     (periodic mid-development check)
"done"   → /simplify                (auto-refactor: reuse, quality, efficiency)
clean    → /code-review             (full review — REQUIRED)
passing  → /review-adversarial      (cross-model review — OPTIONAL)
reviewed → create PR
```

**When to use it:**
- Large changes (200+ lines)
- Security-sensitive code (auth, payments, API keys)
- Architectural changes (new packages, schema migrations)
- Before merging to master when confidence matters

**When to skip it:**
- Small bug fixes
- Style/formatting changes
- Documentation updates
- Changes that already have comprehensive test coverage

## Recursion safety

Adversarial review cannot recurse:

- The hard constraint above forbids subagents / `Agent` tool /
  internal delegation — reviewers run only via opposite-model CLIs
  (`codex`, `claude -p`, `gemini -p`).
- Those CLI processes operate inside a sandboxed prompt and have no
  access to invoke `/review-adversarial`.
- Effective max depth is **1**. The orchestrator (this skill) is the
  only frame; reviewers cannot spawn further reviews.

If adversarial findings warrant another pass after fixes, the
operator re-invokes this skill manually — that is a fresh, bounded
invocation, not recursion.

## Contract

- **Inputs:** cumulative diff (when invoked from `/execute-plan`, this is `git diff $EXECUTE_PLAN_BASE_SHA..HEAD`); optional `pr_description`; optional `--model=<codex|gemini|claude>` override.
- **Preconditions:** opposite-model CLI on PATH and authenticated (Step 0 preflight selects one); CLAUDE.md present at repo root; this skill is the orchestrator only — it never recurses (max effective depth: 1).
- **Outputs:** synthesized verdict from cross-model reviewers; adversarial findings list with severity and rationale; never makes code changes.
- **Postconditions:** verdict report attached to the PR or `/execute-plan` final report; the report distinguishes "ran and found nothing" from "didn't run".
- **Failure modes:** no opposite-model CLI available → **auto mode** (from `/execute-plan --adversarial=auto`) skips silently and notes the reason in the report; **explicit invocation** (user direct or `--adversarial=always`) fails loudly and exits non-zero. Never use subagents / Agent tool / internal delegation — those run on the orchestrator's own model and defeat the cross-model purpose.
