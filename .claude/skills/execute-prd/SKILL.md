---
name: execute-prd
description: "Read a PRD, RFC, prompt.md, or requirements doc and execute it end-to-end: audit the repo, draft a validated execution plan with parallel-agent map, then run it via /execute-plan. Use when the user has a written requirements source and wants the implementation built — phrases like 'build this PRD', 'execute the PRD', 'turn this RFC into a plan and run it', 'implement prompt.md', 'turn the PRD into an app'. Preferred over superpowers:writing-plans whenever a concrete PRD/RFC/spec file is the input."
---

# /execute-prd — PRD to Plan to Execution

**Purpose:** convert a requirements source into a mechanically verifiable
execution plan, optimize it for safe LLM execution, validate it, then
hand off to `/execute-plan`. After the plan is written, the plan
governs execution.

## Relationship to native skills

This skill is the project-tailored version of `superpowers:writing-plans` chained to `superpowers:executing-plans`, with stricter delivery contracts: AERS readiness gate, repo-aware audit, classified plan shapes (bug/feature/refactor/infra), parallel-agent map, validated plan format, and traceability checks. **Prefer this skill when the input is a PRD/RFC/spec file and the output should be a built application.** For ad-hoc plan-building from a vague intent, `superpowers:writing-plans` is the lighter alternative.

## When to Use

- A PRD, prompt, RFC, or requirements document exists but no
  implementation plan does.
- The user says "build this PRD" or "execute prompt.md" or "turn this
  RFC into a plan and run it."

## When NOT to Use

- A validated plan already exists — invoke `/execute-plan` directly.
- The change is one or two files — make the edit directly.
- The PRD is incomplete, open-ended, or the user wants to think through requirements interactively — close the PRD via `/prd-validate`, or hand off to `superpowers:writing-plans` for an interactive plan-building session.

## Arguments

| Argument | Description |
|---|---|
| `<path>` | Path to the requirements source (optional; if omitted, prefers `prompt.md`, `docs/plans/PRD.md`, `PRD.md`, then obvious RFC/spec files under `docs/`). |
| `--ado <item-id>` | Fetch an Azure DevOps work item by ID and use it as the requirements source. Mutually exclusive with `<path>` and `--linear`. |
| `--linear <issue-id>` | Fetch a Linear issue by identifier (e.g. `BF-42`) and use it as the requirements source. Mutually exclusive with `<path>` and `--ado`. |
| `--type=<bug\|feature\|refactor\|infra>` | Hint the plan type. Auto-detected from the requirements source when omitted. Drives plan shape in step 5. |
| `--plan-path=<path>` | Where to write the generated plan. Default: `docs/plans/execute-plan-<source-slug>.md`. |
| `--parallel=<auto\|sequential>` | Force a parallel mode for the generated plan. Default: `auto` (let `/parallel-optimization` decide). |
| `--design-it-twice=<auto\|always\|never>` | When to run the design-it-twice gate (step 4.5). Default: `auto` (fires only when audit reveals a significant new architectural decision and no closed decision resolves it). |
| Pass-through | Any flag not recognised here is forwarded to `/execute-plan` (e.g. `--interactive=no`, `--adversarial=always`, `--run-folder=<path>`). |

## Workflow

### 1. Load repo contract

Read `CLAUDE.md` and the `## Commands` delivery schema. If the command
contract is missing, halt with the same failure used by `/execute-plan`:

```
Repo missing required CLAUDE.md ## Commands section.
See _internal/repo-delivery for the schema.
```

### 2. Load requirements source

Resolution order:

1. If `--ado <id>` or `--linear <id>` was supplied, invoke `/work-item`
   to fetch the ticket. `/work-item` returns the rendered markdown to
   stdout — it does **not** write to disk. **execute-prd** then
   persists that rendered markdown to
   `docs/plans/PRD-<source-slug>.md` (creating the directory if
   needed) so the rest of the flow has a stable file to reference.
   Extract title, description, acceptance criteria, and work-item type
   from the rendered markdown. The plan header carries
   `**Source:** ADO #<id> — <title>` (or `Linear <id> — <title>`).
   Reject if more than one of `<path>` / `--ado` / `--linear` is set.
2. Otherwise, use the explicit `<path>` if provided.
3. Otherwise, prefer `prompt.md`, `docs/plans/PRD.md`, `PRD.md`, then
   obvious RFC/spec files under `docs/`.

If multiple plausible sources exist and none was named, pause and ask
the operator which is canonical (interactive mode) or abort with a
`plan-ambiguity` finding (autonomous mode).

### 2.5. Classify plan type

Use `--type` if supplied. Otherwise infer from the requirements source:

| Type | Signals |
|---|---|
| `bug` | "fix", "broken", error messages, stack traces; ADO/Linear `Bug` work-item type |
| `feature` | "add", "implement", "create", new behaviour; ADO/Linear `User Story` / `Feature` types |
| `refactor` | "rename", "extract", "move", "clean up", "restructure" with no new behaviour |
| `infra` | "deploy", "config", "CI", "k8s", manifest paths, Dockerfiles, terraform |

The classification governs plan shape in step 5. When the source
spans types (e.g. a feature that includes a config change), pick the
dominant type and represent the secondary as separate tasks.

### 3. Audit current state

Invoke `/audit-existing`. Determine whether the repo is greenfield,
partially implemented, or mature. Do not assume the source describes
current state accurately. Summarise existing packages, implemented
surfaces, missing pieces, duplicated contracts/constants, and relevant
tests before drafting the plan.

### 3.5. Readiness gate

Before extracting non-negotiables or drafting the plan, score the
requirements source using the **Automated readiness check** in
`_internal/aers-readiness/SKILL.md` (compute the points; verdict is
`Ready` / `Partially ready` / `Not ready`). The audit from step 3 is
an input — readiness is judged against *this repo*, not in the
abstract.

Behaviour by verdict:

- **Ready (0–2 pts):** proceed silently to step 4.
- **Partially ready (3–6 pts):**
  - Interactive operator → ask the gap questions inline (one at a
    time) and record answers as **closed decisions** in the
    generated plan (step 5). Do not invent answers. Suggest
    `/prd-validate` if the operator prefers a structured interview.
  - Autonomous (`--interactive=no` passed through) → proceed and log
    the gap list in the plan as a known risk under `## Open
    Decisions`. Do not auto-invoke `/prd-validate`.
- **Not ready (7+ pts):**
  - Interactive operator → halt; suggest `/prd-validate` to close
    gaps. Do not invoke it automatically — it's an interview, not a
    gate.
  - Autonomous → abort with a `requirements-incomplete` finding
    listing the rubric points and the unresolved high-risk
    ambiguities. Do not draft a plan against an unready PRD.

The readiness gate's purpose is to refuse the most expensive failure
mode this skill exists to prevent: a beautifully-validated plan built
on top of an ambiguous PRD.

### 4. Extract non-negotiables

From the requirements source, list explicit MUST/SHOULD requirements,
invariants, acceptance criteria, forbidden behaviours, command
requirements, and final reporting requirements. Carry these into plan
tasks or final traceability checks.

### 4.5. Design-it-twice gate

Governed by `--design-it-twice=<auto|always|never>` (default `auto`).

`auto` fires only when **all** of these hold:

- plan type is `feature` or `refactor`,
- the audit (step 3) reveals a significant new architectural decision —
  a new service boundary, data model shape, public API contract, or
  module interface,
- no `## Closed Decisions` entry in scope already resolves it.

When the gate fires:

1. State the decision in one sentence: *"We need to decide how X
   exposes its interface"* / *"We need to choose the data model for
   Y."*
2. Spawn **3 sub-agents in parallel**, each with the same context but
   a radically different design constraint:

   | Agent | Constraint | Focus |
   |---|---|---|
   | A | Minimize surface area | 1–3 methods/endpoints max, hide everything else |
   | B | Maximize flexibility | Support the most use cases, extensible |
   | C | Optimize for the common case | Make the 80% path trivial; accept trade-offs at the edges |

   Each returns: interface signature, usage example, what it hides,
   trade-offs.
3. Compare on interface simplicity, depth (small surface hiding
   complex internals = good), implementation efficiency, ease of
   correct use vs. ease of misuse.
4. Recommend a shape (often a synthesis). In interactive mode, ask
   the operator to confirm; in autonomous mode, pick the recommended
   shape and proceed.
5. Capture the chosen shape as a **closed decision** in the generated
   plan (step 5). Reference the rejected alternatives in the closed
   decision's body so future runs can see what was considered.

Do not run the gate for bug fixes, infra changes, or feature work
that fits cleanly into existing patterns. The cost of three parallel
design explorations is only justified when the decision will outlive
the plan.

### 5. Draft the plan

Create the plan at the configured path with closed decisions,
milestones, discrete tasks, and mechanical acceptance criteria.

**Shape the tasks by plan type** (from step 2.5):

- **bug** — reproduce-with-failing-test → root-cause → minimal fix →
  regression tests → full-suite verify.
- **feature** — interface/types → failing tests for each behaviour →
  implementation → integration → edge cases.
- **refactor** — **characterization tests first** (capture current
  behaviour) → transform in small steps → verify existing +
  characterization tests still pass → clean up. Refactor plans without
  characterization tests will be flagged `unproved` by execute-plan's
  proof accounting; the plan must include them.
- **infra** — config/manifest changes → apply to target env →
  smoke test end-to-end → documented rollback.

### 6. Run /parallel-optimization

Embed its output as `## Parallel Execution` in the plan. If parallelism
is unsafe or `--parallel=sequential` was set, set `Mode: sequential` and
explain why.

#### Wave structure (when streams share a foundation)

When `/parallel-optimization` identifies multiple independent streams
that **share a sequential foundation** — typically shared types,
generated clients, schemas, or migrations that several packages
consume — emit a `## Waves` section in addition to (not instead of)
`## Parallel Execution`:

```
## Waves

| Wave | Tasks | Focus | Execution |
|---|---|---|---|
| 1 | 1–4 | Shared types, generated client, migrations | sequential (`/execute-plan`) |
| 2 | 5–12 | Backend / UI / mobile streams | parallel lanes (3 teams) |
| 3 | 13–15 | Integration, e2e tests, traceability | sequential (`/execute-plan`) |

Merge order: Wave 1 must complete before Wave 2; Wave 2 teams must
all complete before Wave 3.
```

Mark wave boundaries in the plan body with literal markers:

```
## --- WAVE 1 START ---
## Task 1: ...
...
## --- WAVE 2 START ---
## Task 5: ...
```

**Constraints:**

- **Max 4 teams per parallel wave.** If more than 4 independent streams
  exist, split into sequential parallel waves (e.g. Wave 2 with 3
  teams, Wave 3 with 3 teams, Wave 4 sequential integration).
  `execute-plan` enforces this in Phase 1.1; emitting a 5+-team wave
  will fail validation.
- Each team must own ≥3 tasks. Smaller teams pay more coordination
  cost than they save.
- A wave is sequential by default. Mark `parallel` only when the wave's
  task set genuinely splits into disjoint write scopes.

#### Team boundary heuristics

A "good split" puts each team in a write scope that cannot collide
with any other team's. Use these as authoring tests:

| Good split | Why it works |
|---|---|
| Backend API vs. UI pages | Different packages, different file trees |
| New service vs. infrastructure | New files vs. config — disjoint by construction |
| Test suite vs. feature code | Tests rarely conflict with the code under test, when the tests live in their own files |
| Two distinct microservices | Separate deployables; the only contact is their wire contract |

| Bad split | Why it breaks |
|---|---|
| Two teams editing the same file | Guaranteed merge conflicts every commit |
| Shared types team + consumer team in the same wave | Consumer blocks on types; the parallelism is fake |
| Two UI teams sharing a component library | The shared file is a single-owner surface; pick one owner and serialise |
| "Refactor" team + "feature" team on the same module | Refactor renames; feature edits the renamed thing — the rebase is the work |

When unavoidable overlap exists (e.g. two teams must both add to a
shared `types.ts`, a generated client, or a root manifest), split
that surface into its own earlier wave (Wave 1: shared types
sequential; Wave 2: consumers parallel). This is the single most
common reason a plan needs a multi-wave structure: the shared
foundation is itself a team's work, not a "free" prerequisite.

`execute-plan` Phase 1.1 will halt with a `plan-ambiguity` finding if
two lanes' write scopes overlap and no single-owner is named. Catch
the overlap at plan-authoring time so the executor doesn't have to
abort.

When no foundation/fan-out structure exists, omit the `## Waves`
section entirely — a single-wave plan is the common case.

### 7. Validate

Run `/validate-plan` against the generated plan. If it fails, fix the
plan and revalidate; do not execute a failing plan.

**Loop bound.** Cap the fix-and-revalidate cycle at **3 attempts**.
After 3 failed validations:

1. Stop drafting.
2. Surface to the operator the top blocking finding from the most
   recent `/validate-plan` run, the two prior fix attempts, and what
   each attempt changed.
3. Ask whether to (a) escalate readiness back to step 3 (the PRD may
   be the actual blocker), (b) accept a manual override and execute
   anyway with the failing finding logged as a known risk, or
   (c) abandon.

The cap exists because an LLM author can otherwise generate the same
shape of invalid plan indefinitely.

### 8. Execute

Invoke `/execute-plan <generated-plan>` with any pass-through flags.
Use the generated plan as the sole execution authority.

## Plan Authoring Rules

- Make every task independently understandable, with explicit
  file/package ownership.
- Put shared contracts, schemas, generated clients, and root workspace
  setup before consumers.
- Use package/module ownership so worker write scopes are disjoint
  where possible.
- Keep root manifests, lockfiles, shared exports, migrations, and
  public API contracts single-owner.
- Include focused verification commands per task or lane, plus final
  repo gates.
- Preserve all source acceptance criteria and non-negotiables; add
  tests before implementation when a task names behaviour not currently
  covered.
- Prefer contract-first tasks: shared public types/constants, API
  response mapping, generated clients, schemas, and migrations should
  precede consumers.
- Require explicit JSON/runtime boundary mapping where server values
  differ from wire values, such as `Date` objects becoming ISO strings.
- Record open product decisions as closed decisions only when the PRD
  or user has resolved them. Otherwise include a clear question and
  stop before execution.

## Generated Plan Minimum Structure

The plan must include:

- YAML frontmatter with `slug`, `source_prd`, `intent`, and `type`
  (`bug` / `feature` / `refactor` / `infra`).
- H1 title.
- `**Source:**` line referencing the original artefact (path or
  ADO/Linear ID).
- `## Closed Decisions` when product or technical choices are fixed
  (including any decision captured by step 4.5).
- One or more `## Milestone:` sections.
- Numbered `## Task N:` sections.
- For each task: concrete description and `**Acceptance:**` bullets
  that can exit 0 or be directly observed.
- `## Parallel Execution` using the format from
  `/parallel-optimization`.
- `## Waves` section and `## --- WAVE N START ---` markers when the
  plan has a foundation → fan-out → integration structure.
- Final verification task with the repo's declared lint/build/test
  commands.
- Final traceability task mapping source requirements and
  non-negotiables to implementation files and verification.

## Execution Boundary

Once validation passes, do not keep using the PRD as the active
instruction source for implementation choices. Use the PRD only for
traceability checks. If execution reveals a mismatch between PRD and
plan, halt as a `plan-ambiguity` or `plan-deviation` instead of
silently changing scope.

## Things you must not do

- Do not skip `/audit-existing`. Greenfield assumptions on a populated
  repo are the most expensive failure mode this skill exists to prevent.
- Do not skip the readiness gate (step 3.5). Drafting a plan against
  an unready PRD is the second most expensive failure mode.
- Do not skip `/validate-plan`. A bad plan silently guessed through is
  the third most expensive failure mode.
- Do not draft and execute in one shot — the staged validation is the
  point.
- Do not loop on `/validate-plan` without bound. Three attempts then
  surface to the operator (see step 7).
- Do not invent product decisions to close ambiguity. Halt and ask.

## Contract

- **Inputs:** one of `<path>` to a PRD/RFC/spec, `--ado <id>`, or `--linear <id>`. Optional flags: `--type`, `--plan-path`, pass-throughs to `/execute-plan`. Calls `/work-item` (when `--ado`/`--linear`), `/audit-existing`, `_internal/aers-readiness`, `/prd-validate` (interactive), `/parallel-optimization`, `/validate-plan`, `/execute-plan`.
- **Preconditions:** repo has CLAUDE.md `## Commands` per `_internal/repo-delivery`; `docs/plans/` is writable; tracker auth if `--ado`/`--linear`; `/audit-existing` is runnable on this repo.
- **Outputs:** canonical PRD artefact at `docs/plans/PRD-<source-slug>.md`; validated execution plan at `--plan-path` (default `docs/plans/<slug>.plan.md`); execution begins via `/execute-plan` in step 8.
- **Postconditions:** plan passes `/validate-plan` before execution; `## Parallel Execution` section present in the plan; closed decisions captured in plan frontmatter.
- **Failure modes:** readiness gate (step 3.5) blocks → halt; `/validate-plan` fails → fix-and-revalidate up to 3 attempts then escalate to operator (see step 7); plan-ambiguity in autonomous mode → halt with finding; never invent product decisions.
