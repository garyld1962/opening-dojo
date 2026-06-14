---
name: validate-plan
description: "Lightweight readiness gate for a plan file: checks structure, task discreteness, acceptance criteria, milestones, and forbidden placeholders."
---

# /validate-plan — Plan Readiness Gate

**Purpose:** Verify a plan file is structurally ready for execution. Fail
fast with actionable errors. This is a lightweight gate, not a deep
critique — it catches mechanical problems that would cause `execute-plan`
to behave unpredictably.

## When to Use

- Before invoking `/execute-plan` (called automatically by execute-plan's Phase 0).
- When you want to check a plan draft is ready to hand off.

## Arguments

- `<path>` — path to the plan file (optional; if omitted, finds the most recent `.md` in `docs/plans/`).

## What it checks

Run every check below and collect failures. Do not stop at the first failure —
report all failures at once so the author can fix them in one pass.

### 1. Plan file exists and is readable

- File path resolves, is a `.md` file, and is non-empty.
- **Fail:** `Plan file not found at <path>.`

### 2. Plan has a title

- If the file starts with a YAML frontmatter block (a `---` line
  followed by more content and a closing `---` line), skip past it.
- The first non-blank line **after** any frontmatter block is an H1
  (`# ...`).
- **Fail:** `Plan has no H1 title (after optional YAML frontmatter).`

### 3. Plan has discrete tasks

- Plan contains numbered tasks, headed sections, or a task checklist.
  Recognized patterns:
  - `## Task N:` or `### Task N:` headings
  - Numbered list at the top level (`1.`, `2.`, ...)
  - Checkbox list (`- [ ] ...`)
- At least 1 task.
- **Fail:** `Plan has no discrete tasks. Use '## Task N:' headings, a numbered list, or a checkbox list.`

### 4. Each task has verifiable acceptance criteria

Every task must declare acceptance in a form that can be checked
mechanically — not interpretive prose. An acceptance criterion passes
check #4 when it is expressible as one of:

- **a concrete test file/case** to author or invoke
  (e.g., `tests/validate-plan.test.ts :: rejects prose-only acceptance`)
- **a shell command that exits 0 on success**
  (e.g., `grep -q 'pattern' path/to/file`)
- **an observable state**
  (e.g., `test -f path/to/new/file`, `curl returns HTTP 200`,
   `metric X ≥ threshold`)
- **a schema or type check**
  (e.g., `jq -e '.field' config.json`, `tsc --noEmit passes`)

Task-level frontmatter may declare `verify:` directly (preferred; used
by the sibling `/plan` skill). Absent frontmatter, the task's
`**Acceptance:**` section is parsed.

**Passing example** ✓

```markdown
**Acceptance:** all of the following shell checks exit 0.
- grep -q 'adversarial_triggers' claude-working/execute-plan/SKILL.md
- test -f claude-working/closed-decisions/stacks/nextjs-app-router.md
```

**Failing example** ✗

```markdown
**Acceptance:**
- Validation has been added.
- Errors are handled correctly.
- The CLI behaves sensibly.
```

Prose-only bullets ("validation added", "handled correctly", "behaves
sensibly") are interpretive — the executor cannot tell when they're
satisfied. Rewrite each as a concrete test/command/observable.

- **Fail:** `Task N has no verifiable acceptance criteria. Each bullet
  must be a test file/case, a shell command (exit 0), an observable
  state, or a schema check. See examples in validate-plan/SKILL.md §4.`
  (One failure per offending task, up to 5 listed.)

See `plan-execute-boundary.md` §3 for the pre-ship smoke test that
verifies `/plan`-authored plans pass this check without modification.

### 5. Milestones are marked (or plan is flat)

A plan may either:
- Mark milestones explicitly with `## Milestone:` or `### Milestone:` headings, or a `milestones:` list in frontmatter.
- Be flat — every top-level `##` section is treated as an implicit milestone by execute-plan.

Both are acceptable. Only fail if the plan **mixes** explicit milestones with orphaned tasks that aren't under any milestone.
- **Fail:** `Plan uses explicit milestones but tasks N, M are outside any milestone section.`

### 6. No forbidden placeholders

Scan for patterns that suggest the plan isn't ready:
- `TBD`, `TODO`, `???`, `FIXME` (case-insensitive, whole word)
- Empty headings (e.g., `### ` with nothing after it)
- `[placeholder]`, `<fill in>`, `TK` (in tech-writing sense)

- **Fail:** `Plan contains N placeholder(s): TBD on line 42, TODO on line 78.` (List up to 10 with line numbers.)

### 7. No ambiguous verbs in task titles

Task titles should describe an outcome, not an intention. This check
flags **only** the following closed list of weasel openers at the start
of a task title (case-insensitive, whole-word):

- `Consider`
- `Maybe`
- `Possibly`
- `Look into`
- `Investigate whether`
- `Explore`
- `Think about`

No other verbs are flagged. The intent is to catch signalled-
tentativeness (*"Consider adding X"*) without false-positives on
ordinary outcome-shaped titles.

- **Fail:** `Task N title uses an ambiguous opener ("<verb> X"). Rewrite as a concrete outcome ("Add X", "Extract X", "Remove X").`

**Check #8 — removed.**

Check #8 previously verified that file references in the plan resolved
to existing parent directories. Removed per Task 17 of
`claude-working-hardening.md`: too many false positives on greenfield
plans and template-copy tasks where the referenced directory is
intentionally created during execution. The numbering is preserved
(check #9 stays #9) so cross-references in existing plans and tests
remain stable.

### 9. Closed Decisions are well-formed (if present)

If the plan has a `## Closed Decisions` section, each entry must be one
of the two permitted forms:

- **Inline decision:** `**Key:** one-line value. Source: <source>.`
  The bullet starts with a bold key, contains a single sentence value,
  and names a source. Use this for repo-specific or plan-specific
  closed decisions that don't belong in the shared library.
- **Library reference:** `@closed-decisions/<category>/<slug>`
  Resolves to a fragment file in the skill's own library at
  `<claude-working-root>/closed-decisions/<category>/<slug>.md`,
  where `<claude-working-root>` is the directory containing this
  `validate-plan/` skill — **not** a path in the consumer repo.
  The library is part of the skill package; consumer repos do not
  ship their own `closed-decisions/` trees.

Prose paragraphs, multi-sentence values, or bullets without a bold key
or source fail the check.

Additionally:

- Every `@closed-decisions/...` reference must resolve to an existing
  fragment file.
- A closed decision must not contradict any task's acceptance criteria
  (e.g., closed decision *"Vitest only"* but a task's acceptance
  invokes `jest`). Contradictions raise a `plan-ambiguity` finding
  (see Refuse contract) with both locations cited.

**Fail (format):** `Closed Decision on line N is prose, not the bullet
format. Rewrite as "**Key:** value. Source: ...".`

**Fail (reference):** `Closed Decision references
@closed-decisions/<path> but fragment file does not exist at
claude-working/closed-decisions/<path>.md.`

**Fail (contradiction):** `[plan-ambiguity] Closed Decision
"<key>" contradicts Task N acceptance on line M. Reconcile before
re-running.`

See `claude-working/closed-decisions/` for the seed library.

### 10. Parallel Execution section is well-formed (if present)

Plans authored by `/execute-prd` include a `## Parallel Execution`
section. Older or hand-written plans may omit it; omission is not a
validation failure. If the section is present, validate the shape so
`/execute-plan` can rely on it instead of re-planning concurrency.

Required elements when the section is present:

- A mode line exactly shaped as `**Mode:** parallel` or
  `**Mode:** sequential`.
- A `### Ownership` table with these headers:
  `Lane`, `Agent type`, `Tasks`, `Write scope`,
  `Shared-surface owner`, `Dependencies`, `Verification`.
- A `### Barriers` section. For `parallel` mode it must contain at
  least one table row after the header; for `sequential` mode it may
  state `none`.
- A `### Single-Owner Files` section naming root manifests, lockfiles,
  shared exports, public contracts, migrations, or generated files
  that multiple tasks might otherwise edit.
- A `### Parallel Safety Checks` checklist.

For `parallel` mode, the checklist must include entries covering:

- Disjoint write scopes or explicit owner for overlap.
- Shared/public contracts produced before consumers.
- Focused verification per lane.
- Integration lane owns final root gates.
- Worker prompts include multi-agent coordination warning.

**Fail (mode):** `Parallel Execution section missing **Mode:** line.
Expected exactly **Mode:** parallel or **Mode:** sequential.`

**Fail (ownership):** `Parallel Execution Ownership table missing
required headers. Expected: Lane, Agent type, Tasks, Write scope,
Shared-surface owner, Dependencies, Verification.`

**Fail (barriers):** `Parallel Execution mode is parallel but Barriers
section has no rows. Add at least one barrier or downgrade Mode to
sequential.`

**Fail (safety):** `Parallel Execution Safety Checks missing required
entries: <list>.`

## Output

### If all checks pass:

```
Plan validation: PASS

Plan: <path>
Tasks: N
Milestones: M (explicit | implicit)

Ready for execution.
```

### If any check fails:

```
Plan validation: FAIL

Plan: <path>

Errors (N):
- [check 3] Plan has no discrete tasks. Use '## Task N:' headings...
- [check 4] Task 2 has no acceptance criteria.
- [check 6] Plan contains 3 placeholder(s): TBD on line 42, TODO on line 78, ??? on line 94.

Fix the above and re-run /validate-plan.
```

Return a machine-readable verdict as the final line:
```
VERDICT: PASS
```
or
```
VERDICT: FAIL
```

`execute-plan` keys off that final line.

## Refuse contract

A `VERDICT: FAIL` from this skill causes `/execute-plan` Phase 0b to
**refuse to execute**. This refusal is non-negotiable except via the
explicit human-only `--force` override (see
`execute-plan/SKILL.md` Phase 0b). The contract is the teeth behind
the guiding principle that bad plans are refused up front, not guessed
through at execution time.

## Emitting `plan-ambiguity` findings

In addition to the structural checks above, this skill may emit
`plan-ambiguity` findings when the plan is well-formed structurally
but has a reading-level ambiguity that the executor cannot safely
resolve. Examples:

- Two acceptance criteria contradict each other.
- A task references a concept or artefact not defined earlier in the plan.
- A closed decision (Task 9 primitive) contradicts a task-level acceptance.

`plan-ambiguity` findings block validation (they cause `VERDICT: FAIL`)
with a distinct message class so the author can address them separately
from structural issues:

```
- [plan-ambiguity] Task 3 acceptance invokes `jest` but Closed Decision
  "Testing" names Vitest only. Reconcile before re-running.
```

See the ambiguity taxonomy in `execute-plan/SKILL.md` Phase 1.5 for the
three ambiguity categories.

## What this skill does NOT do

- Does not critique the plan's strategy, task ordering, or technical approach.
- Does not estimate scope or effort.
- Does not rewrite the plan or propose fixes beyond the error messages.
- Does not run any code or touch the repository.

Those are separate concerns. This skill only answers: *is the plan
structurally ready for `execute-plan` to consume?*

## Contract

- **Inputs:** path to a plan file (markdown with YAML frontmatter).
- **Preconditions:** plan file exists and is readable.
- **Outputs:** `VERDICT: PASS | WARN | FAIL` with a check-by-check breakdown (frontmatter shape, task discreteness, acceptance criteria, milestones, forbidden placeholders, parallel-execution shape if present, etc.); structured findings caller can act on.
- **Postconditions:** caller (`/execute-plan` Phase 0b, `/execute-prd` step 7) decides whether to proceed (`PASS`), warn (`WARN`), or fix (`FAIL`).
- **Failure modes:** plan file unreadable → `FAIL` with a file-access finding; plan present but parses inconsistently → `FAIL` with a `plan-ambiguity` finding; this skill never edits the plan — it only reports.
