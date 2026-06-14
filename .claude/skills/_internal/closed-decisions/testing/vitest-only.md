---
id: testing/vitest-only
title: Vitest + Playwright; no Jest
---

# Vitest-only test stack

Reusable closed-decision fragment for projects standardising on
Vitest + Playwright. Include in a plan via
`@closed-decisions/testing/vitest-only`.

- **Unit and integration tests:** Vitest. Source: team standard.
- **E2E / browser tests:** Playwright. Source: team standard.
- **Jest:** forbidden. Do not add `jest`, `@types/jest`, or `ts-jest` to dependencies; do not author `jest.config.*`. Source: team standard.
- **Test file convention:** `*.test.ts` colocated with source, or under `tests/` for integration. Source: Vitest default.
- **Watch mode in CI:** disabled. Invoke Vitest with `--run` (see repo-delivery `## Commands` `test`). Source: CI reliability.
- **Coverage provider:** V8 (Vitest default); no c8-direct, no Istanbul. Source: Vitest 1.x.
- **Playwright browsers:** chromium only by default; add firefox/webkit per-project when needed. Source: team standard.
