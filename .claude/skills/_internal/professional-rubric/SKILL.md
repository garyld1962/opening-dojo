---
name: professional-rubric
description: "Grade definitions and axis descriptions for the Craft grading (seniority-calibrated) used by code-review-professional. Not user-invokable — referenced by code-review-professional."
user-invocable: false
internal: true
kind: reference
---

# Professional Review Rubric

Craft grading (seniority-calibrated) of a code change. This rubric is the
authoritative definition of grades and axes used by
`code-review-professional`.

The rubric grades **code**, not the human who wrote it.

## Grade definitions

### junior

- Works in the happy path; edge cases often missed.
- Abstractions follow tutorials rather than the problem.
- Error handling is minimal or pattern-matched from unrelated code.
- Tests cover the obvious case; brittle or thin.
- Obvious idiom misses (e.g. `useState` for server state when `react-query` is the codebase convention; raw SQL strings when the ORM is used everywhere else).
- Scope may drift — "while I was here" refactors, unrelated fixes.

### mid

- Solid on common cases; handles obvious edge cases explicitly.
- Abstractions are reasonable, but sometimes premature or leaky.
- Error handling is present and mostly appropriate, occasionally overbuilt or underbuilt for the context.
- Tests cover main paths; some adversarial cases; mocks are pragmatic but occasionally over-done.
- Matches most codebase idioms; misses on a few subtler ones.
- Generally scope-disciplined with occasional lapses.

### senior

- Clean judgment visible in tradeoffs: right abstraction level, right amount of error handling, right coupling for the problem.
- Anticipates non-obvious failure modes (concurrent access, partial failures, state transitions).
- Tests are meaningful — they'd catch a real regression, not ceremonial coverage.
- Idioms match the codebase; when diverging, there's a visible reason.
- Strict scope discipline — exactly what was asked, no drive-bys.
- Abstractions are at the right level for the problem size, not premature.

### staff

All of senior, **plus**:

- The design makes future change cheap. Someone adding a feature in this area in six months will thank the author.
- Chose the right problem to solve. Sometimes the best code is the code that reframes the ask to avoid the complexity entirely.
- Made the codebase better, not just bigger. New abstractions earn their weight; old rough edges get trimmed when it's cheap to do so in passing.
- The PR as a unit reads like a clear argument — each commit or section has a purpose, nothing extraneous.

**Staff requires evidence on all 7 axes.** If any axis is below senior, the
component is at most senior.

## Axis definitions

### 1. Clarity

> Can a new teammate read this and understand intent without a walkthrough?

- **junior** — intent is only clear if you already know the feature
- **mid** — clear at function scope; hard at module scope
- **senior** — clear at module scope; names and structure carry the intent
- **staff** — clarity extends to the narrative of the change itself (commits/PR read like an argument)

### 2. Judgment

> Right tradeoffs; no over- or under-engineering for the problem size.

- **junior** — defaults to whatever the framework template suggests
- **mid** — reasonable tradeoffs; occasional over/under-build
- **senior** — tradeoffs visibly considered; chose the simpler path when simpler was better
- **staff** — reframes the problem when appropriate; avoids complexity rather than manages it

**Meta-test — overcomplication cap.** Ask explicitly: *"Would a senior
engineer call this overcomplicated?"* If the solution is substantially
longer, more abstracted, or more indirected than the problem warrants,
the axis grade is **at most `mid`** regardless of other signals —
even if the code is clean, tested, and idiomatic at line level.

Example: a PR adds a `NotificationStrategyFactory` with an abstract
base class, two concrete strategy classes, a registry singleton, and a
fluent builder to send one email confirming a user's account. The code
is well-structured; the tests pass; the abstractions are internally
consistent. Judgment still grades `mid` at most — because the problem
("send one email") didn't warrant four new classes. A senior would
have written a 12-line function. The cap exists so craft grading doesn't
reward clever-but-overbuilt.

### 3. Forethought

> Anticipated failure modes and edge cases beyond the happy path.

- **junior** — happy path; obvious edges maybe
- **mid** — handles the edges a reasonable tester would flag
- **senior** — anticipates concurrent access, partial failures, state transitions, clock drift, and the like — where relevant
- **staff** — identifies failure modes that aren't yet in anyone's test plan

### 4. Idiom

> Uses the language/framework/codebase the way experienced practitioners do.

- **junior** — tutorial patterns; mixes idioms from unrelated codebases
- **mid** — matches most codebase idioms; misses a few
- **senior** — idioms match; when diverging, there's a clear reason
- **staff** — idiomatic enough to raise the codebase's baseline; other contributors learn from it

### 5. Testability

> Structured so it can be tested in isolation; seams are in the right places.

- **junior** — tight coupling to frameworks/IO; tests require heavy mocking or end-to-end setup
- **mid** — seams exist but are sometimes in awkward places
- **senior** — seams are where they naturally belong; tests are easy to write because the structure supports it
- **staff** — testability is a design property, not an afterthought; the code's shape makes the tests almost write themselves

### 6. Scope discipline

> Did exactly what was asked; no drive-by refactors or unrelated cleanups.

- **junior** — scope drift ("while I was here...") shows up
- **mid** — mostly disciplined with occasional lapses
- **senior** — strict scope discipline; unrelated improvements deferred to a named follow-up
- **staff** — scope-disciplined AND identifies scope that should have been in the plan but wasn't, raises it, gets alignment before expanding

### 7. Abstraction

> Right level of abstraction: not leaky, not over-generalized, not premature.

- **junior** — abstractions follow tutorials; premature generalization OR no abstraction where one would clearly help
- **mid** — abstractions are reasonable; sometimes leak implementation details or over-generalize
- **senior** — abstraction level matches the problem; seams are clean; implementation details stay on the right side of the seam
- **staff** — abstractions compound with the codebase; new ones slot in alongside existing ones without seams piling up

## Citation requirement

Every axis grade must be supported by **2–3 specific diff-line citations**
(`file:line`). No citation = do not claim the axis. Skip it and note that
the evidence wasn't present.

## Split decisions

PRs frequently span components with different craft levels. The rubric
expects per-component grading. A PR with `senior` backend and `junior` UI
is a valid, useful result — do not force a single grade.

## Not defect review

This rubric does NOT drive a defect list. If the review identifies a bug,
that bug belongs in the `code-review` output, not here. A component can be
graded `senior` and still have bugs; a component can be `junior` and be
bug-free.
