# Opening Dojo — Traceability Matrix

Maps every PRD §12 acceptance criterion, the §16 Definition of Done, and the
plan's non-negotiables (N1–N8) to the implementing files and the passing tests
that prove them.

**Final gate (this run):** `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
→ all exit 0; **83 tests across 13 files pass**.

## Non-negotiables (plan §"Non-Negotiables", PRD §12/§16)

| # | Requirement | Implementation | Proving test(s) |
|---|---|---|---|
| N1 | Legal accepted, illegal rejected; board state + notation correct; flips for Black (§12.1) | `src/lib/chess-rules/index.ts` (`applyMove`, `applyMoveFromSquares`, `legalDestinations`, `boardOrientation`), `src/components/Board.tsx` | `src/lib/chess-rules/chess-rules.test.ts` (legal/illegal/squares/destinations/orientation); `src/components/Board.test.tsx` (legal updates FEN, illegal unchanged, flip, MoveList) |
| N2 | London basic setup completable; every move explained; ≥3 Black responses (§12.2) | `src/lib/opening-content/index.ts` (London: classical + …c5/…Bf5/…g6); `src/app/openings/[slug]/lesson/page.tsx` | `prisma/seed.test.ts` (London opening + ≥4 lines; every MoveExplanation non-empty); `src/app/openings/lesson.test.tsx` (explanation for every move) |
| N3 | Caro-Kann 1.e4 c6 2.d4 d5; Advance/Classical/Exchange; each explained + mistakes (§12.3) | `src/lib/opening-content/index.ts` (Caro primary, Advance, Classical, Exchange, Fantasy) | `prisma/seed.test.ts` (Advance/Classical/Exchange present); `tests/e2e/happy-path.test.ts` (Caro-Kann Advance drill) |
| N4 | Correct advances; incorrect → hint; repeated → reveal; attempts persisted (§12.4) | `src/lib/drill-engine/index.ts` (`evaluateAttempt`, hint ladder, scoring); `src/app/api/drills/route.ts` | `src/lib/drill-engine/drill-engine.test.ts` (advance, L1/L2/reveal, persistence); `tests/e2e/happy-path.test.ts` |
| N5 | Coach gets board state + curated content; never illegal moves; plain English; responses logged (§12.5) | `src/lib/ai-coach/{prompt,client,log}.ts`, `src/app/api/coach/route.ts` | `src/lib/ai-coach/ai-coach.test.ts` (prompt contains FEN/legal moves/lesson; log written; no legality APIs); `src/app/api/coach/route.test.ts` (200/503/400) |
| N6 | Legal-move validation deterministic (chess.js), never guessed by AI (§16) | `src/lib/chess-rules/index.ts` owns legality; `src/lib/ai-coach/*` only reads `req.legalMoves` | `src/lib/ai-coach/ai-coach.test.ts` (source-scan: no `applyMove`/`isLegal`/`legalMoves(` in coach) |
| N7 | Progress visible over time (confidence, weak lines) (§6.5, §16) | `src/lib/progress-tracking/index.ts` (scoreDelta, decay, weakLines, aggregates); `src/app/api/progress/route.ts`; `src/app/api/drills/route.ts` (wires attempt → progress); `src/app/progress/*` | `src/lib/progress-tracking/index.test.ts`; `src/app/progress/dashboard.test.tsx`; `tests/e2e/happy-path.test.ts` (progress updates after attempt) |
| N8 | Every curated line validated through chess.js at seed (§14.2) | `src/lib/chess-rules/index.ts` (`validateLineDetailed`); `prisma/seed.ts` (`buildLineMoves` validates all lines up front, aborts on illegal) | `prisma/seed.test.ts` (accepts all curated lines; aborts on illegal line; ply/content mismatch) |

## PRD §12 sub-criteria

### 12.1 Chess Board
| Criterion | File | Test |
|---|---|---|
| Make legal moves | `chess-rules` `applyMove`/`applyMoveFromSquares`; `Board.tsx` | `chess-rules.test.ts`, `Board.test.tsx` |
| Illegal moves rejected | `chess-rules` (`ok:false`); `Board.tsx` (returns false) | `chess-rules.test.ts`, `Board.test.tsx` |
| Board state updates | `Board.tsx` (`fen`/`onMove`) | `Board.test.tsx` |
| Move notation displayed | `Board.tsx` `MoveList` | `Board.test.tsx` |
| Board flips for Black | `chess-rules` `boardOrientation`; `Board.tsx` `orientation` | `chess-rules.test.ts`, `Board.test.tsx` |

### 12.2 London System Lesson
| Criterion | File | Test |
|---|---|---|
| Complete basic setup | `opening-content` (London classical line); `lesson/page.tsx` | `lesson.test.tsx`, `seed.test.ts` |
| Each move explained | `opening-content` (per-ply `explanation`); seed `buildLineMoves` | `seed.test.ts`, `lesson.test.tsx` |
| ≥3 Black responses | `opening-content` (…c5/…Bf5/…g6 + classical) | `seed.test.ts` (≥4 lines) |

### 12.3 Caro-Kann Lesson
| Criterion | File | Test |
|---|---|---|
| Practice 1.e4 c6 2.d4 d5 | `opening-content` (Caro primary) | `seed.test.ts`, e2e |
| Advance/Classical/Exchange supported | `opening-content` | `seed.test.ts` |
| Each has explanation + mistakes | `opening-content` (`commonMistake` per variation) | `seed.test.ts` (non-empty explanations) |

### 12.4 Drill Engine
| Criterion | File | Test |
|---|---|---|
| Correct moves advance | `drill-engine` `evaluateAttempt` | `drill-engine.test.ts`, e2e |
| Incorrect → hints | `drill-engine` (L1/L2) | `drill-engine.test.ts` |
| Repeated incorrect → reveal | `drill-engine` (L3 reveal) | `drill-engine.test.ts` |
| Attempts persisted | `api/drills/route.ts` | `drill-engine.test.ts`, e2e |

### 12.5 AI Coach
| Criterion | File | Test |
|---|---|---|
| Receives current board state | `ai-coach/prompt.ts` (FEN in payload) | `ai-coach.test.ts` |
| Uses curated lesson content | `ai-coach/prompt.ts` (lessonExplanation/commonMistake) | `ai-coach.test.ts` |
| No illegal-move recommendations | system prompt + reads `req.legalMoves` only | `ai-coach.test.ts` (source scan) |
| Explains in plain English | `COACH_SYSTEM_PROMPT` (PRD §9.1 verbatim) | `ai-coach.test.ts` |
| Response logged | `ai-coach/log.ts` (`coachLog`, structured console) | `ai-coach.test.ts` |

## §16 Definition of Done

| DoD item | Backed by |
|---|---|
| Learn London basic setup | N2 — lesson page + content |
| Practice London vs common Black responses | N2/N4 — ≥3 response lines + drill engine |
| Learn Caro-Kann basic structure | N3 — Caro primary + overview/lesson |
| Practice Caro-Kann vs White variations | N3/N4 — Advance/Classical/Exchange + drill (e2e) |
| Receive hints after mistakes | N4 — drill-engine hint ladder |
| Ask the AI coach for explanations | N5 — `/api/coach` + coach drawer |
| See progress over time | N7 — progress-tracking + dashboard + drill→progress wiring |

## Notes / deferred (PRD-sanctioned non-goals)

- **Stockfish evaluation:** not built in MVP (PRD §7.1, §13); `CoachRequest.evaluation` is reserved/optional only.
- **Auth:** no login UI (PRD §3); all `userId` resolve to the seeded `DEMO_USER_ID`.
- **Caro-Kann Fantasy variation:** content-only (seeded with explanations + a Black reply), not a required drill path.
