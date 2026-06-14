---
name: test-writer
description: "Test file generator — converts TestSpecification objects into valid Vitest .test.ts files with it.todo() stubs."
user-invocable: false
private-resource: true
---

# Test Writer

> **Sub-skill of `/test-plan`.** Invoke this via `/test-plan` (State 6: GENERATE_OUTPUT dispatches it after the orchestrator has consolidated and schema-validated specs). Direct invocation is unsupported — this skill assumes the input has passed State 5 validation against `test-plan/foundations/test-case-schema.md`; calling it with raw, unvalidated specs will produce malformed test files.

Generates actual `.test.ts` files from consolidated TestSpecification objects.

## Input

From the orchestrator (State 6: GENERATE_OUTPUT):
- Grouped specifications: `Record<testFile, TestSpecification[]>` —
  every spec MUST conform to the canonical schema in
  `test-plan/foundations/test-case-schema.md`. Reject the input if a
  spec is missing a required field; do not silently drop it.
- Project context: test framework, import conventions, entity name
- Plan metadata: planId, task description, analysts used

## Process

### 1. Group by Test File

Specifications arrive grouped by `testFile` path. Each group becomes one `.test.ts` file.

### 2. Organize Describe Blocks

Within each file, organize specs into nested `describe()` blocks:

```typescript
describe('vendorService', () => {
  describe('create', () => {
    // create specs here
  });
  describe('getById', () => {
    // getById specs here
  });
});
```

Sort describe blocks by operation order: create, getById, list, update, delete, then transition methods alphabetically.

### 3. Order Tests Within Blocks

Within each describe block, order by:
1. Priority: P1 first, then P2, then P3
2. Category: happy-path first, then error-path, then edge-case, then state-transition, then integration, then side-effect

### 4. Generate Test Stubs

For specs with `requiresImplementation: true`, generate `it.todo()`:

```typescript
it.todo('returns created vendor with all required fields');
```

For specs with `requiresImplementation: false`, generate full test bodies using the specification's arrangement, action, and assertions.

### 5. Add File Header

Every generated file starts with a metadata comment:

```typescript
/**
 * Test Plan: {entity}.{layer} (planId: {planId})
 * Task: "{task description}"
 * Generated: {timestamp}
 * Analysts: {comma-separated analyst names}
 *
 * Tests are generated as it.todo() stubs. Fill in test bodies
 * as you implement the feature. See the test plan report for
 * full specification details including arrangement and assertions.
 */
```

### 6. Add Imports

Generate the import section based on the test framework and what's needed:

```typescript
import { describe, expect, it } from 'vitest';
```

Add commented-out imports for the module under test:

```typescript
// Uncomment as you implement:
// import { vendorService } from './vendor.service.js';
// import type { CreateEntityInput } from '<shared-package>';
// import { Category, ErrorCode } from '<shared-package>';
```

## Output Format

### Service Test File

```typescript
import { describe, expect, it } from 'vitest';

// Uncomment as you implement:
// import { entityService } from './entity.service.js';
// import type { CreateEntityInput } from '<shared-package>';
// import { ErrorCode, Category } from '<shared-package>';

/**
 * Test Plan: entity.service (planId: b7e4f1a2)
 * Task: "Implement entity CRUD service with calculation"
 * Generated: 2026-02-18T10:30:00Z
 * Analysts: contract-compliance, boundary-validation, integration-surface
 *
 * Tests are generated as it.todo() stubs. Fill in test bodies
 * as you implement the feature. See the test plan report for
 * full specification details including arrangement and assertions.
 */
describe('vendorService', () => {
  describe('create', () => {
    // P1 — contract-compliance
    it.todo('returns created vendor with all required fields');
    it.todo('requires at least one WBS category');

    // P1 — boundary-validation
    it.todo('rejects empty companyName with VALIDATION error');
    it.todo('rejects invalid email format with VALIDATION error');

    // P2 — contract-compliance
    it.todo('sets default status to active');
    it.todo('sets createdAt and updatedAt timestamps');
  });

  describe('getById', () => {
    // P1 — contract-compliance
    it.todo('returns vendor when exists');

    // P1 — boundary-validation
    it.todo('throws NOT_FOUND for non-existent ID');
  });

  describe('list', () => {
    // P1 — contract-compliance
    it.todo('returns array of vendors');
    it.todo('filters by WBS category');

    // P2 — boundary-validation
    it.todo('returns empty array when no vendors exist');
    it.todo('excludes soft-deleted vendors');
  });

  describe('update', () => {
    // P1 — contract-compliance
    it.todo('updates vendor fields');

    // P1 — boundary-validation
    it.todo('throws NOT_FOUND for non-existent ID');

    // P2 — contract-compliance
    it.todo('updates updatedAt timestamp');
  });

  describe('delete', () => {
    // P1 — contract-compliance
    it.todo('soft-deletes vendor');

    // P1 — boundary-validation
    it.todo('throws NOT_FOUND for non-existent ID');
  });

  describe('calculateRating', () => {
    // P1 — contract-compliance
    it.todo('calculates average rating from vendor quotes');
    it.todo('returns 0 when no quotes exist');

    // P2 — contract-compliance
    it.todo('rounds rating to 2 decimal places');
  });
});
```

### Router Test File

```typescript
import { describe, expect, it } from 'vitest';

// Uncomment as you implement:
// import { vendorRouter } from './vendor.router.js';

/**
 * Test Plan: vendor.router (planId: b7e4f1a2)
 * Task: "Implement vendor CRUD service with rating calculation"
 * Generated: 2026-02-18T10:30:00Z
 * Analysts: integration-surface
 */
describe('vendorRouter', () => {
  // P1 — integration-surface
  it.todo('create endpoint is defined as a mutation');
  it.todo('getById endpoint is defined as a query');
  it.todo('list endpoint is defined as a query');
  it.todo('update endpoint is defined as a mutation');
  it.todo('delete endpoint is defined as a mutation');

  // P2 — integration-surface
  it.todo('all procedures use protectedProcedure');
  it.todo('create procedure binds createVendorInput schema');
});
```

## Rules

### 1. Valid Vitest Syntax
Generated files must be syntactically valid TypeScript that Vitest can parse. Run `vitest --passWithNoTests` to verify.

### 2. it.todo() for Unimplemented
Default to `it.todo()` stubs. Only generate full test bodies when `requiresImplementation: false` AND the assertion is simple enough to be confident in correctness.

### 3. Comments Indicate Priority and Analyst
Each group of tests gets a comment line: `// P1 — contract-compliance`

### 4. Commented Imports
Module-under-test imports are commented out. The team agent uncomments them as they implement. This prevents import errors when the module doesn't exist yet.

### 5. No Test Helpers or Utilities
Don't generate test utility files, factories, or shared fixtures. Keep generated files self-contained. The team agent adds helpers as needed during implementation.

### 6. Respect Project File Conventions
- Test files alongside source: `vendor.service.test.ts` next to `vendor.service.ts`
- Use `.js` extension in imports (TypeScript module resolution)
- Import from the project's shared package for types and enums

### 7. Don't Overwrite Existing Tests
If the target test file already exists, report it in the plan output and do NOT overwrite. The team agent decides how to merge.

## Contract

- **Inputs:** `Record<testFile, TestSpecification[]>` (specs grouped by target file, all conforming to `test-plan/foundations/test-case-schema.md`); project context (test framework, import conventions, entity name); plan metadata (`planId`, task description, analysts used).
- **Preconditions:** invoked from `/test-plan` State 6 (GENERATE_OUTPUT) only; specs were schema-validated by the orchestrator at State 5.
- **Outputs:** `.test.ts` files at each `testFile` path with nested `describe()` blocks and `it.todo()` (or full `it()` when `requiresImplementation: false`) ordered by priority then category.
- **Postconditions:** existing test files are NOT overwritten — collisions are reported back to the orchestrator and listed in the plan output.
- **Failure modes:** spec missing a required schema field → reject the input (do not silently drop the spec); file collision → skip and report; invalid `testFile` path → reject with a clear error.
