---
name: boundary-validation
description: "Input validation analyst — tests required field enforcement, Zod constraint boundaries, NOT_FOUND handling, error code specificity, soft-delete behavior."
user-invocable: false
private-resource: true
---

# Boundary Validation Analyst

> **Sub-skill of `/test-plan`.** Invoke this via `/test-plan` (State 4 dispatches it automatically when the entity has Zod constraints or DB nullability rules to test). Direct invocation is unsupported — without the orchestrator's State 2 context (project config, schemas, layer detection) and State 5 deduplication, the output is incomplete and may collide with other analysts' specs.

**"What happens with bad input?"** — Tests the edges and error paths.

## Purpose

Generate test specifications for input validation, constraint boundaries, error handling, and edge cases. Ensures the code rejects invalid input gracefully with correct error codes, and handles boundary values at Zod schema limits.

## Input

From the orchestrator:
- Zod schemas for the entity (input schemas with constraints)
- DB schema (nullable columns, defaults, unique constraints)
- Error handling pattern from CLAUDE.md (AppError, ErrorCode)
- Target entity, package, and layer

## Process

### 1. Required Field Enforcement

For each required field in the input Zod schema, generate an error-path test:

```json
{
  "analyst": "boundary-validation",
  "priority": "P1",
  "category": "error-path",
  "testName": "rejects create when companyName is missing",
  "arrangement": "Create input object without companyName field",
  "action": "Call vendorService.create(db, input)",
  "assertions": [
    {
      "type": "throws",
      "target": "error.code",
      "expected": "VALIDATION",
      "description": "Throws VALIDATION error code"
    }
  ],
  "traceability": "Zod schema: createVendorInput requires companyName"
}
```

### 2. Constraint Boundary Testing

For each Zod constraint, test at and beyond the boundary:

| Constraint | Test At Boundary | Test Beyond Boundary |
|-----------|-----------------|---------------------|
| `z.string().min(1)` | P2: empty string `""` rejects | — |
| `z.string().max(255)` | P2: 255 chars accepts | P2: 256 chars rejects |
| `z.number().min(0)` | P2: value `0` accepts | P2: value `-1` rejects |
| `z.number().max(5)` | P2: value `5` accepts | P2: value `6` rejects |
| `z.string().email()` | P2: valid email accepts | P2: invalid email rejects |
| `z.string().uuid()` | P2: valid UUID accepts | P2: invalid UUID rejects |
| `z.array().min(1)` | P2: 1-element array accepts | P1: empty array rejects |

Generate pairs: one at the boundary (accepts), one beyond (rejects).

### 3. NOT_FOUND Handling

For every operation that takes an entity ID:

```json
{
  "analyst": "boundary-validation",
  "priority": "P1",
  "category": "error-path",
  "testName": "throws NOT_FOUND for non-existent vendor ID",
  "arrangement": "Generate a random UUID that doesn't exist in the database",
  "action": "Call vendorService.getById(db, nonExistentId)",
  "assertions": [
    {
      "type": "throws",
      "target": "error.code",
      "expected": "NOT_FOUND",
      "description": "Throws NOT_FOUND error"
    }
  ],
  "traceability": "CLAUDE.md §Error Handling: NOT_FOUND for missing entities"
}
```

Cover: getById, update, delete, and any transition methods that take an ID.

### 4. Error Code Specificity

Verify the correct error code is thrown for different error conditions:

| Condition | Expected Error Code | Priority |
|-----------|-------------------|----------|
| Missing required field | `VALIDATION` | P1 |
| Invalid field format | `VALIDATION` | P2 |
| Non-existent entity | `NOT_FOUND` | P1 |
| Invalid state transition | `INVALID_STATE` | P1 |
| Duplicate unique field | `CONFLICT` | P2 |
| Unauthorized access | `UNAUTHORIZED` | P2 |

### 5. Soft-Delete Behavior

If the DB schema uses soft-delete (a `deletedAt` column):

```json
{
  "analyst": "boundary-validation",
  "priority": "P2",
  "category": "edge-case",
  "testName": "list excludes soft-deleted vendors",
  "arrangement": "Insert a vendor, then soft-delete it",
  "action": "Call vendorService.list(db, {})",
  "assertions": [
    {
      "type": "length",
      "target": "result",
      "expected": "0",
      "description": "Deleted vendor not in list results"
    }
  ],
  "traceability": "DB schema: vendors table has deletedAt column"
}
```

### 6. Empty Collection Handling

```json
{
  "analyst": "boundary-validation",
  "priority": "P2",
  "category": "edge-case",
  "testName": "list returns empty array when no vendors exist",
  "arrangement": "Empty database (no vendors inserted)",
  "action": "Call vendorService.list(db, {})",
  "assertions": [
    {
      "type": "equals",
      "target": "result",
      "expected": "[]",
      "description": "Returns empty array, not null or undefined"
    }
  ]
}
```

## Output

Emit `TestSpecification` objects with `analyst: "boundary-validation"`.

### Output schema

Every emitted spec MUST conform to the canonical schema in
`test-plan/foundations/test-case-schema.md`. That doc defines every
required and optional field, the `Assertion` shape, and the priority
rubric. Do not invent additional top-level fields; use the
`traceability` string to encode source-of-truth references.

### Typical Output Distribution

| Category | % of Specs |
|----------|-----------|
| error-path | 50-60% |
| edge-case | 30-40% |
| happy-path | 5-10% (boundary accepts) |

## Rules

### 1. Every Required Field Gets an Error Test (P1)
If Zod marks a field as required, there must be a test that verifies rejection when it's missing.

### 2. NOT_FOUND for Every ID-Taking Operation (P1)
getById, update, delete, and transition methods must all handle missing IDs.

### 3. Boundary Pairs (P2)
Test at the constraint boundary (should accept) AND beyond (should reject). Single-sided tests miss half the story.

### 4. Match Project Error Codes
Read CLAUDE.md for the project's error code enum. Use exact error codes in assertions (VALIDATION, NOT_FOUND, INVALID_STATE, etc.), not generic error messages.

### 5. Don't Test Framework Behavior
Zod itself validates constraints. The test should verify that the service/router correctly surfaces the Zod error as the project's error type — not that Zod's `.min(1)` implementation works.

```
✅ "rejects empty companyName with VALIDATION error code"
❌ "Zod rejects empty string for min(1)"
```

### 6. Error Context is P3
Testing that error messages include helpful context (IDs, field names) is nice but not critical:

```json
{
  "analyst": "boundary-validation",
  "priority": "P3",
  "category": "error-path",
  "testName": "NOT_FOUND error includes the requested vendor ID in context",
  "assertions": [
    {
      "type": "contains",
      "target": "error.context.vendorId",
      "expected": "requestedId",
      "description": "Error context includes the vendor ID"
    }
  ]
}
```

## Contract

- **Inputs:** entity Zod input schemas (with constraints), DB schema (nullable / defaults / unique), task context, CLAUDE.md conventions.
- **Preconditions:** invoked from `/test-plan` State 4; schemas readable; analyst is enabled in `.test-plan/config.json`.
- **Outputs:** `TestSpecification[]` conforming to `test-plan/foundations/test-case-schema.md`, with `analyst: "boundary-validation"`. Distribution skews error-path / edge-case.
- **Postconditions:** orchestrator (State 5) validates, dedupes, and merges with other analysts' specs.
- **Failure modes:** missing schemas → emit empty array with a `traceability` note explaining the gap; do not invent constraints.
