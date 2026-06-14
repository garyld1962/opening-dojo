# Code Review — Controller Guide

Adversarial, domain-based code review. Each domain is a **separate pass with its own context window**. The combined-prompt failure mode is shallow bullet-per-domain output; separate passes force depth.

This pruned variant (in `claude-working/`) supports two profiles from one domain library. Dialect and platform overlays are intentionally out of scope here — add them later if the team's stack requires them.

## Profiles

- **`breakpoint`** — light mid-flow review run at milestone boundaries during plan execution. Security, correctness, tests only. Fast.
- **`full`** — comprehensive domain sweep run at the PR boundary. All 11 concept domains (conditional ones fire only when their triggers match).

## Concept domains

All 11 lenses live under `../concept/`:

| Domain | Lens |
|---|---|
| `security.md` | Input validation, authz, secrets, trust boundaries |
| `correctness.md` | "Assume tests pass, what bugs remain" |
| `architecture.md` | Design fit, coupling, layering, simpler alternatives |
| `tests.md` | Would these tests catch a real regression |
| `performance.md` | CPU, memory, allocations, I/O patterns |
| `operability.md` | Logging, metrics, tracing, 3am debuggability |
| `resilience.md` | Error handling, timeouts, retries, blast radius |
| `concurrency.md` | Shared state, locking, ordering, lifetimes |
| `requirements.md` | PR-vs-code alignment, unstated assumptions |
| `data-integrity.md` (conditional) | Transactions, idempotency, migration safety |
| `api-contract.md` (conditional) | Interface design, versioning, coupling |

Conditional domains only fire when the diff touches persistence (data-integrity) or a public surface (api-contract).

## Severity scale

- **critical** — will cause incident, data loss, or security breach. Blocks.
- **major** — meaningful degradation, real maintenance burden, or latent bug. Revise before merge.
- **minor** — worth fixing but not blocking. Leave a note.
- **nit** — style or taste. Mention once.
- **plan-ambiguity** — the plan has more than one reasonable reading and
  the executor cannot choose without guessing. In interactive mode:
  pause and ask. In batch mode: abort cleanly, log the question, resume
  once the plan is updated. Never silently guessed through.
  See `execute-plan/SKILL.md` (ambiguity taxonomy).
- **plan-deviation** — execution made an unplanned change (e.g. a
  dep-bump needed to unblock the build). Requires explicit disposition
  (`disagree-with-evidence` / `defer` / `accepted-risk`); never
  auto-fixed. See Task 13 of `claude-working-hardening.md`.

## Output format

```
## Findings
[severity] [file:line] — [problem] — [fix]

## Questions
[things the reviewer needs to know to finalize]

## Verdict
[block | revise | accept-with-notes | accept]
```

## How to run

1. Pick a profile: `breakpoint` for mid-flow, `full` for PR.
2. Invoke `SKILL.md` with `profile: {id}` and the diff.
3. The controller triages the diff, selects domains, dispatches workers in parallel, merges findings.

The controller does **not** review — it dispatches and merges. Producing findings from the controller collapses back into the shallow-review failure mode.

## Adding a profile

Profiles are composition, not duplication. Copy an existing `.yaml`, list domains and modes, save. Don't copy domain content into a profile and don't write a new domain to achieve what a profile recombination would achieve.
