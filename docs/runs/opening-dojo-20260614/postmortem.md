# Postmortem

## Run reference
- **Plan:** docs/plans/opening-dojo.plan.md
- **Verdict:** WARN · Gate: completed-with-accepted-risk
- **Branch/base/head:** master / 4b825dc (empty tree) / 299dc39
- **Trigger:** WARN verdict + 2 partially-proved rows
- **Mode:** full

## What happened
Executed a 12-task greenfield plan: a deterministic chess opening trainer
(London + Caro-Kann) on Next.js 15 + Prisma with an explanation-only AI coach.
Three waves — sequential foundation, four parallel feature lanes in isolated git
worktrees, sequential integration — landed in 22 commits. All gates green (86
tests); every critical/major finding across two breakpoint reviews, a full
review, a craft review, and a codex adversarial pass was fixed.

## What worked
- **Parallel worktrees** fanned out four feature lanes cleanly; disjoint write
  scopes meant conflict-free sequential merges.
- **Wave barriers earned their keep:** the post-merge integration gate caught a
  cross-lane Board `onMove` signature mismatch and a shared-Postgres test race
  that the isolated per-lane runs could not see.
- **Layered review caught layered bugs:** the breakpoint review caught a
  `moveNumber` contract defect; the full review caught a PRD-required decay
  feature that was implemented, unit-tested, and never wired in; the adversarial
  cross-model pass caught a reveal→replay scoring exploit the other four review
  passes missed.

## What broke down

### Tool and skill usage
- The skill's `_internal/` rubrics (repo-delivery, disposition, diff-manifest,
  decision-record) were absent in this repo; inline SKILL.md guidance was applied
  instead. No correctness impact, but disposition vocabulary was applied by hand.
- `prisma migrate dev` aborts without a TTY, blocking a mid-run schema change
  (the `Opening.name` unique constraint). Worked around with delete-recreate
  seeding; the constraint became a deferred minor.
- Vitest and tsc glob into `.worktrees/` by default — the first parallel-wave
  test run executed four stale copies of the suite until excludes were added.

### Requirements fit
- The plan under-specified two **cross-lane contracts**, both of which surfaced
  only at integration: (1) the shared Board component's API — Lane A built
  `onMove(san, fenAfter)`, Lane B consumed `onMove(from, to)`, and it typechecked
  because both are `(string, string)`; (2) the drill-attempt → progress wiring —
  Lane B persisted attempts, Lane D computed progress, but nothing called the
  update, so N7 was silently unmet until the e2e forced it.

## What the process missed
- A "green test, dead feature" class of gap: `applyDecay` shipped fully tested
  but with no call site. Unit coverage gave false confidence; only a reading of
  call sites (full review) caught it.
- Two `partially-proved` acceptance rows (Board component-render assertion;
  `getProgressSummary` DB enrichment) — exercised indirectly, not pinned.

## Recommendations
| # | Target | Type | Summary |
|---|---|---|---|
| 1 | plan-template | improve-prompt | When ≥2 parallel lanes share a component/contract, require its API (prop names + handler signatures) as a Closed Decision so integration can't silently mismatch |
| 2 | plan-template | add-rubric-rule | Make cross-module wiring (e.g. persist→aggregate) an explicit task, not an implied side effect of two independent lanes |
| 3 | claude-md/commands | documentation | Document a non-interactive Prisma migration path (migrate dev needs a TTY) |
| 4 | execute-plan-skill | add-gate | Phase 2.7 should ensure the test/typecheck config excludes `.worktrees` before dispatch (or the scaffold should) |
| 5 | code-review-profile | add-rubric-rule | Add a "exported + unit-tested but no call site" (dead-feature) check to the full profile |
