---
name: execute-plan
description: "Execute an existing written implementation plan end-to-end with staged reviews, per-task build/test cycles, milestone breakpoints, parallel agent lanes via git worktrees, retry budget, adversarial review, and a calibrated craft grade. Use when the user already has a plan file (typically produced by /execute-prd) and wants it run — phrases like 'execute the plan', 'run docs/plans/X.md', 'resume the plan'. Preferred over superpowers:executing-plans whenever the plan follows this skill's wave/team/closed-decisions format."
---

# /execute-plan — Plan Executor with Staged Reviews

**Purpose:** Execute a written implementation plan with a staged review sequence:
validate-plan → per-task build/test → breakpoint review at each milestone → full
code review + professional (craft) review at the PR boundary → optional
adversarial review.

## When to Use

- You have a written plan file ready to execute.
- You want per-task build/test cycles plus staged code reviews.
- You want a seniority-calibrated craft grade on the final output.

## When NOT to Use

- No plan exists yet — write a plan first via `/execute-prd` (PRD-driven) or `superpowers:writing-plans` (ad-hoc).
- Trivial single-file change — just make the edit directly.

## Relationship to native skills

This skill is the project-tailored version of `superpowers:executing-plans`, with stricter delivery contracts: closed-decisions gate, parallel waves with single-message dispatch in isolated git worktrees (Phase 2.7), retry budget circuit breaker, milestone breakpoint reviews, full + craft + adversarial reviews at the PR boundary, and a calibrated craft grade. **Prefer this skill when the plan follows the `/execute-prd` format.** For ad-hoc plans, `superpowers:executing-plans` is the lighter alternative. On impasse — retry-budget exhaustion or a task that loops without converging — invoke `superpowers:systematic-debugging` before resuming; cheap retries on a wrong mental model just burn budget.

## Arguments

| Argument | Description |
|---|---|
| `<path>` | Path to the plan file (optional; if omitted, finds the most recent `.md` in `docs/plans/`). |
| `--interactive=<yes\|no\|auto>` | How to handle execution-time ambiguity (see Phase 1.5). Default: `auto`. `yes` = pause and ask on every ambiguity; use when a human is supervising. `no` = batch / CI mode; never prompt; on ambiguity, abort cleanly and log the question in the final report's `## Open Questions` section. `auto` = detect TTY; prompt if present, otherwise abort. |
| `--force` | Bypass the refuse-on-FAIL contract (see Phase 0). `validate-plan` returning FAIL still runs `/execute-plan` anyway. **For humans only; never set by the harness or by default.** Use is logged prominently in the final execution report so the bypass is auditable. |
| `--resume` | Resume a previously aborted run instead of starting fresh. Scans commits on the current branch for `Task N from <plan-file>` footers, ignoring `review(` auto-fix commits. Verifies all prior task commits share the same `Plan-SHA`; if the current plan file's SHA has drifted, refuses to resume. After confirming matching Plan-SHA, re-runs the last milestone's breakpoint review against the accumulated diff for fresh scrutiny, then proceeds at the next task. Prior abort tags are preserved as audit markers. |
| `--create-branch` | In Phase 0c, create a feature branch even if HEAD is already on a non-default branch. Useful when the caller wants a clean slate. Branch is named `execute-plan/<plan-slug>-<YYYYMMDD-HHMM>` off `default_branch`. |
| `--max-retries=<N>` | Override the global retry budget for this run (see "Retry budget" below). Default: 20. |
| `--max-minutes=<N>` | Override the wall-clock budget for this run. Default: 60. |
| `--accept-risk=<finding-id>` | Explicitly accept a critical or major finding (see `_internal/disposition`). Can be repeated for multiple findings. **For humans only** — never set by the harness. Each use is logged in the final report with the finding it accepted. |
| `--adversarial=<auto\|always\|never\|ask>` | When to run the adversarial review stage (Phase 3e). Default: `auto`. `auto` = fires when the cumulative diff is ≥200 lines OR touches a path listed in `adversarial_triggers`; otherwise skipped silently. `always` = always runs regardless of diff size or paths. `never` = never runs; no prompt, no invocation. `ask` = interactive legacy behaviour; prompt the user per the legacy flow. Use `ask` only when a human is supervising. |
| `--run-folder=<auto\|off\|path>` | Bundle run artefacts (`execution-report.md`/`.json`, `disposition-log.md`, optional `postmortem.md`) into a timestamped folder for audit retrieval. Default: `auto` (off unless the repo-delivery `## Commands` schema declares `runs_root:`, in which case the folder is `<runs_root>/<plan-slug>-<YYYYMMDD-HHMMSS>/`). `off` keeps the legacy single-file report at `--report-path`. `path` writes the folder at the given location. |
| `--postmortem=<auto\|always\|never>` | When to run the Phase 5 postmortem. Default: `auto` (fires on `WARN`, `FAIL`, retry-budget exhaustion, or when escalation occurred; skipped on clean `PASS`). `always` runs regardless. `never` skips even on failure. |
| `--postmortem-mode=<auto\|full\|lightweight>` | How deep the Phase 5 postmortem goes. Default: `auto` (`lightweight` for `PASS` triggers, `full` for WARN/FAIL/blocked). `lightweight` writes only `What happened`, `What broke down` (free-form), and `Recommendations`. |

### `adversarial_triggers`

An optional list of globs whose modification causes `--adversarial=auto`
to fire regardless of diff size. Read from the repo's CLAUDE.md
`## Commands` section (see `_internal/repo-delivery`). If absent, the
default list is used:

```
adversarial_triggers:
  - src/auth/**
  - src/payments/**
  - migrations/**
  - **/crypto/**
```

`adversarial_triggers` is defined in exactly one place (the repo's
CLAUDE.md or the default above); do not duplicate it inside individual
plans.

### `team_agents` (parallel wave subagent overrides)

Phase 2.7 (wave dispatch) substitutes prompts into three default
templates shipped with this skill:

- `<skill-root>/execute-plan/agents/implementer.md`
- `<skill-root>/execute-plan/agents/reviewer.md`
- `<skill-root>/execute-plan/agents/fixer.md`

A consumer repo may override any of them via its `## Commands` block:

```
team_agents:
  implementer: docs/agents/our-implementer.md
  reviewer:    docs/agents/our-reviewer.md
  fixer:       docs/agents/our-fixer.md
  implementer_model: sonnet     # optional; defaults in Phase 2.7d apply
  reviewer_model:    sonnet
  fixer_model:       sonnet
```

Override paths are resolved relative to the repo root. Override
templates must accept the same placeholder set as the defaults — the
executor does not detect missing placeholders and will substitute
whatever is present.

## Workflow

### Phase 0: Preflight

Two gates before any execution work:

**0a. Repo-delivery contract.** Read the `## Commands` section of the
repo's `CLAUDE.md` per `_internal/repo-delivery`. If it's missing, fail
fast with this exact message and stop — do not infer, do not guess,
do not fall back to manifest detection:

```
Repo missing required CLAUDE.md ## Commands section.
See _internal/repo-delivery for the schema.
```

The `lint` / `build` / `test` / `default_branch` / `package_manager`
fields drive every subsequent phase. The rubric is the schema
definition; the message above is the exact user-facing string.

**0b. Validate plan — refuse contract.** Invoke `/validate-plan <path>`.
If it returns `VERDICT: FAIL`, **refuse to execute** and surface the
findings. Do not proceed under any circumstances except the explicit
`--force` override (see below). This refusal is non-negotiable — a bad
plan silently guessed through is the single biggest correctness risk
this flow exists to prevent.

The `--force` escape hatch exists for humans who have evaluated the
findings and decided to proceed anyway. It requires the explicit
argument — the harness never sets it; no default triggers it. Its use
is recorded prominently in the final execution report:

```
WARNING — plan validation FAILED and was overridden with --force.
Outstanding findings from validate-plan:
  - [check N] ...
```

**0b.25. Parallel metadata contract.** If the plan contains a
`## Parallel Execution` section, treat it as executable metadata, not
advisory prose. `validate-plan` check #10 has verified its shape;
`execute-plan` must check the plan-governed parallel use case before
any worker dispatch:

1. Parse `Mode`, `Ownership`, `Barriers`, `Single-Owner Files`, and
   `Parallel Safety Checks`.
2. If `Mode: sequential`, execute the task loop normally and report the
   rationale from the section.
3. If `Mode: parallel`, verify:
   - every lane has a concrete write scope, dependencies, and focused
     verification command;
   - root manifests, lockfiles, shared exports, public contracts,
     migrations, generated files, and other shared surfaces have a
     single owner;
   - contract-producing lanes complete before contract-consuming lanes;
   - overlapping write scopes are either impossible by path/glob shape
     or explicitly assigned to one shared-surface owner;
   - the integration lane owns final root gates and conflict resolution;
   - worker prompts will include the multi-agent coordination warning
     from Phase 2b.
4. If any condition fails, do not silently fall back to unsafe
   parallelism. In interactive mode ask for a plan correction; in
   autonomous mode abort with a `plan-ambiguity` finding that names the
   bad lane or overlapping scope.

If the section is absent, default to sequential execution and report:
`Parallel Execution: absent; using sequential task loop.`

**0b.5. Tool-availability probe.** Between plan validation and workspace
preparation, verify that every command declared in the repo-delivery
`## Commands` schema actually resolves on the executor's PATH. Subagent
shells do not source interactive shell profiles, so toolchains managed
by `nvm`, `fnm`, `pyenv`, `rbenv`, `asdf`, `mise`, or similar must be
on PATH *before* any subagent is spawned or the run will fail opaquely
with "command not found" in a worker that the operator can't inspect.

Probe explicitly — do not rely on the parent shell's PATH:

```bash
command -v "<package_manager>"   # e.g. pnpm, npm, poetry, cargo
command -v "<lint_cmd first token>"
command -v "<build_cmd first token>"
command -v "<test_cmd first token>"
# JS projects only:
command -v node
```

If **any** probe fails, halt with this exact message and stop — do not
attempt to install, do not guess an alternative, do not fall back to a
different tool:

```
Required toolchain missing on PATH.
  Missing: <cmd-a>, <cmd-b>, ...
  Declared in: <repo>/CLAUDE.md ## Commands

Likely cause: node/pnpm/python managed by nvm/fnm/pyenv/asdf and the
PATH modification in your shell profile is not inherited by subagents.

Fix one of:
  1. Run /execute-plan from a shell where `command -v <pm>` succeeds
     AND the harness inherits that PATH. Most reliable: activate the
     toolchain version (e.g. `nvm use`, `pyenv shell <ver>`), then
     re-invoke.
  2. Add the absolute path (e.g. ~/.local/share/pnpm, ~/.nvm/versions/
     node/<ver>/bin) to CLAUDE.md alongside the ## Commands section
     so the executor can set PATH deterministically.
  3. Install the tool system-wide (outside a version manager) so it
     lives on a default PATH.
```

When probes pass, echo a one-line confirmation:
```
Toolchain probe OK: <pm> <pm-version>, node <node-version>, <test-runner>.
```

All subagent Bash invocations from this skill onwards MUST be spawned
via a login shell (`zsh -l -c "<cmd>"` or `bash -l -c "<cmd>"`) so the
same profile that populated PATH at probe time is populated again
inside the worker. Skills that dispatch workers via the Task tool must
surface this requirement in their spawn-context preamble.

**0c. Prepare workspace.** After Phase 0a (schema), Phase 0b (plan
validation), and Phase 0b.5 (tool probe) succeed, establish the branch
and baseline the run will operate on:

1. Read `default_branch` from the repo-delivery `## Commands` schema.
2. **Refuse to run on the default branch.** If
   `git rev-parse --abbrev-ref HEAD` equals `default_branch`, halt:
   ```
   /execute-plan refuses to run directly on the default branch
   (`<default_branch>`). Create a feature branch, or invoke with
   --create-branch to let execute-plan create one for you.
   ```
3. If invoked with `--create-branch`, or if HEAD is detached / in a
   special state, create and switch to a feature branch named
   `execute-plan/<plan-slug>-<YYYYMMDD-HHMM>` off `default_branch`.
   Otherwise, proceed on the current (non-default) branch.
4. Record the current commit SHA as `$EXECUTE_PLAN_BASE_SHA`.
   Every subsequent task commit carries `Base-SHA: <sha>` and
   `Plan-SHA: <plan-sha>` trailers so Phase 3d (plan alignment) and
   Task 3's `--resume` can reconstruct the run.
5. Record the active branch name for the failure-path preservation
   rules below.

#### Failure path — preserve, never destroy

On any unrecoverable failure — retry-budget exhaustion, a worker
refusing to continue, a review-fix spiral that can't converge,
validate-plan refusing mid-stream after `--force`:

1. Tag the last successful commit as
   `execute-plan/abort/<plan-slug>-<YYYYMMDD-HHMM>` so the abort point
   is locatable by name.
2. Leave the working branch intact. Leave the index intact. Do not
   stash, reset, or clean working-tree changes without explicit
   operator intent.
3. Surface:
   ```
   Run aborted. Branch preserved at <branch-name>.
   Last successful commit tagged: execute-plan/abort/<slug>-<timestamp>.
   Resume with: /execute-plan --resume <plan-file>
   ```
4. Exit non-zero so callers (CI, wrapping scripts) can detect abort.

Destructive git operations are **forbidden** in all code paths of this
skill:
- Never `git reset --hard`
- Never `git push --force` (push is out of scope anyway; Task 25's
  dogfood contract is local-only until the full flow is validated)
- Never `git branch -D` / `git branch --delete --force`
- Never `git clean -f` in the working tree
- Never force-overwrite tags

The principle: the caller loses no work on abort. A failed run is a
branch you can inspect, diff, cherry-pick from, or resume. It is never
a silently-discarded state.

### Decision records (cross-execution memory)

Unlike human engineers, LLMs accumulate no organic memory of
decisions defeated along the way. Without a deliberate memory medium,
every execution is knowledge-destroying — the next LLM touching the
same code starts cold and may reverse choices the previous execution
spent effort to make. Decision records fill that gap.

The canonical schema, body sections, index format, write/read
triggers, supersede mechanism, and proliferation guard live in
`_internal/decision-record/SKILL.md`. Read it before producing or
consuming a record. The summary below is a pointer, not a
specification — when these two diverge, the canonical doc wins.

`execute-plan` is the producer. It writes a record at
`docs/decisions/<plan-slug>/<NNNN>-<kebab-slug>.md` on the trigger
events listed in the canonical doc, and updates both
`docs/decisions/INDEX.md` and `docs/decisions/index.json`. Phase 2b
(per-task implementation) is also the read trigger: workers see all
non-superseded records whose `files` glob matches the task's target
set. Workers who silently reverse a non-superseded decision must
raise a `plan-ambiguity` finding citing the decision's `id`.

`/code-review` enforces the proliferation guard (>5 records per task
→ `[minor] too-many-decisions`).

### Retry budget (global circuit breaker)

Local per-phase retries (build: max 3 attempts; test: max 3 attempts;
auto-fix cycles in Phase 2.5 / 3b: max 3 each) prevent obvious loops —
but they don't prevent a task from burning the whole session across
many cheap retries. The global retry budget is the circuit breaker.

#### Values, in order of precedence

1. Command-line: `--max-retries=<N>` / `--max-minutes=<N>`.
2. Repo-delivery `## Commands` `retry_budget:` block:
   ```
   retry_budget:
     max_total_retries: 20
     max_wall_clock_minutes: 60
   ```
3. Defaults: `max_total_retries: 20`, `max_wall_clock_minutes: 60`.

#### Counter semantics

The global retry counter increments on **every**:
- build retry (Phase 2c)
- test retry (Phase 2d)
- auto-fix cycle (Phase 2.5 breakpoint review)
- auto-fix cycle (Phase 3b full-review)

It does **not** increment on:
- successful first-try builds/tests
- phase transitions (e.g., moving from Task 1 → Task 2)
- validate-plan invocations
- review dispatches themselves (only their auto-fix follow-ups)

The wall-clock timer starts at Phase 0c (workspace prep) and runs
through Phase 4 (final report).

#### Exhaustion behaviour

When either budget is hit mid-run:

1. Stop immediately — do not start another retry or advance to the
   next task.
2. Follow the Phase 0c failure path: tag
   `execute-plan/abort/<plan-slug>-<YYYYMMDD-HHMM>`, preserve the
   branch.
3. Surface the exact message:
   ```
   Retry budget exhausted (<N> retries, <M> minutes).
   Aborted at Task <K>.

   Before resuming, diagnose the impasse — invoke `superpowers:systematic-debugging`
   to find the wrong mental model that the retries kept failing against. Repeated
   retries on a stuck task indicate a model mismatch, not a flaky test; another
   retry pass without diagnosis will exhaust the next budget the same way.

   Resume with: /execute-plan --resume <plan-file>
   ```
4. Exit non-zero.

The budget is meant as a circuit breaker, not a deadline. A run that
completes in 55 minutes with 18 retries is normal; a run that spends
60 minutes retrying the same task is stuck and needs a human.

### Resume semantics (`--resume`)

When invoked with `--resume`, `/execute-plan` picks up from the last
completed task of a prior run instead of starting fresh.

#### How resume detects prior state

1. Scan commits on the current branch for `Task N from <plan-file>`
   footers. Every completed task produced one of these in the prior run.
2. **Ignore commits whose subject starts with `review(`** — those are
   auto-fix commits from Phase 2.5 / 3b (see "Auto-fix commits" above),
   not task work. They must not inflate the completed-task count.
3. Extract the set of completed task numbers from the remaining commits.
4. For each task commit, read the `Plan-SHA: <sha>` trailer (written
   by Phase 0c). All task commits in the prior run must share the same
   `Plan-SHA`.

#### Plan-SHA drift refusal

If the current plan file's SHA differs from the `Plan-SHA` recorded in
prior task commits, **refuse to resume**:

```
Plan file has changed since the last run.
  Prior Plan-SHA: <sha-a>  (from commit <abbrev>)
  Current Plan-SHA: <sha-b>

Resuming would mix tasks authored under different plan versions.
Re-run from scratch on a new branch, or revert the plan change.
```

Refuse because the meaning of "Task N" is plan-file-dependent. A
changed plan may reorder, renumber, or reshape tasks, and resuming
blindly would produce a run that conflates two different plans'
intentions.

#### Resume flow

After confirming matching Plan-SHA:

1. Report: `Resuming <plan-file> at Task <N+1>/M. Skipping N completed tasks.`
2. Re-run the last milestone's breakpoint review against the diff
   accumulated so far (the codebase state is whatever survived the
   previous abort; it deserves fresh scrutiny).
3. If the breakpoint review raises any blocking finding, halt and ask
   the operator to disposition before continuing.
4. Proceed into Phase 2 at the next task.
5. Phase 3 (PR-boundary reviews) still runs as normal once all tasks
   complete.

#### Tags and cleanup

Abort tags (`execute-plan/abort/...`) from the prior run are not
deleted automatically — they remain as audit markers. A successful
resume may leave multiple abort tags on the branch; that's fine. The
operator can garbage-collect them manually with `git tag -d` after the
run ships.

### Phase 1: Load Plan

1. If no path argument, find the most recent `.md` in `docs/plans/`.
2. Parse the plan into an ordered task list. Tasks are numbered sections,
   headings, or checklist items.
3. Identify **milestones**: sections explicitly marked `## Milestone:` (or
   `### Milestone:`) in the plan, or a `milestones:` list in the plan's
   frontmatter. If neither exists, treat the end of every top-level `##`
   section as an implicit milestone.
4. Report: `Found N tasks across M milestones in <plan-file>. Starting execution.`
5. **Load Closed Decisions.** If the plan has a `## Closed Decisions`
   section, parse it. Resolve every `@closed-decisions/<category>/<slug>`
   reference by reading
   `<claude-working-root>/closed-decisions/<category>/<slug>.md`, where
   `<claude-working-root>` is the directory containing this
   `execute-plan/` skill (i.e. the library ships with the skill, not
   in the consumer repo). Inline the fragment's bullets into the
   working decision set. Cache the merged set for the whole run.
6. **Load Parallel Execution.** If the plan has a `## Parallel Execution`
   section, parse the mode, ownership lanes, barriers, single-owner
   files, and safety checklist into a lane registry. This registry
   governs task scheduling. Do not re-optimize the plan during
   execution; if the registry is wrong, halt as a plan ambiguity or
   deviation and require the plan to be corrected.
7. **Load Waves.** If the plan has a `## Waves` section and/or
   `## --- WAVE N START ---` markers in the body, parse the wave
   table into a wave registry: for each wave, capture its task range,
   focus, and execution mode (`sequential` or `parallel`). The wave
   registry composes with the lane registry — lanes describe *which
   tasks can fan out*, waves describe *when in the plan that fan-out
   happens*. If wave markers and the wave table disagree on task
   ranges, halt as a `plan-ambiguity`. If no `## Waves` section
   exists, treat the entire plan as a single sequential wave.

### Phase 1.1: Parallel lane readiness

When a lane registry exists:

1. Build a task-to-lane map from the `Ownership` table.
2. Build a single-owner map from `Single-Owner Files`.
3. For each lane, compute its target file set from the lane write
   scope plus the task descriptions.
4. Reject `parallel` mode if two lanes may write the same file/glob and
   that overlap is not owned by exactly one lane.
5. Reject `parallel` mode if a lane depends on a task or barrier that
   is not defined in the plan.
6. **Refuse ≥5 parallel teams in a single wave.** If `Mode: parallel`
   and the wave's lane count is greater than 4, halt with a
   `plan-ambiguity` finding:
   ```
   Wave <N> declares <K> parallel lanes; max is 4.
   Coordination overhead dominates beyond 4 concurrent teams.
   Split into sequential parallel waves (e.g. Wave <N> with 3 lanes,
   Wave <N+1> with the rest).
   ```
   In interactive mode, ask the operator to fix the plan; in
   autonomous mode, abort via the Phase 0c failure path.
7. **Refuse undersized lanes.** If any lane owns fewer than 3 tasks,
   warn but do not halt — a single-task lane is usually a sign the
   plan would be cleaner sequential, but is not unsafe.
8. Report the chosen mode:
   ```
   Parallel Execution: <mode> — <rationale>
   Lanes: <lane-a>, <lane-b>, ...
   Barriers: <barrier-a>, ...
   Waves: <wave-count> (<sequential | mixed | all-parallel>)
   ```

Treat conservative uncertainty about file overlap as a reason to pause
or abort, not as permission to guess.

### Phase 1.4: Closed Decisions are tablestakes

Before each task's implementation (Phase 2b), pass the merged Closed
Decisions set to the implementing worker with this directive, verbatim:

> These are tablestakes. Do not propose alternatives, do not deliberate,
> do not surface them as ambiguity. Execute as stated. If a task's own
> spec contradicts a closed decision, raise a `plan-deviation` finding
> (see code-review/references/controller-guide.md) and halt — do not attempt to reconcile.

Closed decisions pre-empt Phase 1.5 ambiguity categories 2
(existing-state) and 3 (scope-boundary). If an ambiguity would have
fired but a closed decision disambiguates it, do not pause — the
closed decision is the resolution.

#### Template-copy fast path

If a task's spec is shaped *"scaffold from `templates/<name>/`"* (a
common pattern for project setup — framework scaffolding, boilerplate),
execute runs the copy as a one-shot:

1. Verify `templates/<name>/` exists (per the closed decision naming it).
2. Copy its contents into the destination under git.
3. Commit with the normal Task N footer.
4. Move on.

No codebase exploration, no design-it-twice, no ambiguity checks during
the copy task itself. Setup drift — historically ~20% of initial project
bugs — is eliminated by refusing to think about choices that were
already made.

### Phase 1.5: Pre-execution clarification (codebase-aware)

**This is NOT a re-validation of the plan.** `/validate-plan` (Phase 0b)
has already passed — the plan's structure, acceptance criteria, and
closed decisions are fine. Phase 1.5 is a separate, codebase-aware gate
that fires only when the plan, *read against the actual repo state*,
has more than one reasonable execution. It cannot run until the repo is
present, which is why it happens here and not inside `/validate-plan`.

When Phase 1.5 pauses, surface it with this framing so the operator
does not read it as "the plan is bad":

```
Plan validation: PASS (Phase 0b).
Pre-execution clarification needed:
  <N> point(s) in the plan map to more than one thing in this codebase.
  The plan itself is fine — I need you to pick a referent before I
  start coding, so I don't silently guess wrong.
```

Never phrase Phase 1.5 output as "the plan tasks are not atomic" or
"the plan has problems" — that contradicts the verdict that just passed
and is the single biggest UX defect this flow has shipped.

The executor must distinguish **ambiguity** (→ pause or abort) from
**uncertainty** (→ try). An ambiguity is a point where the plan has
more than one reasonable reading *given the repo* and picking silently
would produce code that might not match the author's intent. The
heuristic:

> Would a human reading the plan and seeing what I'm about to do say
> *"yes, that's obviously what I meant"*? If yes, proceed. If no, pause.

#### Three categories that count as ambiguity

1. **Referent ambiguity** — the plan names a thing and the repo has
   more than one candidate. *"Modify the user service"* when
   `src/services/user.ts`, `src/api/user/controller.ts`, and
   `src/models/user.ts` all plausibly fit.
2. **Existing-state ambiguity** — the plan prescribes an addition and
   the repo already has something overlapping. *"Add a rate limiter"*
   when IP-level throttling is already present; add-on, replace, or
   stack are all defensible.
3. **Scope-boundary ambiguity** — the plan prescribes a change and the
   change's natural boundary crosses something the plan didn't mention.
   *"Refactor the auth middleware into a service class"* when the
   middleware calls a helper in a sibling module and is hooked by a
   logger.

#### What is NOT ambiguity (proceed, do not pause)

- *"I don't know how to implement this."* That's an executor-skill
  issue; try.
- *"There's a better way than the plan specifies."* That's scope
  discipline; follow the plan, log a `minor` finding.
- General uncertainty about outcomes — not the same as the plan having
  multiple reasonable readings.

#### Behaviour by mode

Governed by the `--interactive=<yes|no|auto>` argument (default `auto`):

| Mode | TTY? | Behaviour on ambiguity |
|---|---|---|
| `yes` | — | Pause, print the question, read a one-line answer. Record as `Clarification: <question>: <answer>` in the commit trailer. |
| `no` | — | Abort cleanly. Log the question in the final report's `## Open Questions` section. Resume (Task 3 of the hardening plan, when landed) can continue once the plan is updated. |
| `auto` | yes | Behave as `yes`. |
| `auto` | no | Behave as `no`. |

Record every ambiguity — answered or aborted — as a `plan-ambiguity`
finding in the final report.

### Phase 2: Per-Task Loop

For each task in order:

#### 2a. Read requirements
Read the task description. Understand what files to create/modify and what
behavior is expected.

#### 2b. Implement
Follow the plan exactly. Do not add unplanned features, refactors, or
"improvements."

If `Parallel Execution` mode is `parallel` and the active user request
and runtime policy permit subagents, dispatch only currently unblocked
lanes whose write scopes are disjoint under the lane registry. Keep the
immediate blocking task on the main critical path; delegate sidecar
lanes that can run without blocking the next local step.

Every worker prompt must include:

> You are not alone in the codebase. Own only the assigned write scope,
> do not revert edits made by others, and adjust your implementation to
> accommodate changes from other lanes. If your task requires editing a
> file outside your write scope, stop and report the needed scope change.

Workers must run their lane's focused verification before returning and
list changed paths. The main executor waits at declared barriers,
integrates lane results, then runs the task or milestone gates required
by the plan. If subagents are not permitted, execute the same lanes
locally in dependency order while preserving single-owner boundaries.

#### 2c. Build
Run the `build` command from the repo-delivery schema (see
`_internal/repo-delivery` — the `## Commands` section of the repo's
`CLAUDE.md` is the only source).
- If build fails: diagnose, fix, retry (max 3 attempts).
- If still failing: stop and report.

If `runtime_probes` are declared in the repo-delivery schema, run them
after build. These probes catch runtime/native dependency failures that
typecheck-only builds miss (native bindings against the wrong Node ABI,
generated clients that fail to load, missing drivers). Treat probe
failures like build failures: diagnose, fix, retry within the same
3-attempt budget, and report the exact probe that failed if it cannot
be fixed.

#### 2d. Test — task's verifiable acceptance is the done-signal

The task's `verify:` frontmatter or Acceptance block (validated to be
mechanical per `validate-plan` check #4) IS the definition of "done"
for this task. Treat it as TDD:

1. If the criterion names a test that doesn't yet exist, **write the
   test first** (failing) before any implementation change. This proves
   the test exercises the expected behaviour.
2. Implement until every bullet in the acceptance block passes (each
   test exits 0, each `grep`/`test` one-liner exits 0, each observable
   reaches its stated value).
3. Then run the repo's full `test` command from the repo-delivery
   schema. Framework- and language-level tests must also pass; the
   task-level criterion is the *primary* gate but not the *only* gate.

- If task-level acceptance fails: diagnose, fix, retry (max 3 attempts).
- If the framework `test` command fails: diagnose, fix, retry (max 3 attempts).
- If still failing: stop and report.

#### 2e. Commit
Create a commit referencing the plan task. Task commits use the
standard `<type>(<scope>)` conventional form with a trailing
**Task footer**:

```
<type>(<scope>): <description>

<optional body>

Task N from <plan-file>
Plan-SHA: <sha>
Base-SHA: <sha>
```

The `Task N from <plan-file>` footer is reserved for this commit
class. Auto-fix commits (Phase 2.5 / 3b) never use it — they use a
distinct template (see "Auto-fix commits" below) so task progress and
review-fix progress are unambiguously distinguishable.

#### Auto-fix commits (Phase 2.5 / Phase 3b)

When a review phase's auto-fix cycle produces a code change, commit it
separately from the task work using this template:

```
review(<profile>): fix <finding-id> — <short summary>

Milestone-K or PR-boundary review auto-fix.
Plan-SHA: <sha>
Finding: <file>:<line> — <severity> <domain>
```

`<profile>` is `breakpoint` for Phase 2.5, `full` for Phase 3b. The
commit subject's `review(` prefix is the grep-able discriminator
between auto-fix work and task work.

**Never** include the `Task N from <plan-file>` footer in an auto-fix
commit — that footer is the marker `--resume` uses to count completed
tasks (see "Resume semantics"). Auto-fix commits may appear between
task commits; they must not be counted as task progress.

Commit after each successful auto-fix cycle, not batched per phase.
A finding that required three fix cycles before passing review
produces three `review(...)` commits, each referencing the same
`<finding-id>` but with a different subject summary.

#### 2f. Milestone check
If this task completes a milestone, proceed to Phase 2.5 before moving on.
Otherwise, continue to the next task.

#### 2f-bis. Wave barrier check
If this task is the last task in a wave (per the wave registry from
Phase 1, step 7), enforce a hard barrier before starting the next
wave's first task:

1. If the completed wave was `parallel`, wait for every lane in the
   wave to report DONE. Integrate any cross-lane review findings
   from the milestone breakpoint review (Phase 2.5) before crossing
   the barrier.
2. Re-run the repo's full `test` and `build` commands at the wave
   boundary even if no milestone fell on this task. Wave barriers
   are integration points; cross them silently and you'll discover
   the merge issue four tasks later, far from the cause.
3. If the next wave is `parallel`, re-validate Phase 1.1 against the
   current repo state — a previous wave may have introduced files
   that change the single-owner picture. Treat any new conflict the
   same way as Phase 1.1's initial check.
4. Report:
   ```
   Wave <K>/<W>: COMPLETE — <focus>
   Wave barrier: build PASS, tests PASS
   Next: Wave <K+1>/<W> (<mode>) — <focus>
   ```

Waves nest *inside* the task loop — they do not replace milestones.
A wave may contain 0–many milestones; both fire when their conditions
are met.

### Phase 2.7: Wave dispatch mechanics (parallel waves)

When a wave's mode is `parallel` and it has ≥2 lanes, the lanes do
**not** run in the main checkout. They run in isolated git worktrees
with a fresh subagent per lane, then merge sequentially under the
rules in Phase 2.8. Sequential waves skip Phase 2.7 entirely and
execute in-place via the normal Phase 2 task loop.

The mechanics below are the only safe way to fan out: shared-checkout
parallelism would force every lane to race the same index and produce
non-deterministic merge artefacts.

#### 2.7a. Worktree preparation

(Background on the worktree-isolation pattern itself: `superpowers:using-git-worktrees`. The mechanics below implement the same isolation, plus the install / single-message dispatch / cleanup specifics for wave execution.)

For each lane in the wave:

1. Create a worktree at `.worktrees/<plan-slug>-<lane-id>/` off
   `default_branch` on a new branch named
   `feat/<plan-slug>-<lane-id>`:
   ```
   git worktree add .worktrees/<plan-slug>-<lane-id> \
     -b feat/<plan-slug>-<lane-id> <default_branch>
   ```
2. Run `{install_cmd}` from the repo-delivery `## Commands` schema
   inside the worktree. **This is not optional.** Subagents do not
   inherit the parent's `node_modules` / `target/` / virtualenv;
   skipping install reliably produces "command not found" or stale
   bindings inside the worker.
3. Record `<base-sha>` per lane (the SHA the worktree was created
   from) so the reviewer subagent's `{DIFF_RANGE}` resolves.

If any worktree creation or install fails, halt the wave via the
Phase 0c failure path. Do not attempt to dispatch lanes on a partial
worktree set.

#### 2.7b. Single-message dispatch

Dispatch all lane implementers in **one** message. Sequential
dispatch silently kills concurrency — the fan-out is an illusion;
each lane waits on the previous to return.

For each lane, build an implementer prompt from the template at
`<skill-root>/execute-plan/agents/implementer.md` (or the
override path declared in the consumer repo's `CLAUDE.md ## Commands`
under `team_agents.implementer`). Substitute every placeholder; use
**absolute paths** throughout — subagents have zero project context
and relative paths resolve unpredictably inside their shell.

Then send a single message containing one Task / Agent invocation
per lane.

#### 2.7c. Per-lane review and fix

When all implementers return, dispatch reviewers — also in a single
message — using the template at
`<skill-root>/execute-plan/agents/reviewer.md` (override:
`team_agents.reviewer`).

For each lane whose reviewer returns `FAIL` or `WARN` with `critical`
or `major` findings, dispatch a **fresh** fixer subagent using
`<skill-root>/execute-plan/agents/fixer.md` (override:
`team_agents.fixer`). Pass the findings and target files in the
prompt — never assume a prior subagent can be resumed; subagent state
is not durable across dispatches.

Each fixer pass increments the global retry counter. The 3-cycle
auto-fix limit from Phase 2.5 applies per finding inside the lane:
after 3 fixer cycles without resolution, the finding's status moves
to `open` (and blocks the wave verdict unless `--accept-risk=<id>`
was supplied).

#### 2.7d. Model selection (default)

Lane subagents run on the following defaults; override via
`team_agents.<role>_model` in the repo-delivery schema if needed.

| Role | Default model | Rationale |
|---|---|---|
| Implementer (well-specified plan) | sonnet | Plan provides complete code; speed matters |
| Implementer (architectural lane) | opus | Novel design judgment required |
| Reviewer | sonnet | Checklist-driven, well-defined criteria |
| Fixer | sonnet | Targeted change against named finding |

The "architectural lane" trigger: a lane whose plan section contains
unresolved design choices the plan didn't pre-commit (no closed
decision applies, no template-copy fast path, no prescriptive code
block). In practice this is rare in plans that have passed
`/validate-plan`; sonnet is the right default.

### Phase 2.8: Sequential merge after a parallel wave

After every lane in a parallel wave reaches reviewer `PASS` (or
`WARN` with no `critical`/`major`), the wave's branches merge into
`default_branch` **sequentially**. Concurrent merges produce
non-deterministic conflict resolution and defeat the integration
test.

#### 2.8a. Merge order rules

Apply in order; the first matching rule decides:

1. **Dependency provider first.** A lane that produces shared types,
   generated clients, schemas, or migrations consumed by another lane
   merges before its consumers. The lane registry's `Barriers` and
   `Single-Owner Files` describe this graph.
2. **Infrastructure before dependents.** Config, build setup, CI, and
   manifest changes merge before lanes that depend on them at
   runtime.
3. **Smallest diff as tiebreaker.** When no dependency relation
   applies, the lane with the smallest diff merges first — fewer
   subsequent rebase conflict surfaces.

#### 2.8b. Merge sequence

For each lane in merge order:

1. Push the lane's branch:
   ```
   git -C .worktrees/<plan-slug>-<lane-id> push -u origin feat/<plan-slug>-<lane-id>
   ```
2. Open a PR (or merge locally if push is out of scope per the
   repo's policy).
3. Merge into `default_branch`. Use the repo's standard merge
   strategy from `## Commands` (default: merge commit; if the schema
   declares `merge_strategy: rebase|squash`, honour it).
4. In the main checkout, pull the merged `default_branch`.
5. **For every still-unmerged lane**, rebase its branch onto the
   updated `default_branch`:
   ```
   cd .worktrees/<plan-slug>-<other-lane-id>
   git fetch origin <default_branch>
   git rebase origin/<default_branch>
   git push --force-with-lease origin feat/<plan-slug>-<other-lane-id>
   ```
   Use `--force-with-lease`, never `--force`. The rebase may produce
   conflicts; the lane that introduces them must resolve them in its
   worktree before its own merge step.
6. Run the repo's full `build` and `test` commands on the updated
   `default_branch` after each merge. A regression caught immediately
   localises the cause; caught after all merges, you've lost the
   bisection bound.

#### 2.8c. Worktree cleanup

After all lanes merge and the wave-barrier integration test
(Phase 2f-bis step 2) passes, remove the per-lane worktrees:

```
git worktree remove .worktrees/<plan-slug>-<lane-id>
```

Do not delete the lane branches — they remain as audit history. The
operator garbage-collects them after the run ships.

#### 2.8d. Failure during merge

If any merge or rebase fails irrecoverably, follow the Phase 0c
failure path: tag the last successful commit on `default_branch`,
preserve every lane's worktree and branch intact, surface the abort
message. **Do not** force-resolve conflicts, do not abandon a lane's
work, do not `git reset --hard`.

#### 2g. Report
```
Task N/M: DONE — <brief summary>
  Files: <list>
  Commit: <sha>
```

If a task fails after retries:
```
Task N/M: BLOCKED — <failure description>
```
Stop execution.

### Phase 2.5: Breakpoint Review (at each milestone)

Invoke the `code-review` skill with `profile: breakpoint` against the diff
accumulated since the last milestone (or since `$EXECUTE_PLAN_BASE_SHA`
for the first milestone).

```
Milestone K/M: <name> — running breakpoint review
```

For each finding, assign a disposition status from the vocabulary in
`_internal/disposition/SKILL.md`:

- **critical / major**: auto-fix, then rebuild, retest, re-review.
  Max 3 cycles per finding. On success, set status → `fixed`.
  After 3 cycles without resolution, set status → `open` (blocks the
  verdict unless the operator supplies `--accept-risk=<id>`, which
  sets status → `accepted-risk` with audit logging).
- **minor / nit**: status → `open` by default; record for the
  PR-level report, do not auto-fix.
- **plan-ambiguity** / **plan-deviation**: not auto-fixed; handled per
  Phase 1.5 (ambiguity) / Phase 3d (deviation). The operator
  dispositions these explicitly as `disagree-with-evidence`, `defer`,
  or `accepted-risk`.

If any `critical` or `major` finding remains with status `open` after
the auto-fix attempts (and no `--accept-risk` was supplied), halt
milestone progress and surface the findings. Otherwise, resume the
per-task loop.

Every finding carries exactly one status end-of-phase. `open` is not a
valid end-state at Phase 4 — it must have been resolved (`fixed`),
disputed (`disagree-with-evidence`), deferred (`defer`), or accepted
(`accepted-risk`) by the end of the run.

### Phase 3: PR Boundary Reviews

After all tasks and milestones are complete, run the PR-level review stack.
This always runs at the PR boundary regardless of how many milestones fired.

#### 3a. Checkpoint
Invoke `/checkpoint` (lint, build, test) as the final quality gate. If it
fails, stop and report.

#### Phase 3 preamble: compute the effective diff + shared manifest

**Effective diff (exclusions).** Before triage or review dispatch,
compute the *effective* diff by excluding two path patterns from the
raw `git diff $EXECUTE_PLAN_BASE_SHA..HEAD`:

1. **The plan file itself.** If `/execute-plan` marked tasks as done
   in the plan during the run (or the plan was otherwise edited),
   those changes must not appear as review-scoped diff hunks — they
   are execution bookkeeping, not product code.
2. **`docs/decisions/<plan-slug>/` tree.** Decision records written
   this run (Task 14) are meta-artefacts about the execution. They
   explain choices; reviewers should not be asked to review them as
   if they were product code.

The effective diff is what `/checkpoint`, `/code-review`,
`/code-review-professional`, and `/review-adversarial` operate on.

Phase 3d (Plan alignment check) still reads the original plan
**directly from the plan file** — not from the effective diff — so
task-list reconciliation works regardless of in-run plan edits.

**Shared manifest.** Produce a single `diff_manifest` describing the
effective diff (not the raw diff). The canonical schema, field
reference, and producer/consumer contracts live in
`_internal/diff-manifest/SKILL.md` — read it before producing the
manifest.

Always set `schema_version: 1`. Bump only on breaking changes (and
update the canonical schema doc in the same commit).

Pass the same manifest to `code-review` (in 3b) and
`code-review-professional` (in 3c). Both accept `diff_manifest` and,
when provided, skip their own internal clustering step — they use the
clusters, languages, and `touches` flags already computed. This
guarantees component boundaries match across reports.

`review-adversarial` (3e) does not currently consume `diff_manifest`;
it receives the diff and `pr_description` only.

When either consumer is invoked **directly** (not via execute-plan),
`diff_manifest` is absent and each consumer falls back to its own
internal triage — no behavioural change for external users.

##### Intent / `pr_description` synthesis

Three downstream review skills (`code-review`,
`code-review-professional`, `review-adversarial`) accept an optional
`pr_description` input. The Phase 3 preamble synthesises one and
passes it to all three, so reviewers have a consistent framing of
*what this change is trying to achieve*.

Source of truth, in precedence:

1. **Plan frontmatter `intent:` field** — if the plan's frontmatter
   carries an `intent:` string, use it verbatim. Plans authored by
   `/plan` will typically populate this.
2. **Synthesised from the plan** — otherwise, build the intent from:
   - the plan's H1 title,
   - the first non-blank paragraph of the plan body,
   - a one-line summary of completed tasks (`Completed tasks: 1–N out
     of M. Milestones: K.`).

The synthesised version is good enough for reviewer framing — they
review the code against the intent, not the intent itself (that's
`/prd-validate`'s job upstream).

Pass the resulting `pr_description` string identically to 3b, 3c, and
3e. The three reviewers don't need to reach consensus on intent;
that's already resolved.

#### 3b. Full code review
Invoke `code-review` with `profile: full` against the cumulative diff
(`git diff $EXECUTE_PLAN_BASE_SHA..HEAD`) **and the shared
`diff_manifest`** from the Phase 3 preamble.

For each finding, assign a disposition status per
`_internal/disposition/SKILL.md` (same vocabulary as Phase 2.5):

- **critical / major**: auto-fix → rebuild → retest → re-review
  (max 3 cycles). Success → `fixed`. Failure → `open`, unless
  `--accept-risk=<id>` was supplied, in which case → `accepted-risk`.
- **minor / nit**: status → `open`; record for report, no auto-fix.
- **plan-ambiguity / plan-deviation**: require explicit disposition
  (`disagree-with-evidence` / `defer` / `accepted-risk`); never
  auto-fixed.

Same end-state rule as Phase 2.5: `open` is invalid at Phase 4. Every
finding ends the run with exactly one terminal status.

#### 3c. Professional review (craft grading)
Invoke `code-review-professional` against the cumulative diff **and the
shared `diff_manifest` from the Phase 3 preamble.** The skill uses the
manifest's `clusters` as its component boundaries — this guarantees
3b and 3c report on the same components.

Collect the per-component grades and overall read. Do not auto-fix
from the professional review — it's a judgment, not a defect list.
Grades go straight to the report.

#### 3d. Plan alignment check
1. Re-read the original plan.
2. Compare against the cumulative diff.
3. Verify: all tasks implemented, implementation matches spec, no
   unplanned additions.
4. Record gaps as **`plan-deviation`** findings (not `major`) — see
   `code-review/references/controller-guide.md` for the severity definition. Plan-deviations
   are not auto-fixed; each requires a terminal disposition.

##### Proof accounting

Green tests are not the same as proved behaviour. After plan alignment,
classify each task's acceptance criteria against the diff:

| Classification | Meaning |
|---|---|
| `proved` | A test in the diff exercises the behaviour AND passed in Phase 3a. |
| `partially-proved` | Some coverage exists (existing or new) but at least one acceptance bullet is unverified by a test that actually runs the new code. |
| `unproved` | No test in the diff or pre-existing suite exercises the behaviour; the criterion was satisfied only by inspection or by a build/typecheck signal. |

Procedure:

1. For each completed task, list its acceptance bullets.
2. For each bullet, locate the test or observable that proves it. A
   bullet is `proved` only when:
   - the test file appears in the effective diff or is named explicitly
     in the bullet, AND
   - that test executes the modified code path (not a stub, not a
     mock-only assertion against unchanged code), AND
   - it passed in Phase 3a's `test` run.
3. Bullets satisfied only by `grep`/typecheck/build observables are
   `partially-proved` unless the criterion is itself purely structural
   (e.g. "file X exists", "export Y is present").
4. Bullets with no corresponding artefact are `unproved`.

Emit a proof-accounting table in the markdown report and a
`proof_accounting` array in the JSON report (see schemas below). The
classification does **not** alter the verdict by itself, but any
`unproved` row in the final report is grounds for the postmortem to
fire (Phase 5) and is reported in the WARN summary line. A run with
≥1 `unproved` row may still PASS if the operator deems the gap
acceptable; the table makes that decision auditable rather than
implicit.

Why `plan-deviation` and not `major`: unplanned changes are often
legitimate (a dep-patch-bump to unblock the build, a formatter
reformat). Treating them as `major` blocks every run; treating them
as `plan-deviation` with a disposition vocabulary lets the operator
separate real scope creep from mechanical necessity.

##### Auto-accept vs halt — disposition rules

**Process all deviations before halting.** Evaluate every deviation
against the rules below and record its outcome (disposition + rationale,
or "unmatched — would halt"). Only after every deviation has been
evaluated do you decide the overall run's fate: if any deviation is
unmatched in autonomous mode, halt. This way the operator sees the
complete deviation list in the abort report — not just the first one —
and can resume with a single set of `--accept-risk` flags rather than
paying an abort cycle per deviation.

For each deviation, apply these rules in order:

1. **`--accept-risk=<id>` supplied for this finding** → status
   `accepted-risk`. Record rationale (the operator's intent) in the
   report. Always available — works in interactive and autonomous
   modes.

2. **The deviation matches a category in `auto_accept_deviations`**
   (read from the repo-delivery schema; defaults
   `[lockfile, dep-patch-bump, formatter, auto-generated-files]` —
   `auto-generated-files` is a no-op unless the repo also declares
   `auto_generated_paths`):
   - Auto-disposition as `disagree-with-evidence` with rationale
     `category: <matched-category>`.
   - Write a decision record (Task 14) under
     `docs/decisions/<plan-slug>/` so the auto-disposition is
     auditable. The record's `Context` cites the category; the
     `Reasoning` is the category rule; `Rejected alternatives` is empty
     by construction (there was no choice).
   - Proceed.

3. **No rule matches** and `--interactive=no` (autonomous/batch):
   **halt** via the Phase 0c failure path. The operator resumes by
   re-running with `--accept-risk=<id>` or by editing the plan to
   include the deviation as a planned change.

4. **No rule matches** and `--interactive=yes` (TTY): pause and ask
   the operator: *"Plan-deviation <id>: <summary>. Accept, defer, or
   dispute? (a/d/p)"*. Record the answer as the disposition and the
   operator's one-line rationale in a commit trailer.

##### Category definitions

These are the canonical definitions the executor applies when
matching against `auto_accept_deviations`:

- **lockfile** — changes only to
  `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `Cargo.lock` /
  `go.sum` / `poetry.lock` / `Pipfile.lock` / equivalent. A diff
  touching *only* these files (plus its manifest counterpart when the
  manifest change is itself `dep-patch-bump`) qualifies.

- **dep-patch-bump** — changes to a dependency's version string in
  `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` /
  equivalent, where both the major and minor components are unchanged
  and only the patch component changed (semver `x.y.Z` → `x.y.Z'`).
  Major or minor bumps do **not** qualify.

- **formatter** — changes that alter only whitespace, newlines, or
  quote style with no AST-level semantic difference. If you're unsure
  whether a change is semantic, it does NOT qualify. When in doubt,
  halt.

- **auto-generated-files** — changes entirely within paths matching
  `auto_generated_paths` from the repo-delivery schema. Requires the
  repo to have opted in by declaring the paths.

Each plan-deviation gets its own row in the findings table. The
`## Plan Deviations` section in the final report groups them for
audit visibility. Dispositioned deviations count as WARN; `open`
deviations count as FAIL.

#### 3e. Adversarial review (flag-driven)

Governed by the `--adversarial=<auto|always|never|ask>` argument (see
Arguments). Default is `auto`.

Decision table:

| Flag value | Behaviour |
|---|---|
| `auto` (default) | Fire if diff ≥200 lines OR diff touches an `adversarial_triggers` path. Otherwise skip silently. |
| `always` | Fire unconditionally. |
| `never` | Skip. No prompt, no invocation. |
| `ask` | Prompt the user interactively (legacy behaviour — only when a human is supervising). |

When firing, invoke `/review-adversarial` against the cumulative diff,
passing the shared `pr_description` from the Phase 3 preamble as its
`intent` input so reviewers frame their adversarial challenge against
the same stated goal as 3b/3c. Append its output to the final report.

When skipping under `auto`, record the reason (`diff below threshold`,
`no trigger paths touched`) in the report so the decision is auditable.

### Phase 4: Final Report

Write the run artefacts:

- `execution-report.md` — human-facing markdown report (see format below).
- `execution-report.json` — structured counterpart for CI and
  downstream tooling.
- `disposition-log.md` — multi-round reviewer↔coder disposition
  history (only when `--run-folder` is active; see below).

Paths are configurable via `--report-path=<dir>`; default is the
current working directory. The `.md` and `.json` always land together —
never one without the other.

#### Run-folder bundling (`--run-folder`)

When `--run-folder` resolves to a path (either `auto` with `runs_root:`
declared in the repo-delivery schema, or an explicit path), write all
run artefacts into a single timestamped folder instead of into the
current working directory:

```
<run-folder>/
  execution-report.md
  execution-report.json
  disposition-log.md
  postmortem.md          # only if Phase 5 fires
```

In run-folder mode, Phase 4 also emits `disposition-log.md` recording
every review round per finding (Phase 2.5 and Phase 3b auto-fix
cycles), using this structure:

```
## Finding F-001 — major — src/auth/session.ts:42

### Round 1
- **Reviewer note:** ...
- **Auto-fix attempt:** commit <sha>
- **Outcome:** still failing — assertion mismatch

### Round 2
- **Reviewer note:** ...
- **Auto-fix attempt:** commit <sha>
- **Outcome:** fixed; re-review passed

**Final status:** fixed
```

The disposition log is a per-finding narrative; the `findings` table
in the main report is the flat summary. Both are produced in run-folder
mode; only the flat table is produced in legacy mode.

When `--run-folder=off` (or `auto` with no `runs_root:`), behaviour is
identical to prior versions: only the two report files are written, at
`--report-path`.

#### Gate state (four-state vocabulary)

In addition to the markdown verdict (`PASS`/`WARN`/`FAIL`), the JSON
report carries a `gate_state` field that distinguishes mechanical
blocks from human-decision blocks. CI and automation should route on
`gate_state`; humans read `verdict`.

| `gate_state` | Meaning | Maps to |
|---|---|---|
| `completed` | All findings terminally dispositioned, no accepted risk | PASS |
| `completed-with-accepted-risk` | One or more `accepted-risk` dispositions present | PASS or WARN |
| `blocked` | Run halted on retry budget, persistent failure, or `open` critical/major after auto-fix exhaustion | FAIL |
| `awaiting-human-decision` | Run completed but a finding requires explicit human arbitration (e.g. adversarial vs. code-review contradiction on the same line) | FAIL |

#### JSON schema

```json
{
  "verdict": "PASS",
  "plan_file": "docs/plans/<plan-slug>.md",
  "plan_sha": "<plan file sha at Phase 0c>",
  "base_sha": "<EXECUTE_PLAN_BASE_SHA>",
  "head_sha": "<git rev-parse HEAD>",
  "branch": "<branch name>",
  "mode": "auto | yes | no",
  "tasks": [
    {
      "id": 1,
      "description": "...",
      "status": "DONE | BLOCKED",
      "commit": "<sha>",
      "files": ["..."]
    }
  ],
  "milestones": [
    {
      "id": 1,
      "name": "...",
      "breakpoint_review": {
        "findings": [ { "id": "F-001", "severity": "...", "status": "..." } ]
      }
    }
  ],
  "findings": [
    {
      "id": "F-001",
      "severity": "critical | major | minor | nit | plan-ambiguity | plan-deviation",
      "file": "path/to/file",
      "line": 42,
      "summary": "...",
      "status": "open | fixed | disagree-with-evidence | defer | accepted-risk | resolved",
      "rationale": "..."
    }
  ],
  "grades": {
    "components": [
      { "name": "backend", "grade": "senior", "axes": { "clarity": "senior", "...": "..." } }
    ],
    "overall_read": "..."
  },
  "retry_stats": {
    "total_retries": 0,
    "wall_clock_minutes": 0,
    "budget_used_fraction": 0.0
  },
  "adversarial": {
    "status": "ran | skipped | failed",
    "reason": "...",
    "verdict": "PASS | CONTESTED | REJECT | null",
    "findings": []
  },
  "open_questions": [
    { "task": 3, "question": "...", "raised_at_phase": "1.5" }
  ],
  "decisions_written": [
    { "id": "20260419-0042", "path": "docs/decisions/<plan-slug>/0042-...md", "tags": ["..."], "files": ["..."] }
  ],
  "gate_state": "completed | completed-with-accepted-risk | blocked | awaiting-human-decision",
  "proof_accounting": [
    {
      "task": 1,
      "criterion": "GET /users/:id returns 404 for unknown id",
      "classification": "proved",
      "evidence": "src/api/user.test.ts:88 (added in this run)"
    }
  ],
  "postmortem": {
    "status": "ran | skipped",
    "reason": "...",
    "path": "<run-folder>/postmortem.md"
  }
}
```

Rules:
- `verdict` uses the same vocabulary as the markdown verdict line
  (`PASS` / `WARN` / `FAIL`).
- `open_questions` is populated only when batch mode aborts on
  ambiguity (Phase 1.5 `--interactive=no` path).
- `decisions_written` lists every record produced this run; empty
  array if none qualified under the filter rule.
- `adversarial.status` is `skipped` in `auto` mode when no CLI or
  thresholds not met; `ran` when invoked; `failed` only when explicit
  invocation (`--adversarial=always` or direct) couldn't proceed.
- `findings` consolidates across Phase 2.5 breakpoint and Phase 3b
  full review; each has a unique `id`.

#### Markdown report

```
## Execution Report

**Plan:** <plan-file>
**Tasks:** N/N completed across M milestones

### Per-Task Summary
| # | Description | Commit | Files | Status |
|---|---|---|---|---|
| 1 | ... | abc1234 | 3 | DONE |

### Breakpoint Reviews

Each row shows counts by severity, with disposition statuses
(`fixed / open / disagree-with-evidence / defer / accepted-risk`)
broken out. See `_internal/disposition/SKILL.md` for the vocabulary.

| Milestone | Severity | Count | Status breakdown |
|---|---|---|---|
| 1: <name> | Critical | 0 | — |
| 1: <name> | Major | 1 | fixed: 1 |
| 1: <name> | Minor | 2 | open: 2 |

### PR Reviews

**Full code review (profile: full):**

| Severity | Count | Status breakdown |
|---|---|---|
| Critical | N | fixed: N · accepted-risk: N · open: N |
| Major | N | fixed: N · accepted-risk: N |
| Minor | N | open: N · defer: N |
| Nits | N | open: N |
| plan-ambiguity | N | disagree-with-evidence: N · defer: N |
| plan-deviation | N | accepted-risk: N · disagree-with-evidence: N |

**Findings table (full detail):**

| ID | Severity | File:Line | Summary | Status |
|---|---|---|---|---|
| F-001 | major | src/foo.ts:42 | ... | fixed |
| F-002 | minor | src/bar.ts:17 | ... | open |

**Professional review (craft grading):**
| Component | Grade | Notes |
|---|---|---|
| Backend (src/api/, src/services/) | senior | ... |
| UI (src/web/) | junior | ... |

Overall read: <one paragraph>

**Plan alignment:**
- All tasks implemented: YES/NO
- Unplanned changes: NONE / [list]

**Proof accounting:**

| Task | Acceptance criterion | Classification | Evidence |
|---|---|---|---|
| 1 | GET /users/:id returns 404 | proved | src/api/user.test.ts:88 |
| 2 | Rate limit kicks in at 100 req/min | unproved | no test exercises throttle path |

### Plan Deviations

Dedicated section for `plan-deviation` findings from Phase 3d. Each
must have a terminal disposition; `open` is invalid at Phase 4.

| ID | File:Line | Summary | Disposition | Rationale |
|---|---|---|---|---|
| D-001 | package.json:15 | Bumped `drizzle-orm` to unblock build | disagree-with-evidence | Plan Task 3 says "use Drizzle"; version bump was implicit. |
| D-002 | src/utils/date.ts (new) | Extracted `formatAge` helper | defer | Not in plan; tracked as follow-up #142. |

**Plan Ambiguities** (from Phase 1.5 / validate-plan):

Same structure — ambiguities that surfaced during execution, each with
its resolution recorded in a commit trailer (`Clarification: ...`)
or, in batch mode, as an open question the operator must close before
re-running.

**Adversarial review:** [summary if run, or "declined"]

### Checkpoint
- Lint: PASS/FAIL
- Build: PASS/FAIL
- Tests: PASS/FAIL

### Verdict: PASS / WARN / FAIL

[If PASS]: Ready to ship.
[If WARN]: Review minor findings before shipping.
[If FAIL]: Fix listed issues before shipping.
```

Verdict rules (apply the disposition rubric in
`_internal/disposition/SKILL.md`; `open` is not a valid end-state):

- **PASS** — all tasks done; every critical/major finding is `fixed`
  or `accepted-risk`; only `minor`/`nit`/`plan-deviation`/`plan-ambiguity`
  findings may remain (in terminal statuses); checkpoint passes; plan
  aligned.
- **WARN** — all tasks done; some `minor` / `nit` findings remain in
  terminal status (`open`, `defer`, `disagree-with-evidence`); any
  `plan-deviation` findings have a terminal disposition
  (`disagree-with-evidence`, `defer`, or `accepted-risk`); no
  blocking criticals/majors; checkpoint passes.
- **FAIL** — any `critical` or `major` finding ends `open`;
  any `plan-deviation` or `plan-ambiguity` ends `open` (these
  severities demand explicit disposition); checkpoint fails; or
  plan alignment has undispositioned gaps.

Plan-deviations that are terminally dispositioned (including
`accepted-risk` via `--accept-risk`) do **not** push the verdict to
FAIL. They count as WARN.

The professional grade does **not** affect the verdict. A `junior`-graded
component still PASSes if it's bug-free. The grade is informational — the
team decides what to do with it.

### Phase 5: Postmortem

Governed by two flags:

- `--postmortem=<auto|always|never>` — *whether* Phase 5 fires (default `auto`)
- `--postmortem-mode=<auto|full|lightweight>` — *which depth* the postmortem uses (default `auto`)

#### Trigger rules

`auto` fires Phase 5 when **any** of the following is true:

- final `verdict` is `WARN` or `FAIL`,
- `gate_state` is `blocked` or `awaiting-human-decision`,
- retry budget exhaustion was hit (Phase 0c circuit breaker),
- any `unproved` row exists in the proof-accounting table,
- any auto-fix cycle required all 3 attempts (signals fragile fix),
- any `plan-deviation` ended with status `accepted-risk` (signals plan
  drift that should inform the next run).

`always` fires unconditionally — useful when learning is the goal.
`never` skips even on FAIL.

When skipping, record the reason in `postmortem.status` / `reason`.

#### Mode selection

`--postmortem-mode=auto` resolves as:

- **lightweight** when the trigger is a `PASS` with `unproved` rows or
  fragile auto-fix only (no verdict failure, no blocked gate). Three
  sections: `What happened`, `What broke down`, `Recommendations`.
- **full** for every other trigger: WARN, FAIL, blocked,
  awaiting-human-decision, retry-budget exhaustion, accepted-risk
  plan-deviations.

`full` and `lightweight` override the auto resolution.

#### Inputs

Postmortem reads (does not regenerate) the artefacts produced this run:

- `execution-report.md` and `.json`
- `disposition-log.md` (when present)
- the original plan file
- the source requirements artefact, if known to `execute-prd`

#### Output

Write `postmortem.md` and `postmortem.json` adjacent to the execution
report (in the run folder when `--run-folder` is active, otherwise at
`--report-path`). The `.json` is what the cross-run aggregator and
`/process-tune` consume.

#### Markdown structure (full mode)

```
# Postmortem

## Run reference
- **Plan:** <plan-file>
- **Verdict:** <verdict>  Gate: <gate_state>
- **Branch / base / head:** ...
- **Trigger:** <which auto rule fired, or "--postmortem=always">
- **Mode:** full | lightweight

## What happened
<2–4 sentence narrative — not a chat transcript, not a restatement
of findings.>

## What worked
<Process strengths observed: which gates caught what, which auto-fix
cycles converged cleanly, where the closed decisions saved time.>

## What broke down

### Tool and skill usage
<Which gates fired or didn't fire, and whether that was correct.
Threshold issues (e.g. adversarial review missed a 187-line auth diff
because the threshold is 200). Skills invoked at the wrong time, or
not invoked when they should have been. Repo-delivery flags or
`adversarial_triggers` paths that need tuning.>

### Requirements fit
<Ambiguity in the source PRD/AERS that drove rework. Plan-deviations
or plan-ambiguities whose root cause was an unsettled product
decision. Closed decisions that should have existed but didn't.
aers-readiness rubric items that the source missed.>

## What the process missed
<Gaps only visible in hindsight. Coverage holes (link to `unproved`
rows). Reviewer blind spots. Plan structure that hid risk.>

## Recommendations
<Specific, actionable. Each recommendation MUST cite a target from
the taxonomy below so the recommendation can aggregate across runs.
Free-text recommendations that don't aggregate are a bug.>

| # | Target | Type | Summary |
|---|---|---|---|
| 1 | `_internal/disposition` | tune-threshold | Disposition loop allowed 3 cycles where 2 would have caught the same fix |
| 2 | `closed-decisions/auth/session-cookie-name` | new-decision | Session cookie name was re-debated this run; capture as closed decision |
```

In `lightweight` mode, omit `What worked` and the two named lenses.
The remaining shape is `What happened` → `What broke down` (free
form) → `Recommendations` (still structured).

#### Recommendation taxonomy

Every recommendation row in the markdown table corresponds to a
structured object in `postmortem.json`. The `target` and `type` fields
use a fixed vocabulary so cross-run aggregation works.

**`target` vocabulary** (where the recommendation lands):

| `target` value | What it points at |
|---|---|
| `_internal/disposition` | The disposition rubric |
| `_internal/repo-delivery` | The repo-delivery contract / `## Commands` schema |
| `_internal/<other>` | Any other rubric in the skill library |
| `closed-decisions/<category>/<slug>` | A new or updated closed decision fragment |
| `claude-md/commands` | The repo's `CLAUDE.md ## Commands` section |
| `claude-md/conventions` | The repo's `CLAUDE.md` conventions section |
| `adversarial-triggers` | The `adversarial_triggers` glob list |
| `auto-accept-deviations` | The `auto_accept_deviations` category list |
| `plan-template` | The plan author's template (drives `/plan` and `/execute-prd` step 5) |
| `aers-readiness` | The AERS readiness rubric |
| `execute-plan-skill` | This skill's own behaviour (gates, phases, defaults) |
| `execute-prd-skill` | The `/execute-prd` skill's behaviour |
| `code-review-profile` | A `code-review` profile (`breakpoint` or `full`) |
| `process-doc/<name>` | Any project-level process doc not covered above |

If a recommendation genuinely doesn't fit, use `target: other` and put
the intent in `summary` — but treat that as a smell, not a release
valve. Repeated `other` values are a sign the taxonomy needs an entry.

**`type` vocabulary** (what kind of change):

| `type` value | Meaning |
|---|---|
| `tune-threshold` | Numeric threshold needs adjustment (line counts, retry counts, timeouts) |
| `tune-trigger` | A glob, signal, or condition that controls when something fires |
| `new-decision` | Add a closed decision capturing a settled fact |
| `update-decision` | Modify an existing closed decision |
| `new-convention` | Add a project convention to CLAUDE.md |
| `add-rubric-rule` | Extend an existing rubric with a new rule |
| `tighten-gate` | Make an existing gate stricter |
| `relax-gate` | Make an existing gate less strict (rare; needs evidence) |
| `add-gate` | Introduce a new gate or phase |
| `remove-gate` | Remove a gate that produces no signal |
| `improve-prompt` | Reword an instruction passed to a worker or reviewer |
| `documentation` | The skill or process is correct but the docs don't reflect reality |

#### JSON schema (postmortem.json)

```json
{
  "run": "2026-05-05-143000",
  "plan_file": "docs/plans/<plan-slug>.md",
  "verdict": "WARN",
  "gate_state": "completed-with-accepted-risk",
  "trigger": "unproved-rows",
  "mode": "full",
  "recommendations": [
    {
      "id": "R-001",
      "target": "adversarial-triggers",
      "type": "tune-threshold",
      "summary": "Adversarial threshold of 200 lines missed a 187-line auth diff",
      "evidence": "execution-report.json#findings.F-014",
      "actionable": true,
      "confidence": "high"
    }
  ],
  "headline": "<one-line summary, copied from the highest-confidence actionable recommendation>"
}
```

`actionable: true` means a future skill could mechanically apply the
change. `confidence: high|medium|low` lets `/process-tune` weight
recurring recommendations.

#### Cross-run aggregation

After writing `postmortem.md` and `postmortem.json`, append a row to
the project-level postmortem index:

- **Path:** `docs/postmortems/index.json` (relative to the repo root,
  not the run folder).
- **Append, never rewrite.** The index is an event log; old rows are
  immutable evidence even if the recommendation later proved wrong.
- **Schema:**
  ```json
  [
    {
      "run": "2026-05-05-143000",
      "run_folder": "docs/runs/2026-05-05-143000/",
      "plan_slug": "<plan-slug>",
      "verdict": "WARN",
      "gate_state": "completed-with-accepted-risk",
      "trigger": "unproved-rows",
      "recommendations": [
        {
          "id": "R-001",
          "target": "adversarial-triggers",
          "type": "tune-threshold",
          "summary": "...",
          "actionable": true,
          "confidence": "high"
        }
      ]
    }
  ]
  ```

If `docs/postmortems/index.json` does not exist, create it as `[]`
before appending. Do not gate on the directory existing — create it.

`/process-tune` (the symmetric consumer skill) reads this index,
groups by `target` + `type`, and proposes concrete artefact edits when
the same recommendation appears across multiple runs.

#### Hard rules

- **Not a second requirements document.** Do not restate scope.
- **Not a chat-transcript summary.** No turn-by-turn replay.
- **Not a restatement of review findings.** Findings are in the
  execution report; postmortem analyses *the process around them*.
- **Not a blame document.** No "the model should have known" framing.
- **Length cap:** target one page (full mode) or half a page
  (lightweight). A long postmortem signals the run itself was
  unrecoverable and the next action is human review, not a longer
  document.
- **Recommendations must use the taxonomy.** Free-text targets that
  bypass the `target`/`type` vocabulary defeat aggregation. If the
  taxonomy doesn't fit, the taxonomy needs extending — not bypassing.

#### Terminal output

After Phase 5 writes its artefacts, append to the executor's terminal
output:

```
Postmortem: <run-folder>/postmortem.md  (mode: <mode>)
Key recommendation: <postmortem.headline>
```

The headline is the single most actionable item from
`postmortem.json.recommendations` (highest `confidence`, `actionable:
true`, ties broken by recommendation order). The operator gets the
takeaway without opening the doc; the index keeps the long tail.

The postmortem is the only artefact in the flow whose audience is the
*next run*, not this one.

## Key Rules

- **Validate before executing.** Phase 0 is not optional.
- **Follow the plan exactly.** No unplanned features, refactors, or "improvements."
- **Stop on persistent failure.** After 3 retries, stop and report rather than spiraling.
- **Breakpoint reviews are light; PR reviews are thorough.** Breakpoint uses `profile: breakpoint` (security/correctness/tests). PR uses `profile: full` (all 11 domains) plus the professional grade.
- **Adversarial review is flag-driven.** Governed by `--adversarial` (default `auto`). Autonomous runs never pause to ask; interactive supervisors can opt in with `--adversarial=ask`.
- **Commits reference the plan.** Every commit ties back to a task number. Commit trailers carry `Plan-SHA` and `Base-SHA` so the run is fully reconstructable.
- **Never destroy work on failure.** Abort preserves the branch and tags the last good commit as `execute-plan/abort/...`. Destructive git ops (`reset --hard`, `push --force`, `branch -D`, `clean -f`) are forbidden in all code paths.
- **Green tests are not proof.** Phase 3d emits a proof-accounting table classifying every acceptance bullet as `proved` / `partially-proved` / `unproved`. The classification is auditable evidence, not a verdict modifier.
- **Postmortems are for the next run, not this one.** Phase 5 fires automatically on `WARN`/`FAIL`/blocked/unproved coverage. It analyses *process*, not scope or findings, and is capped at one page.
- **Waves are integration barriers.** When a plan declares `## Waves`, every wave boundary forces a full build + test re-run, even if no milestone fell there. Max 4 parallel lanes per wave; 5+ lanes refuse with a `plan-ambiguity`.
- **Parallel waves run in worktrees, not the main checkout.** Phase 2.7 dispatches one implementer subagent per lane in a `.worktrees/<plan-slug>-<lane-id>/` checkout off `default_branch`. `{install_cmd}` runs inside every worktree before any subagent dispatches — subagents do not inherit the parent's `node_modules`/virtualenv.
- **Single-message dispatch is mandatory for parallel waves.** All lane implementers (and later, all lane reviewers) dispatch in **one** message. Sequential dispatch produces sequential execution disguised as parallel; the fan-out is illusory.
- **Never resume a prior subagent.** Each fixer pass is a fresh dispatch with the findings and target files in its prompt. Subagent state is not durable across calls; assuming it is silently drops fix attempts.
- **Sequential merge after parallel waves.** Parallel-wave branches merge to `default_branch` one at a time per Phase 2.8: dependency-provider first, infrastructure before dependents, smallest-diff tiebreaker. Downstream lanes rebase with `--force-with-lease` (never `--force`) onto the updated `default_branch` after each merge. Build + test re-runs on `default_branch` after every merge.

## Contract

- **Inputs:** path to a plan file, plus optional flags (`--force`, `--adversarial=<auto|always|never|ask>`, `--run-folder`, `--postmortem`, `--postmortem-mode`, etc.). Calls `/validate-plan` (mandatory, Phase 0b), `/checkpoint` (mandatory, final task), `/code-review` (breakpoint and full), `/code-review-professional` (PR boundary), `/review-adversarial` (per `--adversarial`), `_internal/repo-delivery`, `_internal/disposition`, `_internal/diff-manifest` (producer), `_internal/security-quick-check` (per its trigger criteria).
- **Preconditions:** plan file exists; CLAUDE.md `## Commands` section per `_internal/repo-delivery`; toolchain on PATH; not on default branch (Phase 0b.5); when `--adversarial=always`, an opposite-model CLI is reachable.
- **Outputs:** completed-task markers per task, decision records under `docs/decisions/<plan-slug>/` (schema in `_internal/decision-record`), `diff_manifest` produced at Phase 3 preamble (schema in `_internal/diff-manifest`), execution report (`execution-report.md`/`.json`), optional `postmortem.md`, optional run folder bundle.
- **Postconditions:** all plan tasks have completed-markers OR explicit unproved/blocked entries; `Plan-SHA` and `Base-SHA` appear on every commit; on failure, branch preserved and tagged `execute-plan/abort/...`; never destructive on failure.
- **Failure modes:** Phase 0a/0b gate fail → halt; `/validate-plan` FAIL → refuse unless `--force` (logged prominently); plan-ambiguity / overlapping write scopes → halt; retry budget exhaustion (3 retries) → stop and report; subagent dispatch failure in parallel wave → fix-loop with fresh dispatch (never resume); destructive git ops forbidden in all paths.
