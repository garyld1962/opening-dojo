---
name: dependency-classification
description: "Reusable taxonomy for classifying code dependencies by their testability and trust boundary. Drives test strategy and audit judgments. Embedded by /test-plan, /audit-existing, and any skill that needs to reason about how a dependency should be tested or treated."
user-invocable: false
internal: true
kind: reference
---

# Dependency Classification

A four-bucket taxonomy for any external thing your code talks to. The bucket determines the right test strategy, and (transitively) what kinds of bugs your tests will and won't catch. Mocking the wrong category hides real bugs; not mocking the right one couples tests to systems you don't control.

## When to Use

Embed in any skill that:

- Plans tests (`/test-plan`) — drives whether to test directly, substitute, abstract, or mock.
- Audits existing tests (`/audit-existing`) — flags miscategorized dependencies as a coverage smell (e.g., a Postgres dependency mocked when PGLite would have caught real schema bugs).
- Reasons about test pyramids, integration boundaries, or risk surface.

## The Four Categories

| Category | Description | Test Strategy | Examples |
|---|---|---|---|
| **In-process** | Pure computation, no I/O. Same memory, same process. | Test directly — no mocks, no substitutes. | Validation logic, data transforms, calculations, state machines. |
| **Local-substitutable** | Crosses a boundary, but a real, fast, faithful local stand-in exists. | Use the substitute — faster than mocks, higher fidelity. | PGLite for Postgres, SQLite for SQL, in-memory filesystem, embedded Redis, testcontainers. |
| **Remote but owned** | Services you control across a network or process boundary. | Ports & Adapters — define an interface, inject a real adapter in integration tests and an in-memory adapter in unit tests. | Your own API services, internal message queues, your own cache layers, your own workers. |
| **True external** | Third-party systems you don't control, can't run locally with fidelity, and shouldn't hit in CI. | Mock at the boundary — this is the only category where mocking is the right default. Pair with a small contract test against the real service in a sandboxed lane. | Stripe API, SendGrid, AWS S3, external OAuth providers, third-party webhooks. |

## Rules

1. **Never mock in-process dependencies.** Mocking pure computation hides bugs and makes tests measure your mock, not your code.
2. **Never mock local-substitutable dependencies.** If PGLite exists for Postgres, use it. A handwritten DB mock will drift from real SQL behavior; the substitute won't.
3. **Mock remote-but-owned only at the unit-test boundary.** Integration tests must hit the real adapter. If you only have unit tests with mocks, you have no integration coverage at all — flag this as a gap.
4. **Mock true-external — but pair with a contract test.** Pure mocks against third-party APIs go stale silently. A nightly or pre-release contract test against the real service catches schema drift.
5. **Re-classify when the world changes.** "Remote but owned" can become "local-substitutable" the moment someone ships a testcontainer or in-memory adapter. Re-evaluate periodically.

## Common miscategorizations

- **Postgres mocked instead of PGLite-substituted.** Most common smell. Tests pass but don't exercise SQL semantics, constraints, transactions.
- **Internal services treated as true-external.** If you own both sides, you have ports/adapters available. Mocking is laziness here, not pragmatism.
- **External APIs treated as in-process.** Calling a function that wraps `fetch` is not in-process. The boundary is the network call, not the function signature.
- **Filesystem treated as I/O when it's substitutable.** `memfs`, in-memory filesystems, and tmpfs make most filesystem dependencies local-substitutable.

## Embedding pattern

When referencing this rubric from another skill:

```markdown
Classify each dependency using `_internal/dependency-classification/SKILL.md`.
For each dependency in scope, record: `<name> — <category> — <chosen test approach>`.
Flag any miscategorization (e.g., Postgres mocked rather than substituted with PGLite) as a finding.
```

## Output snippet

When a skill produces a classification table, prefer this format so downstream skills can parse it:

```
| Dependency | Category | Strategy |
|---|---|---|
| Postgres (`db/users` table) | Local-substitutable | PGLite in tests |
| Internal `auth-service` HTTP API | Remote but owned | In-memory adapter for unit, real adapter for integration |
| Stripe API | True external | Mock at `StripeClient` boundary; nightly contract test |
| `formatCurrency()` | In-process | Test directly |
```
