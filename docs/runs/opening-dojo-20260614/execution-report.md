## Execution Report

**Plan:** docs/plans/opening-dojo.plan.md
**Plan-SHA:** 63cab2aa62223b17922642bad53e1593188745b1
**Base-SHA:** 4b825dc (empty tree) · **Head:** 299dc39 · **Branch:** master
**Mode:** auto (non-interactive) · **Adversarial:** ran (codex)
**Tasks:** 12/12 completed across 3 milestones / 3 waves (Wave 2 = 4 parallel lanes)
**Final gate:** `pnpm lint && pnpm typecheck && pnpm build && pnpm test` → all exit 0; **86 tests / 15 files pass**

### Per-Task Summary
| # | Description | Commit | Status |
|---|---|---|---|
| 1 | Scaffold Next.js + Tailwind + Vitest + Prisma | 87a6b12 | DONE |
| 2 | Domain types + module skeletons | 6e77578 | DONE |
| 3 | Prisma schema + migration + demo user | 9851e33 | DONE |
| 4 | chess-rules deterministic core | acff350 (+66c75b9) | DONE |
| 5 | Curated content + validated seed | 660fa8e | DONE |
| 6 | Board + Lesson/Overview UI (Lane A) | 0d14f17 | DONE |
| 7 | Drill engine + page + persistence (Lane B) | cce46a2 | DONE |
| 8 | AI Coach endpoint (Lane C) | e1d8ccd | DONE |
| 9 | Progress tracking (Lane D) | 818a3cf | DONE |
| 10 | Home + Progress dashboard | 52e96d2 | DONE |
| 11 | End-to-end happy path | e41cbac | DONE |
| 12 | Final verification + traceability | dca9d48 | DONE |

### Breakpoint Reviews
| Milestone | Severity | Count | Status breakdown |
|---|---|---|---|
| 1: Foundation | major | 1 | fixed: 1 (F-001 moveNumber semantics) |
| 1: Foundation | minor | 1 | disagree-with-evidence: 1 (slug content-only) |
| 2: Feature modules | major/critical | 0 | — |
| 2: Feature modules | minor | 4 | fixed: 2 (reveal scoring, progress 503); open/deferred: 2 |

### PR-Boundary Reviews

**Full code review (profile: full):**
| Severity | Count | Status breakdown |
|---|---|---|
| critical | 0 | — |
| major | 1 | fixed: 1 (recency decay never wired into read paths) |
| minor | 4 | fixed: 2 (coach shape→400, drills error leak); disagree/defer: 2 (Opening.name unique deferred; coachLog durability accepted) |
| nit | 2 | open: 2 (Board onMove test partly vacuous; types.shape test near-tautological) |

**Adversarial review (codex cross-model):** ran (diff > 200 lines → auto-fired).
| ID | Severity | Finding | Disposition |
|---|---|---|---|
| AX-1 | major | /api/coach trusted client `legalMoves` | **fixed** — server recomputes via chess-rules (N6) |
| AX-3 | major | Reveal not terminal (reveal −1 then play +1 = net 0) | **fixed** — reveal terminal, −1 once, auto-advance |
| AX-2 | major→minor | No post-validation of LLM prose vs move claims | disagree-with-evidence — deterministic core owns legality (N6 holds); input bounded. Deep output-validation deferred (post-MVP) |
| AX-4 | major→minor | /api/drills trusts client `correct`/`hintUsed` | disagree-with-evidence — single-user no-auth MVP (PRD §3), self-cheat only; `hintUsed` bounds added; server-authoritative recompute deferred |
| AX-5 | minor | Coordinate-notation PGN validates; raw string stored | defer — app uses derived SAN/FEN; curated content is clean |
| — | holds | chess-rules legality + state-isolation; seed N8 validate-before-write | confirmed sound |

**Professional review (craft grading):**
| Component | Overall grade | Notes |
|---|---|---|
| Deterministic core (chess-rules/types/content/prisma) | senior (chess-rules boundaries: staff) | CI-enforced purity test; tagged-union results |
| Feature modules (drill-engine/ai-coach/progress) | senior (ai-coach boundaries: staff) | CI-enforced explanation-only scan; clean state machine |
| Web/API (app/components) | senior (Board: high point) | DrillPage is the one mid-grade spot (size/state sprawl) |

Overall read: code a senior engineer would be comfortable owning; standout is the
deterministic-core / explanation-only-AI boundary enforced by CI-level tests.
Weakest seams: silent degradation in a few spots, hand-written cross-process
guards instead of a shared schema, and the DrillPage component's size.

**Plan alignment:** all 12 tasks implemented; no scope creep. Additions all trace
to requirements/integration (see Plan Deviations).

**Proof accounting:**
| Task | Criterion | Classification | Evidence |
|---|---|---|---|
| 1–5,7–9,11,12 | per task acceptance | proved | gate + named tests (chess-rules/seed/drill-engine/ai-coach/progress/e2e) |
| 6 | illegal move leaves FEN unchanged (component) | partially-proved | move-handling proved via `handleSquareMove`; component-render assertion is weak (nit) |
| 10 | dashboard data assembly | partially-proved | presentational + `suggestNextDrill` proved; `getProgressSummary` DB enrichment exercised only indirectly |

No `unproved` rows.

### Plan Deviations
| ID | Summary | Disposition | Rationale |
|---|---|---|---|
| D-001 | `applyMoveFromSquares`/`legalDestinations` added to chess-rules | disagree-with-evidence | square-based legality the planned Board consumer needs; within module scope |
| D-002 | GET /api/drills (load line + ids) | disagree-with-evidence | client page needs FK-valid ids; within api/drills scope |
| D-003 | /api/drills POST → updateProgressForAttempt | disagree-with-evidence | Task 9 specified "update fn called after attempts"; this is the wiring (N7) |
| D-004 | test infra (fileParallelism, worktree/tsbuildinfo excludes) | disagree-with-evidence | required for correct shared-DB test execution |

### Checkpoint
- Lint: PASS · Typecheck: PASS · Build: PASS · Tests: PASS (86)

### Retry stats
Local per-phase retries only; global circuit breaker never tripped. No task BLOCKED.

### Verdict: WARN

All 12 tasks done; all critical/major findings **fixed** (or severity-corrected to
minor with documented evidence); checkpoint green; plan aligned. WARN reflects
deferred minors worth a glance before a real-world (multi-user) deployment:
server-authoritative drill scoring, LLM-output post-validation, strict PGN
parsing, an `Opening.name` unique constraint, and two test-quality nits. None
block the MVP demo (PRD §16 DoD met).
