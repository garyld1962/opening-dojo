---
source: ad-hoc
slug: closed-decisions-sample
intent: >
  Positive fixture for Task 9 — Closed Decisions. This plan declares a
  library-backed `## Closed Decisions` section and a single template-copy
  task. validate-plan must PASS; execute-plan must run Task 1 as a
  template-copy fast path without codebase exploration.
verify: |
  claude-working/validate-plan against this file returns VERDICT: PASS
  with no plan-ambiguity findings. The execute-plan template-copy fast
  path triggers on Task 1.
---

# closed-decisions-sample — positive fixture

Tiny plan used to exercise Task 9's Closed Decisions primitive and the
template-copy fast path. Not a real deliverable; it exists so the Task 9
acceptance checks in `claude-working-hardening.md` can verify end-to-end
that the primitive works.

## Closed Decisions

- @closed-decisions/stacks/nextjs-app-router
- @closed-decisions/testing/vitest-only
- @closed-decisions/db/postgres-drizzle
- **Custom — tenant isolation:** schema-per-tenant (not row-level security). Source: AERS §4.2.

## Milestone: Scaffold

### Task 1: Scaffold from template

Scaffold the project from the `templates/nextjs-app-router/` directory.
The template copy is verbatim — do not modify during copy (see Closed
Decision on Scaffolding).

**Acceptance:** all of the following shell checks exit 0.
```bash
test -d app
test -f package.json
grep -q '"next"' package.json
```
