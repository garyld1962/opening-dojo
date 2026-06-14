---
name: diff-manifest
description: "Canonical schema for the `diff_manifest` object passed by `/execute-plan` to `/code-review` and `/code-review-professional`. Defines clusters, language tagging, and `touches` flags so the producer and all consumers agree on shape. Not user-invokable."
user-invocable: false
internal: true
kind: reference
---

# diff_manifest schema

Canonical definition of the `diff_manifest` object. The producer
(`/execute-plan` Phase 3 preamble) and the consumers (`/code-review`,
`/code-review-professional`, `/review-adversarial`) all reference this
schema so changes stay in lockstep.

## Schema (current: `1`)

```json
{
  "schema_version": 1,
  "base_sha": "<EXECUTE_PLAN_BASE_SHA>",
  "head_sha": "<git rev-parse HEAD>",
  "files": [
    {
      "path": "src/api/auth.ts",
      "language": "typescript",
      "lines_added": 42,
      "lines_removed": 7,
      "touches": ["public-surface", "persistence", "auth"]
    }
  ],
  "clusters": [
    { "id": "backend", "paths": ["src/api/**", "src/services/**"] },
    { "id": "ui",      "paths": ["src/web/**"] },
    { "id": "db",      "paths": ["migrations/**", "src/db/**"] }
  ],
  "languages": { "typescript": 7, "sql": 2, "markdown": 1 },
  "touches": {
    "persistence": true,
    "public_surface": true,
    "concurrency": false,
    "auth": true,
    "dependencies": false
  }
}
```

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | integer | yes | Currently `1`. Consumers MUST fail closed on unknown versions (fall back to internal triage and log a warning). |
| `base_sha` | string | yes | The merge-base or pre-execution SHA. The "before" side of the effective diff. |
| `head_sha` | string | yes | `git rev-parse HEAD` at the time the manifest was produced. |
| `files[]` | array | yes | One entry per changed file in the **effective** diff (excluding plan/decision-record meta-edits — see "Effective diff" below). |
| `files[].path` | string | yes | Repo-relative path. |
| `files[].language` | string | yes | Lowercase language tag (`typescript`, `python`, `sql`, `markdown`, `yaml`, `json`, etc.). Use `unknown` if undetectable. |
| `files[].lines_added` | integer | yes | From `git diff --numstat`. |
| `files[].lines_removed` | integer | yes | From `git diff --numstat`. |
| `files[].touches` | string[] | yes | Subset of: `public-surface`, `persistence`, `concurrency`, `auth`, `dependencies`. Empty array if none apply. |
| `clusters[]` | array | yes | One entry per logical component cluster discovered in the diff. |
| `clusters[].id` | string | yes | Stable identifier (e.g. `backend`, `ui`, `db`). Lowercase, kebab-case. |
| `clusters[].paths` | string[] | yes | Glob patterns covering the cluster's files. |
| `languages` | object | yes | Map of language → file count. Counts the same files as `files[]`. |
| `touches` | object | yes | Aggregate of any-file `touches` flags. Booleans for the five categories. |

## Effective diff

The manifest describes the **effective diff**, not the raw `git diff`.
Excluded from `files[]`:

1. **Plan file edits.** If the plan was edited mid-run, those hunks
   are execution bookkeeping, not product code.
2. **Decision-record tree.** Files under `docs/decisions/<plan-slug>/`
   are meta-artefacts; reviewers should not be asked to review them
   as if they were product code.

## Producer contract

`/execute-plan` Phase 3 preamble produces one manifest per review
cycle. It is passed identically to `/code-review` and
`/code-review-professional`. `/review-adversarial` does not currently
consume `diff_manifest` (it receives the diff and `pr_description`
only); if a future change makes it a consumer, list it here and bump
no version (additive).

## Consumer contract

When `diff_manifest` is **provided**:

- Consumers MUST use `clusters` as the component boundaries — do not
  re-cluster the diff.
- Consumers MUST use `touches` flags as authoritative — do not
  recompute persistence/auth/etc. detection.
- Consumers MUST validate `schema_version`. Unknown version → log a
  warning and fall back to internal triage as if no manifest was
  provided.

When `diff_manifest` is **absent** (direct invocation of a consumer
skill):

- The consumer falls back to its own internal triage step.
- Reports remain valid but cluster IDs may not match other consumers'.

## Versioning

Bump `schema_version` on any breaking change (field renames, removals,
type changes). Additive changes (new optional fields) do not require a
bump but should be documented here.

## Where this schema is referenced

- `/execute-plan` — producer (Phase 3 preamble)
- `/code-review` — consumer
- `/code-review-professional` — consumer

## Contract

- **Inputs:** none — this is a reference document, not an invokable skill.
- **Preconditions:** N/A.
- **Outputs:** the schema definition above; consumers and producers cite
  it by name (`_internal/diff-manifest`).
- **Postconditions:** N/A.
- **Failure modes:** N/A. Schema drift is detected at consumer side via
  `schema_version` validation.
