---
name: parallel-optimization
description: "Analyze a PRD or plan and produce a parallel-agent execution map with dependency barriers, write scopes, and task ownership for LLM code generation. TRIGGER on: 'parallelize the plan', 'parallel execution map', 'concurrency shape', 'optimize task ownership', 'parallel-safe lanes', 'split this plan into waves', 'after I draft the plan run parallel-optimization', 'add a Parallel Execution section'. Auto-invoked by /execute-prd step 6 — humans rarely need to call this directly except when reshaping a sequential plan into parallel before re-running /execute-plan."
---

# parallel-optimization

Purpose: turn requirements into a concurrency-safe execution map. The
output is not a separate source of truth; it is a required section
embedded in the execution plan that later governs `/execute-plan`.

## When to Use

- Inside `/execute-prd` step 6, after the plan is drafted and before
  `/validate-plan` runs.
- When converting a sequential plan to a parallel one, before re-running
  `/execute-plan`.
- When optimizing task ownership for a monorepo with disjoint package
  boundaries.

## When NOT to Use

- Single-package change where parallelism cannot help.
- The plan already has a `## Parallel Execution` section and you are
  not changing it — `/execute-plan` reads it as-is.

## Who calls this

This skill is **not standalone** — its output is a section embedded in
an execution plan that `/execute-plan` will consume.

| Caller | When |
|---|---|
| `/execute-prd` | step 6, mandatory, on every plan it drafts |
| Operator manually | when re-shaping an existing plan from sequential to parallel before a new `/execute-plan` run |

Plan-writers that emit an execution plan (such as `/execute-prd`) MUST
either invoke this skill or inherit a `## Parallel Execution` section
from elsewhere. `/execute-plan` defaults to sequential when the
section is absent, but an explicit declaration is preferred so the
mode (and rationale) are auditable.

`/modernize` does not invoke `/parallel-optimization` itself — it
emits a refactor PRD that `/execute-prd --type=refactor` consumes,
and the parallelism decision happens there.

## Inputs

Read only the artifacts needed for the planning pass:

1. Repo instructions and command contract (`CLAUDE.md ## Commands`).
2. The PRD or draft execution plan.
3. Existing package/module layout, if present.
4. Existing tests and manifests, if present.

## Analysis

Classify each work item by:

- **Write scope:** exact file paths or globs the worker may edit.
- **Dependencies:** contracts, generated files, schema, types, APIs, or
  tests that must exist first.
- **Shared-surface risk:** root manifests, lockfiles, shared exports,
  schemas, migrations, generated files, public API contracts, or
  cross-package config.
- **Verification:** the narrow command that proves the slice works.
- **Integration owner:** the lane responsible for root commands,
  lockfile conflict resolution, and final gates.

Prefer package/module boundaries over feature slices when they produce
disjoint write scopes. Do not parallelize work that naturally edits the
same files unless one lane is read-only.

## Safe Parallel Conditions

A plan is parallel-safe only when all applicable conditions are true:

- Lanes have disjoint write scopes, or the overlap is explicitly
  assigned to one owner.
- Root manifests, lockfiles, shared type exports, public contracts,
  migrations, and generated files have a single owner.
- Contract-producing tasks run before contract-consuming tasks.
- Each lane has focused verification commands, not only repo-wide gates.
- Milestone barriers exist where downstream lanes must wait for shared
  contracts, schemas, or APIs.
- The main executor owns integration, final lint/build/test, and
  conflict resolution.
- Worker instructions say they are not alone in the codebase and must
  not revert other workers' edits.

If these conditions cannot be met, emit a sequential plan and state why
parallelism is unsafe.

## Required Plan Section

Add this section to the generated or optimized plan:

```markdown
## Parallel Execution

**Mode:** parallel | sequential
**Rationale:** <one or two sentences>

### Shared Context Packet
- <repo commands, invariants, contracts, and closed decisions every worker needs>

### Ownership
| Lane | Agent type | Tasks | Write scope | Shared-surface owner | Dependencies | Verification |
|---|---|---|---|---|---|---|
| foundation | worker | 1-2 | package.json, tsconfig.base.json, packages/shared/** | yes | none | pnpm --filter ... |

### Barriers
| Barrier | Wait for | Then unblock |
|---|---|---|
| contracts-ready | shared exports and schemas build | db, api, web lanes |

### Single-Owner Files
- `package.json`: foundation
- `pnpm-lock.yaml`: integration

### Parallel Safety Checks
- [ ] Disjoint write scopes or explicit owner for overlap
- [ ] Shared/public contracts produced before consumers
- [ ] Focused verification per lane
- [ ] Integration lane owns final root gates
- [ ] Worker prompts include multi-agent coordination warning
```

Keep the table concrete. Avoid vague scopes such as "backend files"
when a package path can be named.

## Output Rules

- Preserve the PRD's product requirements; optimization may reorder
  tasks but must not drop acceptance criteria.
- Use milestone barriers instead of waiting after every task.
- Keep root setup, shared contracts, and final verification centralized
  unless the repo already has strong package isolation.
- For greenfield work, create contracts first, then run DB/API/Web
  lanes in parallel when write scopes are separate.
- For existing repos, audit before assigning lanes; parallelize only
  after overlapping files are known.

## Things you must not do

- Do not propose parallelism when write-scope overlap cannot be
  resolved by single-owner assignment. Emit `Mode: sequential` and
  state why.
- Do not rewrite product requirements. Optimization is concurrency
  shape, not scope.
- Do not duplicate the section in multiple plan files. The plan
  `/execute-plan` consumes is the only source.

## Contract

- **Inputs:** the PRD or draft execution plan; CLAUDE.md `## Commands`; existing package/module layout if present; existing tests and manifests if present.
- **Preconditions:** caller is a plan-writer (typically `/execute-prd` step 6); plan tasks have file/scope information sufficient to compute write scopes and dependencies.
- **Outputs:** a `## Parallel Execution` section (Mode + Rationale + Shared Context Packet + Ownership table + Barriers + Single-Owner Files + Parallel Safety Checks); optionally a `## Waves` section when foundation→fan-out structure exists. Output is embedded in the plan, not written to a separate file.
- **Postconditions:** `/execute-plan` Phase 0b.25 / Phase 1 / Phase 1.1 consume the section as authoritative metadata; the section is the single source of truth for parallelism.
- **Failure modes:** safe-parallel conditions cannot be met → emit `Mode: sequential` with rationale (do not silently fall back to unsafe parallelism); ≥5 parallel lanes per wave → refuse and require the operator to split the wave.
