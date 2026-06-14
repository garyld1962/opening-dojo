---
name: prd-acceptance
description: "Validate implementation against PRD acceptance criteria. Reads a PRD, extracts checkboxes, verifies each with evidence, produces a pass/fail scorecard."
---

# /prd-acceptance — PRD Acceptance Validation

**Purpose:** Compare finished implementation against the PRD's acceptance criteria. For each criterion, determine HOW to verify it, execute the check, and report pass/fail with evidence.

## When to Use

- Implementation is complete and you need to verify PRD criteria are met
- Before marking a story/PRD done, or before PR merge on acceptance-driven work
- Re-verifying after a fix via `--recheck`

## When NOT to Use

- PRD is still a draft — use `/prd-validate` first
- You need a general code review — use `/code-review`
- No PRD/acceptance criteria exist — there's nothing to verify against

**Arguments:**
- `<path>` — path to the PRD file (required on first run, remembered after)
- `--recheck` — re-run only previously failed criteria
- `--dry-run` — show verification plan without executing

## Step 1: Load the PRD

Read the PRD file from the argument path. If no path is given, check these locations in order:
1. `test_prd.md` (project root)
2. `docs/plans/*.md` (most recently modified)
3. `PRD.md` or `prd.md` (project root)

If no PRD is found, ask the user.

## Step 2: Extract Acceptance Criteria

Scan the PRD for acceptance criteria. These are identified by:
- Markdown checkboxes: `- [ ]` or `- [x]`
- Sections titled "Acceptance Criteria", "Requirements", "Done When", "Definition of Done"
- Numbered lists under those headings

For each criterion, extract:
- **ID**: Sequential (AC-01, AC-02, ...)
- **Text**: The criterion as written
- **Category**: Classify into one of: `build`, `code-structure`, `api`, `ui`, `data`, `test`, `behavior`

Display the extracted criteria and ask the user to confirm before proceeding:

```
Found 24 acceptance criteria in test_prd.md:

  Build (4):        AC-01..AC-04
  Code Structure (3): AC-05..AC-07
  API (6):          AC-08..AC-13
  UI (6):           AC-14..AC-19
  Data (4):         AC-20..AC-23
  Test (1):         AC-24

Proceed with verification? [Y/n]
```

## Step 3: Plan Verification

For each criterion, determine the verification method. Do NOT guess — read the project first.

### Verification Methods

| Category | Method | How |
|----------|--------|-----|
| `build` | Run command | Execute the build/install/dev command and check exit code |
| `code-structure` | File/code search | Verify files exist, exports are present, imports are correct |
| `api` | HTTP request | Start the server, hit the endpoint, check response shape/status |
| `ui` | Code inspection | Read component code, verify elements/handlers exist |
| `data` | Schema + code check | Read schema, verify constraints, check mutation logic |
| `test` | Run tests | Execute test suite, check for specific test files |
| `behavior` | Combined | May need multiple methods — run code + inspect output |

### Detection Phase (MANDATORY before any execution)

Before running any verification:

1. **Detect package manager**: Read `package.json`, check for lockfiles
2. **Detect project scripts**: `pnpm run` / `npm run` — what's available?
3. **Detect API port**: Read the API entry point or config for the port number
4. **Detect web port**: Read Next.js config or package.json dev script for the port
5. **Detect test framework**: vitest, jest, mocha — check devDependencies
6. **Detect database**: Read schema files, check for migration scripts

Record all detected values before proceeding. Do NOT assume ports, commands, or paths.

### For `--dry-run`: Stop here and display the verification plan

```
AC-01: `pnpm install` succeeds
  Method: build
  Command: pnpm install
  Pass if: exit code 0

AC-08: POST /items with missing title returns 400
  Method: api
  Prereq: API server running on port <detected>
  Command: curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:<port>/api/v1/items -H 'Content-Type: application/json' -d '{}'
  Pass if: HTTP 400, response body contains "error" and "title"
```

## Step 4: Execute Verification

Run checks in dependency order:

### Phase 1: Build (must pass before anything else)
Run install, build, typecheck. If ANY fail, stop and report — no point checking API/UI if it doesn't compile.

### Phase 2: Code Structure
Verify file existence, exports, imports, shared package usage. These are static checks — no server needed.

### Phase 3: Data Integrity
Read schema definitions, check for computed vs stored fields, verify validation logic exists in code.

### Phase 4: API
Start the API server in background. Run endpoint checks. Kill the server when done.

**For each API check:**
1. Make the HTTP request
2. Capture status code AND response body
3. Compare against expected values from the PRD
4. Record evidence (actual status code, actual response snippet)

### Phase 5: UI
UI checks are primarily code inspection (does the component exist, does it have the right handlers, does it call the right API). For interactive behavior (live preview, click-to-sort), verify the code wiring — do NOT try to run a browser.

### Phase 6: Tests
Run the test suite. Check for specific test file existence if the PRD mentions it.

### Error Handling

- If a server won't start: record as FAIL with the error output, continue with non-server checks
- If a command times out (>30s): record as FAIL with "timeout", move on
- If a check is ambiguous: record as MANUAL with explanation of what to verify by hand
- Kill any background processes (servers) when verification is complete

## Step 5: Produce Report

Write the report to `docs/prd-acceptance/` with this format:

```
docs/prd-acceptance/<YYYY-MM-DD>--<PRD-filename>--acceptance.md
```

### Report Format

```markdown
# Acceptance Report

- **Date:** <YYYY-MM-DD HH:MM>
- **PRD:** <path to PRD file>
- **Result:** <PASS | PARTIAL | FAIL>
- **Score:** <passed>/<total> (<percentage>%)

## Summary

| Category | Pass | Fail | Manual | Total |
|----------|------|------|--------|-------|
| Build | N | N | N | N |
| Code Structure | N | N | N | N |
| API | N | N | N | N |
| UI | N | N | N | N |
| Data | N | N | N | N |
| Test | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

## Criteria Results

### PASS

- **AC-01** `pnpm install` succeeds
  - Evidence: exit code 0, 847 packages installed

### FAIL

- **AC-08** POST /items with missing title returns 400
  - Expected: HTTP 400 with field-level error for "title"
  - Actual: HTTP 500 — unhandled validation error
  - Evidence: `{"error":"Internal Server Error"}`

### MANUAL

- **AC-15** Score selectors are interactive (not plain text inputs)
  - Reason: Requires visual/browser inspection
  - Guidance: Open /items/new and verify score fields are clickable selectors

## Verdict

<1-3 sentence assessment: what's working, what's broken, what's the critical path to PASS>
```

### Result Logic

- **PASS**: All criteria pass (MANUAL counts as pass — they're noted for human spot-check)
- **PARTIAL**: >70% pass, no build failures
- **FAIL**: <70% pass OR any build failure

## Step 6: Response

```
Acceptance: <RESULT> — <passed>/<total> (<percentage>%)

PRD: <path>
Report: <report-path>

Failed:
  AC-08: POST /items missing title → 500 instead of 400
  AC-12: GET /stats returns empty instead of counts

Manual (verify by hand):
  AC-15: Score selectors are interactive
  AC-17: Priority preview updates live

Next steps:
  1. Fix validation error handling in POST /items
  2. Implement /stats endpoint aggregation
  3. Run `/prd-acceptance --recheck` after fixes
```

## Rules

1. **Read the PRD exactly.** Verify what it says, not what you think it should say. If the PRD says "soft delete OR hard delete — your call", check that ONE of them is implemented and documented. Do not fail because you'd have chosen differently.
2. **Evidence required.** Every PASS needs evidence (exit code, response body, code snippet). Every FAIL needs expected vs actual. No bare pass/fail without proof.
3. **Do NOT fix code.** This is validation only. Report what's broken, do not repair it.
4. **Kill your processes.** Any background servers started during verification MUST be killed before the skill exits.
5. **Detect, don't assume.** Ports, commands, paths, frameworks — detect them from the project. The PRD might say port 3001 but the implementation might use 8080. Check the actual code.
6. **Build first.** If the project doesn't compile, stop early. API and UI checks are meaningless against broken code.

## Contract

- **Inputs:** path to the PRD/AERS to verify against; the built / running application. Calls `/prd-validate` if the artifact is incomplete and `/code-review` when defects warrant a structured list.
- **Preconditions:** project compiles; required services (DB, queue, etc.) are reachable; ports/paths detected from the actual implementation, not assumed from the PRD.
- **Outputs:** acceptance report with PASS/FAIL per criterion plus evidence (exit code, response body, code snippet, screenshot reference); list of mismatches between PRD and implementation.
- **Postconditions:** all background processes started during verification are killed before exit; report attached to the PRD or the run report; no code edits are made.
- **Failure modes:** build fails → halt early; required service unreachable → fail with platform-specific setup instructions; PRD declares behaviour the implementation contradicts → report as `prd-implementation-mismatch`, do not assume the PRD is wrong.
