---
name: modernize
description: "Audit a codebase against current AI toolchain capability and produce a prescriptive refactor plan. Use when revisiting an older project (months of dormancy or older-AI-era patterns) to identify structural improvements — abstraction, separation of concerns, types, error handling, tests, infra organization — that newer models can now execute safely. Default --handoff invokes /execute-prd --type=refactor on the resulting plan. Trigger phrases: 'modernize this codebase', 'refresh the code', 'what would this look like today', 'AI-time refresh', 'modernization audit'. Strictly within the current platform/stack — does not propose framework changes, language switches, or public-API rewrites."
---

# /modernize — Code Modernization Audit (AI-Time Refresh)

**Purpose:** Read an existing codebase holistically and produce a prescriptive refactor plan calibrated to current AI toolchain capability. The output is a plan-shaped artifact that hands off to `/execute-prd --type=refactor` so modernization actually happens — this skill is the front-end of a refactor pipeline, not a free-standing report generator.

## When to Use

- Revisiting a project that has been dormant for a meaningful stretch (months+).
- A codebase that bears the marks of older-AI-era patterns: over-defensive try/catch, premature abstraction, type erosion (`any`/`unknown` overuse), kitchen-sink "utils" modules.
- After a major model or skill release where you want to capitalize on what's newly feasible (large multi-file consistent refactors, type-system surgery, cross-module data-flow tracing).
- Phrases: "modernize this", "refresh the code", "what would this look like today".

## When NOT to Use

- Codebase is actively being developed; no AI-time gap exists.
- You have a specific bug or feature — use the relevant focused skill.
- You suspect the project wants a fundamentally different stack — that's a human decision; this skill stays inside the current platform.
- Single-file polish — use `/simplify`.
- Dependency-driven modernization (CVEs, package upgrades) — use `/dep-audit` + `/dep-migrate`.

## Scope Boundaries

**Strictly within the current platform/stack.**

- **Will recommend:** structural refactors, type improvements, module reorganization, error-handling sharpening, test depth, infra/config organization, dead-code removal, naming clarity.
- **Will NOT recommend:** changing the framework, rewriting the public API, switching languages, replacing the database, scope changes that touch >50 files, introducing major new dependencies.

If a "this whole thing wants a different framework" signal is overwhelming, the skill flags it as an `out-of-scope-finding` in the report's appendix. It does **not** include such items in the plan moves. Framework changes are human decisions.

## Arguments

| Argument | Description |
|---|---|
| `[path]` | Path to the codebase root. Default: cwd. |
| `--handoff` | After writing the plan, invoke `/execute-prd --type=refactor <plan-path>` to begin execution. **Default behavior.** |
| `--report-only` | Write the plan but do not invoke `/execute-prd`. Use when you want to review before executing. |
| `--out=<path>` | Plan output path. Default: `docs/plans/modernization-<YYYYMMDD>.md`. |
| `--max-moves=<N>` | Cap the number of primary-plan moves. Default: 10. Findings beyond the cap go to an appendix. |
| `--theme=<name>` | Restrict to a single theme. Repeatable. Themes: `abstraction`, `separation`, `types`, `errors`, `tests`, `infra`. |
| `--pass-through` | Any unrecognized flag is forwarded to `/execute-prd` (e.g. `--interactive=no`, `--adversarial=always`). |

## Workflow

### Phase 1: Project shape detection

Per the `_internal/modernization-rubric` contract §1, classify:
- **Language(s)** — primary language by LOC if multiple manifests exist
- **Type** — CLI / library / app / service / monorepo
- **Size class** — tiny / small / medium / large
- **Test coverage signal** — strong / present / thin / absent
- **Detected patterns** — layered / hexagonal / MVC / functional core / none

Halt if size class is **tiny** (<500 LOC). Modernization audits are not the right tool for that scale; recommend `/simplify` or direct edits.

### Phase 2: Repo state delegation

Invoke `/audit-existing` for the descriptive baseline (what exists, what's implemented, what's missing, contracts). Carry findings forward as context for Phases 3–5. Do not duplicate its work.

### Phase 3: Codebase archaeology (sample-read)

Per the rubric §3, sample-read by signal category — **do not read every file**:

- **Breadth** — first file in every top-level directory
- **Depth** — top 5 modules by LOC, fully
- **Boundaries** — every `index.{ts,js,py}` / `__init__.py` / `mod.rs` / equivalent
- **Public surface** — every file re-exported from the package entry point
- **Risk hotspots** — files >500 LOC; files matching `utils*` / `helpers*` / `common*` / `lib*` / `misc*` (kitchen-sink heuristic)
- **Test parity** — spot-check 3 source files for matching tests

Stop reading when the token budget hits 30% of context — leave room for synthesis.

For each read, evaluate against the rubric §4 per-theme finding patterns.

### Phase 4: "What's now feasible" overlay

For each finding from Phase 3, classify the historical blocker:
- **Was AI capability the blocker?** (multi-file consistent rename, type-system surgery at scale, cross-module data-flow refactor) → **high-confidence** modernization move
- **Was a project-specific constraint the blocker?** (a deliberate choice to defer, a framework limitation, a contract that hasn't moved) → keep available, lower priority

This is the "AI time" overlay. It does not make taste calls — it just reweights the priority of moves whose blocker has been lifted.

### Phase 5: Synthesize moves

Group findings into themes per the rubric §4: Abstraction / Separation of concerns / Types / Errors / Tests / Infra. For each move, capture:

- **Theme**
- **Current state** with `file:line` examples (3 max per move; representative, not exhaustive)
- **Proposed state** (one paragraph)
- **Impact** — high / medium / low
- **Ease** — low / medium / high (estimated effort)
- **Blast radius** — estimated number of files touched
- **Rationale** — why this is a win, in one sentence

### Phase 6: Cull pass

Apply the rubric §5 cull criteria, in order:

1. **Senior engineer test** — would a senior engineer with no codebase context, given a clear before/after, agree the after is better? If no → cut.
2. **Stylistic-preference test** — objective improvement, or taste call? Cut taste calls.
3. **Within-stack test** — stays inside the current platform/stack? Items that fail are demoted to the out-of-scope appendix, not deleted.
4. **Blast-radius vs. impact test** — high blast radius (>15% files) demands high impact; >25% files demands high impact AND a verifiable benchmark (perf, type safety, etc.).
5. **Cap test** — keep top `--max-moves` (default 10) by `impact × ease`. Remainder → appendix.

A short list of high-confidence moves beats a long list of taste calls. **Cull aggressively.**

### Phase 7: Emit refactor plan

Write to `--out` (default `docs/plans/modernization-<YYYYMMDD>.md`).
The output is a **refactor PRD**, not an execution plan — it does
**not** contain a `## Parallel Execution` section. `/execute-prd
--type=refactor` consumes the refactor PRD and runs
`/parallel-optimization` itself in step 6 to produce the parallel
metadata for the eventual execution plan. Format must be consumable
by `/execute-prd --type=refactor`:

```
---
slug: modernization-<YYYYMMDD>
source_prd: (this report)
intent: refactor
type: refactor
---

# Modernization Plan — <YYYY-MM-DD>

**Codebase:** <path>
**Shape:** <type>, <size class>, <language>
**Moves:** <N>
**Generated by:** /modernize

## Summary

| Theme | Moves | Top finding |
|---|---|---|
| Abstraction | N | <one-line> |
| ... | | |

## Closed Decisions

(Inherit from /audit-existing, plus modernization-specific scope ceiling: stay within current stack, no framework/API/language changes.)

## Milestone: Modernization

### Task 1: <move title>

**Theme:** Abstraction
**Current state:**
- `src/lib/foo.ts:42` — <excerpt or paraphrase>
- `src/lib/foo.ts:118` — <excerpt or paraphrase>

**Proposed state:** <one paragraph>

**Acceptance:**
- <mechanically verifiable criterion 1>
- <mechanically verifiable criterion 2>

**Estimated blast radius:** <N files>

(repeat per move; refactor task shape from /execute-prd applies — characterization tests first per `--type=refactor` rules)

## Out-of-scope findings (appendix)

(Items the cull moved here. Not part of execution. Examples: framework change wanted, public API redesign signal, language switch.)

## Considered, not in primary plan (appendix)

(Items below the --max-moves cap.)
```

### Phase 8: Handoff

If `--handoff` (default), invoke:

```
/execute-prd --type=refactor <plan-path> [pass-through flags]
```

`/execute-prd` then runs its readiness gate, audit, validation, and execution against the modernization plan. The refactor plan-shape rules (characterization tests first) apply.

If `--report-only`, stop after Phase 7 with:

```
Modernization plan written to <path>.
Run `/execute-prd --type=refactor <path>` when ready.
```

## Relationship to native skills

This skill is a project-tailored modernization orchestrator unique to savviety-skills. It composes `/audit-existing` (descriptive state) with `_internal/modernization-rubric` (calibration) to produce a refactor plan that feeds `/execute-prd --type=refactor` (execution).

For ad-hoc single-file simplification, use `/simplify`. For dependency-driven modernization, use `/dep-audit` + `/dep-migrate`. For broader project-skills/plugin-ecosystem audit, use `/skill-audit`. Native `superpowers:writing-plans` is the lighter alternative when you want to brainstorm refactor priorities without a structured rubric — but it produces a generic plan, not one calibrated to the AI-time-refresh framing.

## Key Rules

1. **Stay within stack.** No framework, language, or public-API changes. Out-of-scope findings go in the appendix.
2. **Recommend, then execute.** Default to handoff; never auto-apply changes outside `/execute-prd`.
3. **Cull aggressively.** A short list of high-confidence moves beats a long list of taste calls. The appendix exists so cuts aren't losses.
4. **Project shape first.** Hexagonal architecture is wrong for a 200-line CLI. Calibrate to detected shape before recommending.
5. **Token discipline.** Sample-read by the rubric's signal categories; don't read every file. Halt sampling at 30% context.
6. **AI provenance is unreliable.** Don't try to distinguish "old AI wrote this" from "rushed human wrote this." Evaluate code on quality terms.
7. **No taste calls.** Only emit moves where a senior engineer with no codebase context would agree it's a win.
8. **Refactor task shape applies.** Each move's acceptance must be mechanically verifiable; characterization tests come first per `/execute-prd --type=refactor`.

## Things you must not do

- Do not skip the cull pass. Long lists of low-confidence moves are the failure mode this skill exists to prevent.
- Do not invoke `/execute-prd` until Phase 7 has written a complete plan file.
- Do not propose framework, language, or public-API changes inside primary moves. Surface them in the out-of-scope appendix.
- Do not exhaustive-read large codebases. Sample by the rubric's signal categories or halt with a "too large for safe modernization audit" finding.

## Contract

- **Inputs:** codebase path (default cwd); optional `--max-moves` (default 10), `--out` (default `docs/plans/modernization-<YYYYMMDD>.md`), `--handoff` (default) / `--report-only`. Calls `/audit-existing`, `_internal/modernization-rubric`, and on `--handoff` invokes `/execute-prd --type=refactor`.
- **Preconditions:** codebase is readable; CLAUDE.md present; size is within "safe to audit" (sample by the rubric's signal categories — refuse exhaustive reads on very large repos).
- **Outputs:** refactor PRD at `--out` consumable by `/execute-prd --type=refactor`. The PRD does **not** include `## Parallel Execution` (that is added downstream by `/execute-prd` step 6 via `/parallel-optimization`).
- **Postconditions:** stay-within-stack constraint enforced (no framework / language / public-API changes in primary moves); out-of-scope items in the appendix; on `--handoff`, `/execute-prd` takes over.
- **Failure modes:** codebase too large for safe sampling → halt with "too large for safe modernization audit" finding; rubric calibration impossible (no clear signal categories detected) → halt and surface the gap; never auto-apply changes outside `/execute-prd`.
