---
name: decision-record
description: "Canonical schema for decision records written under `docs/decisions/<plan-slug>/`. Every skill that writes or reads decision records cites this contract: file path, frontmatter, body sections, write triggers, read triggers, supersede mechanism, and the proliferation filter. Not user-invokable."
user-invocable: false
internal: true
kind: reference
---

# Decision record schema

LLMs accumulate no organic memory of decisions defeated along the way.
Decision records are the deliberate memory medium that prevents the
next LLM from reversing choices the previous one fought to make. Every
producer and consumer of decision records cites this schema so the
shape stays stable.

## File path

```
docs/decisions/<plan-slug>/<NNNN>-<kebab-slug>.md
```

- `<plan-slug>` — the executing plan's `slug` frontmatter field.
- `<NNNN>` — zero-padded sequence number within that plan-slug
  (`0001`, `0042`).
- `<kebab-slug>` — short imperative title:
  `0042-route-validation-at-controller`.

## Frontmatter (required)

```yaml
---
id: YYYYMMDD-NNNN
plan: <plan-slug>
task: <task-id>
date: YYYY-MM-DD
files:
  - path/to/affected/file.ts
  - path/to/glob/**
tags: [routing, validation, ...]
supersedes: null           # or the id of the decision this replaces
superseded_by: null        # set when a later decision replaces this
---
```

## Body sections (required, in order)

1. **Context** — what the executor was doing; what the plan said.
2. **Decision** — what was chosen, stated as a complete imperative.
3. **Reasoning** — why; cite the options considered.
4. **Rejected alternatives** — each option considered with a one-line
   rejection reason.
5. **Consequences** — downstream effects. What now becomes easier,
   what becomes harder.
6. **Revisit if** — named triggers under which this decision should
   be reconsidered.

## Index artefacts

Two files under `docs/decisions/`, updated atomically whenever a
record is written or superseded:

- **`docs/decisions/INDEX.md`** — human-facing markdown with file
  globs → decision IDs.
- **`docs/decisions/index.json`** — machine-queryable counterpart:

```json
[
  {
    "id": "20260419-0042",
    "files": ["src/services/auth.ts", "src/api/user/**"],
    "tags": ["routing", "validation"],
    "supersedes": null,
    "superseded_by": null,
    "path": "docs/decisions/user-validation-march/0042-controller-layer.md"
  }
]
```

## Write triggers

Producers write a record on these events:

- A `plan-ambiguity` is resolved (interactive or operator-resumed).
- A `plan-deviation` is dispositioned — the disposition and its
  rationale.
- A non-trivial design call the plan didn't prescribe is made: API
  shape, pattern choice, layer placement, library selection, state
  machine, concurrency model, etc.

### Filter rule (prevent noise)

Write a record ONLY when a reasonable future LLM, seeing only the
code, could plausibly reverse the choice. Forced, trivial, or
fully-plan-prescribed choices do NOT get records. If in doubt, err
toward not writing; the index is noise when it records every comma.

## Read trigger

At the start of each task's implementation, before any worker
dispatch:

1. Compute the task's target file set from the plan.
2. Query `docs/decisions/index.json` for records where any `files`
   entry matches a target file (glob match).
3. Filter out records with `superseded_by != null`.
4. Read each matching record's full content.
5. Include them in the implementing worker's context with the
   directive: *"These decisions govern files you're about to modify.
   Do not reverse a non-superseded decision without raising a
   `plan-ambiguity` finding that cites the decision's ID. Workers who
   silently reverse prior decisions undo effort and introduce drift."*

## Supersede mechanism

When a new decision contradicts an existing one:

1. Write the new record as normal.
2. Set the new record's `supersedes:` to the prior record's `id`.
3. Edit the prior record's frontmatter: `superseded_by: <new id>`.
4. Update both `INDEX.md` and `index.json` to reflect the new state.

Never delete a superseded record — keep the history. The read trigger
filters them out automatically.

## Proliferation guard

The primary defence is the filter rule above. The backstop is in
`/code-review`: if a single task produces more than 5 records,
`/code-review` emits a `[minor] too-many-decisions` finding pointing
the reviewer at the consolidation question.

## Producers and consumers

- **Producer:** `/execute-plan` (writes records on the trigger events
  above).
- **Consumer (read trigger):** `/execute-plan` (Phase 2b worker
  dispatch).
- **Consumer (proliferation guard):** `/code-review` (counts records
  per task).
- **Consumer (postmortem):** `/postmortem` and `/process-tune` may
  reference records when analysing process drift.

## Contract

- **Inputs:** none — this is a reference document, not an invokable skill.
- **Preconditions:** N/A.
- **Outputs:** the schema and protocol above; cited by name
  (`_internal/decision-record`).
- **Postconditions:** N/A.
- **Failure modes:** N/A. Schema drift is detected by code review (if
  records on disk diverge from this schema, the review surfaces it as
  a documentation finding).
