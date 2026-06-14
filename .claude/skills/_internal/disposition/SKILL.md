---
name: disposition
description: "Rules for dispositioning code-review and adversarial-review findings in the CodeGen flow. Not user-invokable — referenced by execute-plan. Defines status vocabulary, evidence standard, and blocking rules."
user-invocable: false
internal: true
kind: reference
---

# Finding Disposition Governance

Use this rubric when `execute-plan` processes findings from `code-review`,
`code-review-professional`, or `review-adversarial`.

## Core Principle

> Green build + passing tests is not enough. Completion requires explicit disposition of meaningful findings.

## Evidence Standard

A meaningful finding must include:

- severity (`critical`, `major`, `minor`, `nit`)
- evidence (file:line references, specific diff lines)
- why it matters
- recommended fix

Do not disposition against:

- style-only commentary
- speculative requirements
- unsupported objections

## Status Vocabulary

Every meaningful finding gets exactly one of:

- `open` — raised, not yet addressed
- `fixed` — auto-corrected; re-review confirmed the fix
- `disagree-with-evidence` — coder disputes the finding; evidence recorded in the disposition note
- `defer` — real finding, explicitly punted to a named follow-up
- `accepted-risk` — real finding, human explicitly accepts proceeding without fixing
- `resolved` — closed by one of the above after review

## Disposition Loop

### Step 1 — Reviewer raises findings
`code-review` workers write high-signal findings. The controller merges them.

### Step 2 — `execute-plan` auto-fixes
For `critical` and `major` findings, `execute-plan` attempts up to 3 auto-fix cycles (rebuild, retest, re-review after each).

### Step 3 — Remaining findings get a status
Findings that can't be auto-fixed get one of: `disagree-with-evidence`,
`defer`, or `accepted-risk`. `open` is not a valid end-state.

### Step 4 — Gate state
The run's verdict depends on remaining status:
- Any `critical` or `major` still `open` → **FAIL**
- All resolved, `minor`/`nit` only → **WARN** if any minor remain, else **PASS**

## Blocking Rule

Unresolved `critical` or `major` findings block completion.

At the end of the run, explicitly state:
- whether any `critical` or `major` finding remains unresolved
- whether the run is blocked
- whether human arbitration is needed

## Accepted Risk

`accepted-risk` means:
- the finding is real
- it is not being fixed in this run
- a human explicitly accepts proceeding anyway

Do not use `accepted-risk` as a synonym for unresolved disagreement. If the
coder disputes the finding, use `disagree-with-evidence` and record the
counter-evidence.

## Human Arbitration

Escalate to the human when:
- unresolved `critical` findings remain after 3 auto-fix cycles
- `major` findings remain disputed after the reviewer and coder cannot converge on evidence
- the `review-adversarial` output directly contradicts `code-review` on the same line

Document the human decision in the final execution report.

## Auditor Mindset

Anyone reading the final execution report should be able to answer:
- what findings were raised
- how they were dispositioned (fixed, deferred, disputed, accepted-risk)
- whether the run completed, blocked, or proceeded with accepted risk
