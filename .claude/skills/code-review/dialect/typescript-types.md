---
id: dialect/typescript-types
type: dialect
title: TypeScript Type System
extends: concept/correctness
triggers:
  paths:
    - "**/*.ts"
    - "**/*.tsx"
  imports:
    - "typescript"
  always: false
  conditional: "Files are TypeScript (.ts, .tsx)"
severity_owner: false
---

# TypeScript Type System — Dialect Overlay

Extends `concept/style` with TypeScript-specific type system smells that a language-agnostic style review cannot see.

Read CLAUDE.md and tsconfig.json before applying. These rules adapt to the project's strictness level and conventions.

## Additional smells to hunt for

- **`any` type.** Escape hatch that silently disables type checking. Flag every use. `unknown` is the safe alternative when the type is genuinely not known. Exception: third-party library interop where `any` is the library's type — must have a justifying comment.
- **`@ts-ignore` without justification.** Prefer `@ts-expect-error` with an explanation and ticket link. `@ts-ignore` suppresses errors silently and permanently — when the underlying issue is fixed, the suppression lingers as dead code. `@ts-expect-error` fails when the error disappears, cleaning itself up.
- **Non-null assertion (`!`) hiding real bugs.** `users.find(...)!` asserts non-null without checking. If the assertion is wrong, the error surfaces far from the cause. Better: explicit null check with an informative error. Lower confidence (0.70) because `!` is sometimes legitimate after a guard in a parent scope.
- **`noUncheckedIndexedAccess` violations.** Array or object indexing that assumes the result is defined. `items[0].name` is a runtime error when `items` is empty. Only apply if the project's tsconfig enables this or if `strict: true` is on.
- **Cross-package boundary imports.** In monorepos, packages importing from another package's internal paths (`../../../other-package/src/internal`). Allowed: importing from the shared package, type-only imports (`import { type X }`). Identify boundaries from the workspace config.
- **Missing ESM extensions.** In projects with `"type": "module"` and `NodeNext` module resolution, relative imports require `.js` extensions. `import { x } from './foo'` should be `import { x } from './foo.js'`. Skip for CJS or bundler module resolution.
- **`console.log` in production code.** If the project has a structured logger (check CLAUDE.md), `console.log`/`console.error` in service code bypasses structured logging. Exception: test files, scripts, CLI tools.
- **Shallow modules.** A module that exports 5+ functions/classes with each under ~10 lines adds indirection without encapsulation. Signals: re-exports without transformation, public API as complex as implementation, namespace-only grouping. Do NOT flag barrel/index files, type-only modules, or test helpers. Confidence 0.70 — flag for human review.
- **Unused imports and variables the linter misses.** Most projects catch this via linting. Only flag if no linter is configured or if the unused import is a type import that was converted to a value import.
- **Type assertions (`as X`) where narrowing would work.** `value as string` when `typeof value === 'string'` is available. Assertions bypass the compiler; narrowing works with it.
- **Discriminated unions not narrowed.** A switch/if on a discriminated union that doesn't exhaust all cases and has no default. The compiler can enforce exhaustiveness — the code should let it.
- **Generic constraints too loose.** `<T>` where `<T extends SomeBase>` would catch misuse at the call site. Or `<T extends object>` where a more specific constraint exists.
