---
name: state-lifecycle
description: "State machine analyst — tests every valid transition, rejects every invalid one, verifies side effects of status changes."
user-invocable: false
private-resource: true
---

# State Lifecycle Analyst

> **Sub-skill of `/test-plan`.** Invoke this via `/test-plan` (State 4 dispatches it only when the entity has a status/state column; State 3 skips it otherwise). Direct invocation is unsupported — without the orchestrator's status-field detection and State 5 deduplication, the output will be incomplete and may collide with contract-compliance specs.

**"Do state transitions work correctly?"** — For entities with status fields.

## Purpose

Enumerate all valid and invalid state transitions for entities with status enums. Generate test specifications that verify every valid transition succeeds, every invalid transition throws, and every side effect of a transition fires correctly.

## Applicability

This analyst is selected when:
- The target entity has a status/state column in the DB schema
- The Zod schema includes a status enum field
- The task mentions transitions, workflows, or status changes

**Skip this analyst** for entities without status fields (e.g., pure CRUD with no lifecycle).

## Input

From the orchestrator:
- Status enum values from the shared package (e.g., `OrderStatus`, `TaskStatus`, `TicketStatus`)
- DB schema showing the status column and its type
- Task description mentioning transition behavior
- Reference implementation of transition methods (if any exist for similar entities)

## Process

### 1. Enumerate Status Values

Read the entity's status enum from the shared package:

```typescript
// Example: RfiStatus
enum RfiStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  ANSWERED = 'answered',
  CLOSED = 'closed',
  VOID = 'void',
}
```

### 2. Build Transition Matrix

Define the valid transitions. Source these from:
1. Task description (explicit transitions mentioned)
2. Entity's logical lifecycle (common patterns)
3. Existing transition methods in reference implementations

Example matrix for RFI:

| From | To | Method | Valid? |
|------|----|--------|--------|
| draft | open | submit | Yes |
| open | answered | answer | Yes |
| answered | closed | close | Yes |
| open | void | void | Yes |
| draft | void | void | Yes |
| closed | open | — | No |
| void | * | — | No |

### 3. Generate Valid Transition Specs (P1)

For each valid transition, create a test specification:

```json
{
  "analyst": "state-lifecycle",
  "priority": "P1",
  "category": "state-transition",
  "testName": "submit: transitions RFI from draft to open",
  "arrangement": "Insert an RFI record with status 'draft'",
  "action": "Call rfiService.submit(db, rfiId)",
  "assertions": [
    {
      "type": "equals",
      "target": "result.status",
      "expected": "'open'",
      "description": "Status changes to open"
    }
  ],
  "traceability": "RfiStatus enum: draft → open via submit"
}
```

### 4. Generate Invalid Transition Specs (P1)

For representative invalid transitions, create error-path specs:

```json
{
  "analyst": "state-lifecycle",
  "priority": "P1",
  "category": "state-transition",
  "testName": "submit: rejects transition from closed to open with INVALID_STATE",
  "arrangement": "Insert an RFI record with status 'closed'",
  "action": "Call rfiService.submit(db, rfiId)",
  "assertions": [
    {
      "type": "throws",
      "target": "error.code",
      "expected": "INVALID_STATE",
      "description": "Throws INVALID_STATE error"
    }
  ],
  "traceability": "RfiStatus enum: closed → open is not a valid transition"
}
```

**Coverage guidance:** Test at least:
- Every terminal state (void, closed, completed) → any other state (should reject)
- 2-3 "skip" transitions (e.g., draft → closed, skipping open)
- 1 backward transition (e.g., answered → open)

### 5. Generate Side Effect Specs (P2)

Status transitions often trigger side effects:

| Side Effect | Priority | Example |
|------------|----------|---------|
| `updatedAt` changes | P2 | Timestamp updates on transition |
| Computed field updates | P2 | `closedAt` set when status → closed |
| Cascade updates | P2 | CO approval updates budget items |
| Notification triggers | P3 | Email sent on RFI answer |

```json
{
  "analyst": "state-lifecycle",
  "priority": "P2",
  "category": "side-effect",
  "testName": "close: sets closedAt timestamp when transitioning to closed",
  "assertions": [
    {
      "type": "defined",
      "target": "result.closedAt",
      "description": "closedAt timestamp is set"
    },
    {
      "type": "equals",
      "target": "result.status",
      "expected": "'closed'",
      "description": "Status is closed"
    }
  ]
}
```

## Output

Emit `TestSpecification` objects with `analyst: "state-lifecycle"`.

### Output schema

Every emitted spec MUST conform to the canonical schema in
`test-plan/foundations/test-case-schema.md`. Use the `traceability`
field to cite the source state machine (DB enum, Zod enum, business
rule). State-lifecycle specs typically populate
`category: "state-transition"`.

### Typical Output Distribution

| Category | % of Specs |
|----------|-----------|
| state-transition (valid) | 40-50% |
| state-transition (invalid) | 30-40% |
| side-effect | 15-25% |

## Rules

### 1. Every Valid Transition Gets a P1 Test
No valid transition should be untested. Each transition method (submit, approve, close, void, etc.) gets at least one test.

### 2. Representative Invalid Transitions
Don't test every invalid combination (N x N matrix). Test:
- All terminal states → any active state
- 2-3 "impossible" transitions (skipping required states)
- 1 backward transition

### 3. Side Effects Are P2
Timestamp updates, computed fields, and cascade effects are important but secondary to the transitions themselves.

### 4. Method Names Matter
Use the transition method name in the test name:
```
✅ "submit: transitions RFI from draft to open"
✅ "approve: rejects transition from draft (must be pending)"
❌ "status changes from draft to open"
```

### 5. Don't Duplicate Contract Compliance
This analyst focuses on the state machine mechanics. Contract compliance handles "does the operation return the right data." If both produce a spec for the same transition, the state-lifecycle spec focuses on status assertions while contract compliance focuses on return value assertions.

## Contract

- **Inputs:** DB schema column for status, Zod enum for status, business rules describing valid transitions, CLAUDE.md conventions.
- **Preconditions:** invoked from `/test-plan` State 4 only when the entity has a status/state column (otherwise State 3 skips this analyst).
- **Outputs:** `TestSpecification[]` conforming to `test-plan/foundations/test-case-schema.md`, with `analyst: "state-lifecycle"` and `category: "state-transition"` for the majority.
- **Postconditions:** orchestrator validates, dedupes, and merges with other analysts' specs; status assertions stay in this analyst's specs.
- **Failure modes:** no status field detected → analyst not selected by State 3; ambiguous transition rules → emit specs only for the rules the schema/code enforces and cite the gap in `traceability`.
