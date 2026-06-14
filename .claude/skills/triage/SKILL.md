---
name: triage
description: "Investigate a bug from reproduction through root cause analysis. Produces a structured triage report with classification, risk assessment, and recommended next step. Does NOT write fixes."
model: opus
---

# /triage -- Bug Investigation and Root Cause Analysis

**Purpose:** Systematically investigate a bug from reproduction through root cause identification. Produces a structured triage report with classification, risk assessment, and a recommended path forward. This skill investigates -- it does NOT write fixes. Project-agnostic -- adapts to any codebase by reading `CLAUDE.md`.

## When to Use

- A bug report comes in and you need to understand what is happening
- Something broke and you do not know why
- You need to assess severity and blast radius before deciding how to fix
- You want a structured handoff to /hotfix or /plan

## When NOT to Use

- You already know the root cause and just need to fix it -- use /hotfix or /plan
- The issue is a feature request, not a bug
- The issue is purely cosmetic with no functional impact -- just fix it directly

## Usage

```
/triage "users see 500 error on login after password reset"
/triage "budget totals don't match line items" --ado 12345
/triage "task dependency graph has cycles" --linear BF-42
/triage "photos not uploading on iOS" --quick
```

## Arguments

- `<description>` -- what is happening, as reported (required)
- `--ado <item-id>` -- fetch details from Azure DevOps work item via `az boards work-item show --id <item-id>`
- `--linear <issue-id>` -- fetch details from Linear via the Linear MCP tool (`linear issue read --id <issue-id>`)
- `--quick` -- skip regression analysis (Step 5), produce a shorter report

## Step 1: Project Discovery

Read `CLAUDE.md` from the repo root to learn:
- Project structure, package boundaries, and conventions
- Error handling patterns (AppError, error codes, etc.)
- Logging approach (where to find logs, structured fields)
- Test framework and how to run tests
- Database/ORM layer (Drizzle, Prisma, etc.)

## Step 2: Fetch Work Item (If Provided)

If `--ado <item-id>` or `--linear <issue-id>` was provided, use /work-item to retrieve the full details. Extract:
- Title and description
- Reproduction steps (if documented)
- Acceptance criteria
- Related items or links

## Step 3: Reproduce the Bug

Attempt to reproduce or confirm the bug through code analysis:

1. **Search for the symptom.** Find the code path that produces the reported behavior:
   - Error messages: search for the exact error text in the codebase
   - HTTP status codes: trace the endpoint handler
   - UI behavior: find the component and its data flow
   - Data issues: trace the query/mutation path

2. **Trace the execution path.** Follow the code from entry point to failure:
   - Identify the function/method where the bug manifests
   - Walk backward through the call chain
   - Note any branching logic, error handlers, or early returns

3. **Identify inputs that trigger the bug.** Determine:
   - What specific input or state triggers the failure
   - Is it deterministic or intermittent?
   - Does it depend on timing, data state, or environment?

## Step 4: Identify Root Cause

Classify the root cause into one of these categories:

| Category | Description | Examples |
|----------|-------------|---------|
| **Logic Error** | Code does the wrong thing | Off-by-one, wrong operator, missing negation, incorrect formula |
| **Type Error** | Runtime type mismatch despite TypeScript | Unsafe cast, `as any`, missing null check, incorrect Zod schema |
| **Integration** | Contract mismatch between components | API returns different shape than client expects, wrong enum value |
| **Race Condition** | Timing-dependent failure | Concurrent writes, stale cache, async ordering assumption |
| **Config/Env** | Environment or configuration issue | Missing env var, wrong URL, feature flag state |
| **Data** | Unexpected data state | Null in non-nullable column, orphaned reference, corrupted state |

For the root cause, identify:
- **The exact location:** file, function, line range
- **The mechanism:** what specifically goes wrong and why
- **The trigger:** what conditions cause this path to execute

## Step 5: Regression Analysis (Skip with `--quick`)

Determine when this bug was introduced:

```bash
# Find recent changes to the affected files
git log --oneline -20 -- <affected-files>
```

If a specific commit is suspect:
```bash
git show <sha> -- <file>
```

Answer:
- Was this always broken, or did a recent change introduce it?
- If recent: which commit, who authored it, what was the intent?
- Are there related changes in the same PR that might also be affected?

## Step 6: Risk Assessment

Assess four dimensions:

### Blast Radius
- **Isolated:** affects one feature or edge case
- **Moderate:** affects a common workflow or multiple features
- **Wide:** affects all users or a core system function

### Fix Complexity
- **Simple:** one-line fix or small localized change
- **Moderate:** changes to 2-5 files, straightforward logic
- **Complex:** cross-cutting change, multiple packages, requires design decisions

### Regression Risk
- **Low:** fix is isolated, existing tests cover surrounding code
- **Medium:** fix touches shared code, test coverage is partial
- **High:** fix touches core logic, minimal test coverage, or has cascading effects

### Test Coverage
- **Good:** affected code has tests, but they miss this case
- **Partial:** some tests exist but do not cover the affected path
- **None:** no tests for the affected code path

## Step 7: Recommend Next Step

Based on the assessment, recommend one of:

| Recommendation | When |
|----------------|------|
| **/hotfix** | Blast radius is Wide or Moderate AND fix complexity is Simple or Moderate |
| **/plan** | Fix complexity is Complex OR regression risk is High |
| **Direct fix** | Blast radius is Isolated AND fix complexity is Simple AND test coverage is Good |
| **Needs more investigation** | Root cause is still unclear or there may be multiple contributing factors |

## Step 8: Triage Report

Present the structured report:

```
Triage Report: <short title>

Reported Issue
  <description as provided>

Root Cause
  Category:  <Logic Error | Type Error | Integration | Race Condition | Config/Env | Data>
  Location:  <file>:<function> (lines <N>-<M>)
  Mechanism: <what goes wrong>
  Trigger:   <what conditions cause it>

Regression
  Introduced: <commit sha> <date> | "pre-existing" | "unknown"
  Related:    <any related changes or PRs>

Risk Assessment
  Blast Radius:    <Isolated | Moderate | Wide>
  Fix Complexity:  <Simple | Moderate | Complex>
  Regression Risk: <Low | Medium | High>
  Test Coverage:   <Good | Partial | None>

Recommendation: <next step>
  Rationale: <one sentence>

Tracking: <ADO/Linear reference if provided>
```

## Key Rules

1. **Investigate first, fix later.** This skill does NOT write fixes. It produces a diagnosis.
2. **Be specific.** Cite exact files, functions, and line numbers. Vague findings are useless.
3. **One root cause.** If there are multiple contributing factors, identify the primary one and note the others.
4. **Do not guess.** If you cannot determine the root cause with confidence, say so. "Needs more investigation" is a valid recommendation.
5. **Trace, do not assume.** Actually follow the code path. Do not guess based on file names or function signatures alone.
6. **Respect scope.** Do not start fixing the bug. Do not refactor. Do not add tests. Investigate and report.
