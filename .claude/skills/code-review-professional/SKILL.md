---
name: code-review-professional
description: "Seniority-calibrated craft grade (junior/mid/senior/staff) across 7 axes with line-cited reasoning. Use at the PR boundary after code-review."
---

# /code-review-professional — Seniority Grading

**Purpose:** Judge the craft level of a code change on a seniority
scale. Output a grade per identifiable component, each with
evidence.

This skill does **not** find defects. That's `code-review`'s job. If you
find a bug, note it as a question for the code-review skill — do not
record it as a grading finding.

## When to Use

- At the PR boundary in the CodeGen flow, after `code-review` with `profile: full`.
- When a reviewer wants an external judgment on "what level of engineer wrote this."
- When onboarding feedback on a team member's work is useful.

## When NOT to Use

- Mid-flow / at milestones — use `code-review` with `profile: breakpoint`.
- When you want a defect list — use `code-review`.
- When the change is <10 lines — grading is noise.

## Inputs

- **`diff`** — the set of changed files. Prefer `git diff $EXECUTE_PLAN_BASE_SHA..HEAD` at the PR boundary when invoked from `/execute-plan`.
- **`pr_description`** — optional. If absent, note it and proceed.
- **`requirements_source`** — optional prompt, PRD, RFC, issue, or plan text containing explicit non-negotiables. When present, use it for the Contract Compliance section below.
- **`diff_manifest`** — optional pre-computed triage object (provided by `/execute-plan` at the Phase 3 preamble). Schema, field reference, and consumer contract live in `_internal/diff-manifest/SKILL.md` — read it before consuming. When present and `schema_version` is recognised, use its `clusters` as the component boundaries for step 1 (Identify components); do **not** re-cluster the diff. This guarantees you and `/code-review` report on the same components. When `schema_version` is unknown, log a warning and fall back to clustering from the diff yourself. When absent (e.g., direct invocation), fall back to clustering from the diff yourself.

## Grade scale

See `_internal/professional-rubric/SKILL.md` for the full definitions. In
summary:

- **junior** — happy-path thinking; tutorial-level abstractions; edge cases missed; tests thin.
- **mid** — solid on common cases; abstractions reasonable but sometimes premature or leaky; obvious edges handled; tests cover main paths.
- **senior** — clean judgment, right abstraction level, anticipates failure, scope-disciplined, meaningful tests.
- **staff** — all of senior **plus** the design makes future change cheap; chose the right problem to solve; made the codebase better, not just bigger.

## Grading axes (7)

Evaluate each component on all seven axes. Each axis requires **2–3 concrete
diff-line citations** as evidence. No citation → don't claim the axis.

1. **Clarity** — can a new teammate read this and understand intent without a walkthrough?
2. **Judgment** — right tradeoffs; no over- or under-engineering for the problem size.
3. **Forethought** — anticipated failure modes and edge cases that aren't the happy path.
4. **Idiom** — uses the language/framework the way experienced practitioners do.
5. **Testability** — structured so it can be tested in isolation; seams are in the right places.
6. **Scope discipline** — did exactly what was asked; no drive-by refactors, unrelated cleanups, or feature creep.
7. **Abstraction** — right level of abstraction: not leaky, not over-generalized, not premature.

## Per-component grading

A single PR is rarely one seniority level. Split by identifiable component
and grade each independently. Component boundaries come from the diff
itself — common patterns:

- Directory clusters (`src/api/...` vs. `src/web/...` vs. `migrations/...`)
- Language boundaries (TypeScript backend vs. TypeScript frontend vs. SQL)
- Layer boundaries (domain logic vs. HTTP handlers vs. UI)

If the diff is too small or too uniform to split meaningfully, grade it as
one component and state so.

**Split decisions are expected.** A PR where the backend is `senior` and
the UI is `junior` is a valid, useful result. Do not force a single
overall grade when the evidence points different ways.

## Your job, in order

### 1. Identify components

**If `diff_manifest` was provided, use its `clusters` array as your
components verbatim — do not re-cluster.** This keeps your reports
aligned with `/code-review`'s. Absent the manifest, scan the diff
and cluster files into components. State the clusters up front:

```
## Components
- Backend — src/api/*, src/services/*
- UI — src/web/*
- DB migrations — migrations/*
```

If there's only one meaningful cluster, say: `Single component — entire diff graded together.`

### 2. Grade each component on each axis

For each component, evaluate all 7 axes. For each axis, cite **2–3 diff
lines** as evidence. Format:

```
### Backend

**Clarity: senior**
- `src/api/auth.ts:42` — intent of `ensureScopesCover` is obvious from the name and signature.
- `src/services/session.ts:88` — comment explains the non-obvious invariant without restating the code.

**Judgment: senior**
- `src/api/auth.ts:15` — validation deliberately lives in the controller, not repeated in the service; correct for this codebase's layering.
- `src/services/session.ts:103` — did NOT introduce a cache here; the lookup is cheap and caching would add coordination cost for no measured gain.

**Forethought: mid**
- `src/api/auth.ts:67` — handles 401 and 403 distinctly — good.
- `src/services/session.ts:120` — no handling for the `expired but about to rotate` race; this is a common edge case in auth flows and would show up under load.

[...other axes...]

**Component grade: senior** (split from forethought's mid, but 6 of 7 axes at senior → senior overall)
```

### 3. Determine component grade

After grading all 7 axes for a component, pick the component-level grade:

- **Unanimous** — all 7 axes agree → that's the grade.
- **Majority** — 5 or 6 axes at one level, 1 or 2 others one level off → the majority level, noting the weak axes.
- **Split** — 3/4 or 4/3 across levels → grade as the **lower** of the two dominant levels, with a clear note that the stronger axes carry the weaker ones.
- **Staff requires evidence on all 7 axes** — if any axis is below senior, the component is at most senior, never staff.

Record the reasoning in one sentence:
```
Component grade: senior — consistent senior on 6 axes; forethought slipped to mid on one edge case but didn't compromise the rest.
```

### 4. Write the overall read

A short paragraph (3–5 sentences) summarizing the grades across components.
Name the single strongest and single weakest observations. Do not repeat
axis-level detail; point back to the tables.

### 5. Contract compliance addendum

If a requirements source is available, extract explicit non-negotiables
and acceptance criteria such as "must not swallow errors", "dates must be
ISO strings", "soft delete only", or "run these commands". Add a short
compliance table after the craft grading:

```
## Contract Compliance

| Requirement | Evidence | Status |
|---|---|---|
| <requirement> | `<file:line>` and test/command evidence | pass/fail/unclear |
```

This addendum is not a defect list and must not replace `/code-review`.
Its job is to keep craft grading from ignoring hard product or prompt
requirements.

## Output format

```
# Professional Review

## Components
- Backend — src/api/*, src/services/*
- UI — src/web/*

## Per-component grades

### Backend

**Grade: senior**

| Axis | Grade | Evidence |
|---|---|---|
| Clarity | senior | `src/api/auth.ts:42` ...; `src/services/session.ts:88` ... |
| Judgment | senior | `src/api/auth.ts:15` ...; `src/services/session.ts:103` ... |
| Forethought | mid | `src/api/auth.ts:67` ...; `src/services/session.ts:120` ... |
| Idiom | senior | ... |
| Testability | senior | ... |
| Scope discipline | senior | ... |
| Abstraction | senior | ... |

Reasoning: consistent senior on 6 axes; forethought slipped on one edge case.

### UI

**Grade: junior**

| Axis | Grade | Evidence |
|---|---|---|
| Clarity | mid | ... |
| Judgment | junior | `src/web/LoginForm.tsx:22` — useState for server state where react-query is already available elsewhere; typical junior pattern. |
| ... | ... | ... |

Reasoning: abstractions are tutorial-level, state management doesn't match codebase conventions, tests only cover the happy path.

## Overall read

Backend and UI diverge sharply. The backend shows senior-level judgment and
abstraction — the UI shows a first pass that would normally come back with
review comments from a senior. The strongest axis in the diff is Judgment
on the backend (`src/api/auth.ts:15`). The weakest is Judgment on the UI
(`src/web/LoginForm.tsx:22`). The UI is the one to pair on before merge.
```

If applicable, append the Contract Compliance table after `## Overall read`.

## Self-audit before delivery

Before returning the report, run a three-lens pass on your own grades. Adapted from `dev/review-gauntlet/SKILL.md`. The goal is to catch the failure modes most common in seniority grading: citations that don't say what you claim, axes graded without sufficient evidence, and judgments that punish the author rather than the code.

Run silently — do not include the audit in the output. Use it to revise the report. If a finding cannot be revised to pass the audit, drop it.

### Skeptic — accuracy of citations

For every cited line:
- Re-read the cited file/line. Does it actually demonstrate the axis claim?
- If you graded an axis below `senior`, is the evidence concrete (a specific failure mode), or just "I would have written it differently"?
- Severity check: is `junior` justified by tutorial-level patterns or missed obvious cases, not by stylistic preference?

If a citation fails: revise the grade or drop the citation. An axis with fewer than 2 surviving citations must be marked "insufficient evidence" and excluded from the component grade.

### Architect — structural fit

- Are component boundaries right? Did you bury two genuinely different components inside one cluster (and thus average a senior backend with a junior UI)?
- Are any axes silently missing for a component? All 7 must be addressed or explicitly skipped.
- Did you grade only the surface of the diff (file-by-file) when the structural story is across files (e.g., a leaky abstraction visible only when you read the caller and callee together)?

If a structural issue surfaces: re-cluster, re-grade, or add a note in the Overall Read pointing at the cross-file pattern.

### Pragmatist — usefulness of the grade

- Is the grade actionable? "Junior on Forethought" with one weak edge case is not useful — it just labels the author. Either point to a concrete pattern they could learn, or drop the axis to "insufficient evidence."
- Are you punishing defects? Defects belong in `code-review`. If a low grade rests on a bug, move the bug to "Notes for code-review" and re-grade the axis on craft alone.
- Does the overall read point to something the team can act on (pair on the UI before merge, ask for a follow-up on edge cases), or does it just label?

If the grade fails the pragmatist test: revise the reasoning to be actionable, or drop to "insufficient evidence."

### Self-audit gates

The report does not ship until:
- Every retained citation passes Skeptic.
- Component boundaries pass Architect.
- Every component grade has at least one actionable takeaway in the Overall Read.

## Things you must not do

- Do not report defects. That's `code-review`'s job. If you see a bug, list it under a final "Notes for code-review" section — do not inflate axis grades to punish defects.
- Do not grade axes without diff-line citations. No citation = skip the axis and note it.
- Do not force a single overall grade when components clearly differ. Split decisions are the expected output, not the exception.
- Do not use the grade to judge the author as a person. Grade the code in this diff, not the human.
- Do not grade a component staff unless all 7 axes are at senior or above and there's evidence the design improves the codebase beyond this change.

## Contract

- **Inputs:** `diff` (prefer `git diff $EXECUTE_PLAN_BASE_SHA..HEAD` when invoked from `/execute-plan`); optional `pr_description`; optional `requirements_source`; optional `diff_manifest` (schema in `_internal/diff-manifest`).
- **Preconditions:** diff is at least ~10 lines (otherwise grading is noise — refuse). Rubric in `_internal/professional-rubric/SKILL.md` is current. If `diff_manifest` provided, its `schema_version` is recognised (else fall back).
- **Outputs:** per-component grades on the 7 axes (junior/mid/senior/staff) with **2–3 diff-line citations per axis**; "Overall Read" with actionable takeaways per component; defects (if seen) listed under "Notes for code-review", not folded into axis grades.
- **Postconditions:** caller (typically `/execute-plan` Phase 3e or a human reviewer) has a graded report; no code edits; component boundaries match `/code-review` when `diff_manifest` was shared.
- **Failure modes:** axis with no citations → skip the axis and note it; components with materially different grades → split decision (do not force a single overall grade); unknown `diff_manifest` schema_version → log warning and fall back to internal clustering.
