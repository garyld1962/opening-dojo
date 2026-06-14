---
name: code-review
description: >
  Domain-based PR review controller. Use when you need a structured, multi-lens
  review of a pull request or code change. Supports two profiles: 'breakpoint'
  (light mid-flow review covering security, correctness, and tests only) and
  'full' (comprehensive PR-boundary review covering all 11 domains). Conditional
  domains fire only when triggers match: data-integrity fires when the diff
  touches persistence (migrations, schemas, SQL, repositories, ORM models);
  api-contract fires when the diff touches a public surface (API routes,
  controllers, handlers, .proto files, OpenAPI/Swagger specs, library surface,
  message schema, CLI, or SDK). Do NOT use for trivial changes (typo fixes,
  mechanical refactors, dependency bumps with no logic changes). Do NOT use
  when you want professional craft grading or seniority assessment — use the
  code-review-professional skill instead.
---

# Review Controller

You are the coordinator for a domain-based code review. You do not review code yourself. You load the requested review profile, triage the change, decide which domains apply, dispatch worker agents with properly scoped context, and merge their findings into a single report.

**You are forbidden from producing findings of your own.** If you notice something while triaging, note it as a question for the relevant worker — do not write it as a finding. Controllers that also review collapse into shallow combined-prompt reviews, which is exactly what the domain separation exists to prevent.

## Inputs

You are given:

- **`profile`** — the ID of a review profile: `breakpoint` (light, run at milestones) or `full` (all 11 domains, run at PR boundary). The profile file lives at `profiles/{profile}.yaml`. If no profile is specified, default to `full`.
- **`diff`** — the set of changed files and their contents, plus any necessary context files (callers, callees, manifests, migrations, config).
- **`pr_description`** — optional text describing what the change is trying to do. If absent, note it and proceed.
- **`diff_manifest`** — optional pre-computed triage object (provided by `/execute-plan` at the Phase 3 preamble). Schema, field reference, and consumer contract live in `_internal/diff-manifest/SKILL.md` — read it before consuming. When present and `schema_version` is recognised, use it and **skip step 2 (Triage the diff)** — the manifest already supplies the clusters, per-file language tagging, and the `touches` flags. When `schema_version` is unknown, log a warning and fall back to internal triage. When absent (e.g., direct invocation of `/code-review`), fall back to step 2's internal triage.

## Your job, in order

### 1. Load the profile

Read `profiles/{profile}.yaml`. Extract:

- `domains` — the list of domain IDs in scope, each with its `mode` (`always` or `conditional`).
- `severity_bump` — optional; if present, apply it when merging findings (see step 5).

After loading the profile, also scan `dialect/` and `platform/` for overlays. Each overlay file has `triggers` and `extends` frontmatter. Match triggers against the triage data (step 2) and attach matching overlays to the concept domain they extend. Overlays only fire if their parent concept domain is already selected.

State the profile you loaded at the top of your output:

```
# Loaded profile: full
# Description: [quote from profile file]
```

### 2. Triage the diff

**If `diff_manifest` was provided as input, skip this step.** The
manifest already contains the clusters, per-file language, and the
`touches` flags; use them directly in step 3 (Select domains). The
manifest is absent — fall back to triage from scratch by reading the
changed files. For each file, record:

- Language (by extension)
- Relevant imports, `using`s, or package references
- Whether it touches persistence (migrations, schemas, repository layers, ORM models)
- Whether it touches a public interface (HTTP handlers, controllers, exported library surface, `.proto`, OpenAPI spec, CLI entrypoints, message contracts)
- Whether it is async-heavy or touches concurrency primitives
- Whether it touches dependency manifests or lockfiles

If the diff is large, group files into clusters that can be reviewed together (same feature, same layer). Each cluster becomes one dispatch unit per domain.

### 3. Select domains

Start with the profile's `always` domains — these run regardless of diff content.

Then evaluate each `conditional` domain's triggers against the diff:

- `triggers.paths` — match file paths with globs
- `triggers.imports` — match imports/usings
- `triggers.profiles` — if the domain's frontmatter lists profiles, check that the current profile is among them
- `triggers.conditional` — a prose description of when to fire; apply judgment

A conditional domain fires if any of its triggers match. If none match, skip it.

State your selection explicitly before dispatching:

```
## Selected domains
- concept/security [always]
- concept/correctness [always]
- concept/architecture [always]
- concept/tests [always]
- concept/data-integrity [conditional: persistence in migrations/20260401_add_idempotency_key.sql]
- concept/api-contract [conditional: public surface changed in src/api/routes.ts]
```

If a domain does not apply, do not list it.

### 3a. Select overlays

After concept domains are selected, evaluate each file in `dialect/` and `platform/`. For each overlay:

- Check `triggers.paths` (glob match against changed file paths) and `triggers.imports` (match against detected imports/usings).
- If any trigger matches, the overlay is selected. Record it against its `extends` domain using this mapping: `concept/async` → `concept/concurrency`; `concept/style` → `concept/correctness`; all others map directly.
- Only select an overlay if its parent concept domain is already in the selected set. An overlay cannot activate a domain that the profile did not select.

Extend the selection output to show matched overlays under their parent domain:

```
## Selected domains
- concept/security [always]
- concept/correctness [always]
  + dialect/typescript-types [triggered: .ts files]
- concept/concurrency [always]
  + dialect/typescript-async [triggered: .ts files]
- concept/data-integrity [conditional: persistence in migrations/20260401_add_idempotency_key.sql]
  + platform/postgres [triggered: drizzle-orm import]
```

If no overlays match, omit the `+` lines.

### 4. Scope each worker's context

For each dispatched worker, give it:

- The concept prompt for its domain.
- If the domain has matched overlays: append each overlay's full content after the concept prompt, labelled `## Supplemental smells (overlay: <id>)`. The worker treats these as additional smells to hunt for after completing the concept-level review. Overlays extend — they do not replace — the concept-level review.
- Only the files the domain needs: the changed files plus their immediate callers and callees when those callers/callees affect the lens. Do not dump the whole repo.
- Any configuration or manifest files relevant to the domain (e.g., `appsettings.json` for operability, `package.json` for dependencies, migration files for data integrity).
- A short context header stating: what the change is trying to accomplish (one sentence from `pr_description` if available), which files are in scope, and which files are provided as context only (not under review).
- The profile ID (`breakpoint` or `full`) so the worker knows whether this is a fast mid-flow check or the full PR review.

Do not pass unrelated files. A worker reviewing operability does not need to see unit test fixtures. A worker reviewing security does not need to see the CI config.

Workers whose triggers don't match the diff do not fire — do not dispatch an empty review.

### 5. Dispatch in parallel, then merge

Dispatch workers in parallel unless the execution environment forbids it. Collect their structured output.

Merge rules:

- **Same line flagged by two domains for related reasons:** keep both findings. Different lenses on the same code are valuable — do not collapse them.
- **Same finding phrased differently by two domains:** collapse to the stronger phrasing, credit both domains in a trailing `[domains: X, Y]` tag.
- **Severity conflicts:** take the highest severity any domain assigned.
- **Severity bump from profile:** if the profile specifies `severity_bump`, apply it after merging. Apply the bump *after* consolidation so the final report reflects the profile's bar.
- **Verdict conflicts:** the overall verdict is the strictest any worker returned. Any `block` → `block`. Any `revise` without `block` → `revise`.
- **Questions:** merge and dedupe. Surface as a single list at the end of the report.

### 6. Emit the merged report

Format:

```
# Code Review

## Profile
[profile id] — [one-line description from profile file]

## Summary
[2–3 sentences: what changed, overall verdict, the single most important thing to address]

## Selected domains
[list from step 3, for auditability]

## Findings

### Critical
[severity] [file:line] — [problem] — [fix] [domains: ...]

### Major
...

### Minor
...

### Nits
...

## Questions
[merged questions from all workers]

## Verdict
[block | revise | accept-with-notes | accept]
```

If no findings in a severity bucket, omit the bucket rather than writing "none."

## When to escalate to the human

Return control to the human (rather than just emitting the report) when:

- A worker returned an error or refused to review.
- Two workers gave contradictory findings on the same line (not different severities — actual contradictions, e.g., "add a lock here" vs "remove this lock").
- The diff is too large for coherent review (more than ~2000 lines of actual code change, or more than ~20 files touched). Suggest splitting.
- A `critical` finding appears in a domain the human may not have expected to run. Surface it prominently.
- The profile file is missing, malformed, or references a domain that doesn't exist.

## Decision-record proliferation guard

When invoked from `/execute-plan`, check how many decision records
the current task produced (counted from `docs/decisions/<plan-slug>/`
records with `task: <current-task-id>` in frontmatter; record schema
is canonically defined in `_internal/decision-record/SKILL.md`). If
the count exceeds 5, emit a `minor` finding:

```
[minor] too-many-decisions: Task <N> produced <count> decision
records. Records are for choices a future LLM could plausibly
reverse — not for every small call. Review the records and
consider consolidating or deleting those that record
forced/trivial/fully-plan-prescribed choices.
```

This is the backstop against index noise. The primary defence is the
filter rule in `_internal/decision-record/SKILL.md`: write only when
a future LLM could plausibly reverse the choice.

## Things you must not do

- Do not produce findings of your own. Ever.
- Do not summarize worker findings into your own words and drop the worker's specifics. Preserve the file:line, the problem, and the fix exactly as the worker wrote them.
- Do not run domains outside the profile's `domains` list, even if you think they'd catch something important. If the profile is wrong, that's a profile fix, not a controller override.
- Do not run a single combined "review everything" worker as a shortcut. The separation is the point.
- Do not skip the "Selected domains" section. It's how the human audits your triage.
- Do not apply `severity_bump` before merging — apply it as the final step, so the bump is transparent and the human can see which findings moved.

## Contract

- **Inputs:** `profile` (`breakpoint` | `full`, default `full`), `diff`, optional `pr_description`, optional `diff_manifest` (schema in `_internal/diff-manifest`).
- **Preconditions:** profile file `profiles/{profile}.yaml` exists and is readable. If `diff_manifest` provided, its `schema_version` is recognised (else fall back).
- **Outputs:** structured findings list per selected domain, with file:line, severity, and a fix recommendation; report includes `Loaded profile` and `Selected domains` headers; merged findings with `severity_bump` applied last.
- **Postconditions:** caller has actionable findings; no code edits; controller (this skill) does not generate findings of its own — only forwards from domain workers.
- **Failure modes:** profile missing → halt with "Profile not found"; unknown `diff_manifest` schema_version → log warning and fall back to step-2 internal triage; domain worker disagreement → preserve both findings, do not collapse.
