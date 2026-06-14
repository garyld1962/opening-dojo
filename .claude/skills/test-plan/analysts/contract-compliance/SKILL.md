---
name: contract-compliance
description: "Requirements analyst — decomposes task description into testable requirements. Maps Zod schema fields to assertions. Verifies CRUD completeness and return type coverage."
user-invocable: false
private-resource: true
---

# Contract Compliance Analyst

> **Sub-skill of `/test-plan`.** Invoke this via `/test-plan` (State 4 dispatches it on every plan — it's the always-on core analyst). Direct invocation is unsupported — without the orchestrator's State 2 context and State 5 deduplication, the output will be incomplete and may collide with other analysts' specs.

**"Does it satisfy the ask?"** — The core analyst. Every test plan includes this analyst.

## Purpose

Decompose the task description into specific, testable requirements. Ensure every stated requirement has at least one test specification. Map Zod input/output schemas to assertions. Verify CRUD operation completeness.

## Input

From the orchestrator:
- Task description (what the user asked to be built)
- Target entity, package, and layer
- Zod schemas for the entity (input and output)
- DB schema for the entity (columns, types, defaults)
- Reference implementation (if any existing service/router for a similar entity)
- Project conventions from CLAUDE.md

## Process

### 1. Parse the Task Description

Extract every actionable requirement. A requirement is any behavior the code must exhibit:

```
Task: "Implement vendor CRUD service with rating calculation"

Requirements extracted:
1. Create a vendor
2. Read a vendor by ID
3. List vendors (with filtering)
4. Update a vendor
5. Delete a vendor (soft or hard — check DB schema)
6. Calculate vendor rating
```

Each requirement becomes at least one P1 test specification.

### 2. Map Zod Schema to Assertions

Read the entity's validation schemas from the shared package. For each field:

| Schema Field | Test Category | Priority |
|-------------|---------------|----------|
| Required field | happy-path (present in response) | P1 |
| Required field | error-path (missing from input) | P1 |
| Optional field | happy-path (with and without) | P2-P3 |
| Constrained field (min/max/email) | edge-case (at boundaries) | P2 |
| Enum field | happy-path (valid value) | P1 |
| Enum field | error-path (invalid value) | P2 |

### 3. Verify CRUD Completeness

For service-layer tasks, check that ALL CRUD operations have specs:

| Operation | Expected Specs |
|-----------|---------------|
| **create** | Happy path (valid input → entity returned), required fields present |
| **getById** | Happy path (exists), error path (NOT_FOUND) |
| **list** | Happy path (returns array), filter by key fields |
| **update** | Happy path (fields change), partial update support |
| **delete** | Happy path (deleted), NOT_FOUND on bad ID |

If the task mentions specific operations (e.g., "CRUD"), ALL five must have P1 specs. If only specific operations are mentioned, only those need P1 specs.

### 4. Verify Return Type Coverage

For each operation, ensure the test asserts ALL required fields in the return type:

```json
{
  "analyst": "contract-compliance",
  "priority": "P1",
  "category": "happy-path",
  "testName": "returns created vendor with all required fields",
  "assertions": [
    { "type": "defined", "target": "result.id", "description": "Returns a UUID id" },
    { "type": "equals", "target": "result.companyName", "expected": "input.companyName", "description": "Company name matches input" },
    { "type": "equals", "target": "result.email", "expected": "input.email", "description": "Email matches input" },
    { "type": "defined", "target": "result.createdAt", "description": "Timestamps are set" }
  ]
}
```

### 5. Check for Computed/Derived Fields

If the task mentions calculations or derived values:

```
Task: "...with rating calculation"

Specs needed:
- P1: "calculates average rating from vendor quotes"
- P1: "returns 0 rating when no quotes exist"
- P2: "rating rounds to 2 decimal places"
```

## Output

Emit `TestSpecification` objects conforming to `foundations/test-case-schema.md` with `analyst: "contract-compliance"`.

### Output schema

The canonical schema at `test-plan/foundations/test-case-schema.md`
defines every required and optional field, the `Assertion` shape, and
the priority rubric. Do not invent additional top-level fields.
Contract-compliance specs typically populate `category` with
`happy-path`, `error-path`, or `side-effect`.

### Typical Output Distribution

| Category | % of Specs |
|----------|-----------|
| happy-path | 40-50% |
| error-path | 25-35% |
| edge-case | 10-15% |
| side-effect | 5-10% |

## Rules

### 1. Every Requirement Gets a Test (P1)
If the task says "implement X", there must be a test that verifies X works. No requirement left untested.

### 2. Schema Fields Map to Assertions
Read the Zod schema. Every required field in the output schema should appear in at least one happy-path test's assertions.

### 3. Error Paths for Required Fields
Every required field in the input schema gets an error-path test: "rejects when {field} is missing."

### 4. Don't Duplicate Other Analysts
Focus on WHAT the code should do (requirements), not:
- HOW state transitions work (state-lifecycle analyst)
- WHERE boundaries are (boundary-validation analyst)
- WHETHER it wires up correctly (integration-surface analyst)

If a requirement involves a state transition, still emit a P1 spec for it, but keep the assertion focused on the requirement ("submit RFI succeeds") rather than the transition mechanism.

### 5. Test Names Are Requirements
Each `testName` should read like a requirement statement. If you can't express it as "the system MUST {testName}", it's not specific enough.

```
✅ "returns created vendor with all required fields"
✅ "rejects duplicate email with CONFLICT error"
❌ "vendor creation works"
❌ "test the create function"
```

## Contract

- **Inputs:** task description; entity Zod input/output schemas; DB schema; reference implementation if present; CLAUDE.md conventions.
- **Preconditions:** invoked from `/test-plan` State 4; task description present; at least one schema readable.
- **Outputs:** `TestSpecification[]` conforming to `test-plan/foundations/test-case-schema.md`, with `analyst: "contract-compliance"`. Every stated requirement gets at least one P1 spec.
- **Postconditions:** orchestrator validates, dedupes, and merges with other analysts' specs.
- **Failure modes:** task description vague or schemas unreadable → emit specs only for what is defensible and cite missing context in `traceability`; do not paper over gaps with happy-path-only coverage.
