---
slug: opening-dojo
source_prd: docs/opening-dojo-prd.md
intent: Build the Opening Dojo MVP — a deterministic chess opening trainer (London System + Caro-Kann) with constrained AI explanation, per the PRD.
type: feature
---

# Opening Dojo — MVP Execution Plan

**Source:** docs/opening-dojo-prd.md

Build the MVP defined in the PRD: teach and drill the London System (White)
and Caro-Kann (Black), validate moves deterministically with chess.js,
persist progress, and provide an explanation-only AI coach backed by a local
Ollama endpoint. Definition of Done is PRD §16.

## Closed Decisions

- **Stack:** Next.js App Router + TypeScript + React, Tailwind + shadcn/ui, react-chessboard + chess.js, PostgreSQL + Prisma. Source: PRD §7.1.
- **Package manager:** pnpm. Source: operator decision.
- **Test framework:** Vitest (`vitest run`) with `tsc --noEmit` for typecheck. Source: operator decision.
- **Database:** PostgreSQL via `docker compose` service `db` with Prisma migrations, connected through `DATABASE_URL`. Source: operator decision (PRD §7.1).
- **AI Coach model:** Ollama on Sherlock at `http://localhost:11434` (OpenAI-compatible), server-side only, configured via `OLLAMA_BASE_URL`/`OLLAMA_MODEL`. Source: operator decision (PRD §7.1).
- **Data model:** the Prisma schema implements PRD §8 verbatim (Opening, Line, MoveExplanation, DrillAttempt, UserProgress) with derived types. Source: PRD §8.
- **Auth:** no login UI in MVP; `userId` fields resolve to a single seeded `DEMO_USER_ID`. Source: PRD §3 non-goals.
- **Module boundaries:** chess-rules owns correctness and ai-coach owns explanation, which never determines legality or mutates board state. Source: PRD §7.2, §9, §12.5.
- **Stockfish:** not built in MVP; the coach payload reserves an optional `evaluation` field only. Source: PRD §7.1, §13.
- **Content scope:** London primary line plus ≥3 Black responses, and Caro-Kann Advance/Classical/Exchange variations (Fantasy is content-only). Source: PRD §12.2, §12.3.

## Non-Negotiables (from PRD §12, §16)

- N1. Legal moves accepted, illegal moves rejected; board state + notation
  correct; board flips for Black. (§12.1)
- N2. London basic setup completable; every move has an explanation; ≥3 common
  Black responses supported. (§12.2)
- N3. Caro-Kann: 1.e4 c6 2.d4 d5 practiced; Advance, Classical, Exchange
  variations supported; each has explanation + common mistakes. (§12.3)
- N4. Drill engine: correct advances, incorrect → hint, repeated incorrect →
  reveal; attempts persisted. (§12.4)
- N5. AI coach receives current board state + curated lesson content; never
  recommends illegal moves; explains in plain English; responses logged. (§12.5)
- N6. Legal-move validation is deterministic (chess.js), never guessed by AI. (§16)
- N7. Progress visible over time (confidence score, weak lines). (§6.5, §16)
- N8. Every curated line validated through chess.js at seed time (§14.2).

---

## Waves

| Wave | Tasks | Focus | Execution |
|---|---|---|---|
| 1 | 1–5 | Scaffold, shared types, Prisma schema, chess-rules, curated content + seed | sequential |
| 2 | 6–9 | Lesson UI / Drill engine+page / AI coach / Progress — disjoint module lanes | parallel (4 teams) |
| 3 | 10–12 | Home + dashboard wiring, e2e happy path, final verification + traceability | sequential |

Merge order: Wave 1 completes before Wave 2 starts; all Wave 2 lanes complete
before Wave 3.

---

## --- WAVE 1 START ---

## Milestone: Foundation

## Task 1: Scaffold Next.js app + tooling

Create the Next.js (App Router, TypeScript) application at the repo root with
Tailwind, shadcn/ui, ESLint, and Vitest wired. Add `docker-compose.yml` with a
`db` Postgres service. Create `.env.example` documenting `DATABASE_URL`,
`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `DEMO_USER_ID`. Add `.gitignore`
(node_modules, .next, .env*, coverage).

`package.json` scripts: `dev`, `build`, `start`, `lint`,
`typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`,
`db:seed` (`tsx prisma/seed.ts`).

**Owner:** root manifests, config files.

**Acceptance:**
- `pnpm install` exits 0.
- `pnpm lint` exits 0 on the scaffold.
- `pnpm typecheck` exits 0.
- `pnpm build` exits 0.
- `pnpm test` exits 0 (a trivial sanity test passes).
- `docker compose config` exits 0 and defines service `db`.
- `.env.example` contains all four documented vars; `.env*` is gitignored.

## Task 2: Domain types + module skeleton

Create the `src/lib/` module folders from PRD §7.2 (`opening-content`,
`chess-rules`, `drill-engine`, `ai-coach`, `progress-tracking`) with an
`index.ts` each. Define shared TypeScript types in `src/lib/types.ts`:
`Side` (`'white' | 'black'`), and interfaces mirroring the data model
(Opening, Line, MoveExplanation, DrillAttempt, UserProgress) plus the
drill-engine view types (`DrillStep`, `DrillFeedback`, `HintLevel`) and the
ai-coach contract types (`CoachQuestion`, `CoachRequest`, `CoachResponse`).

**Owner:** `src/lib/types.ts`, module `index.ts` stubs.

**Acceptance:**
- `pnpm typecheck` exits 0.
- `src/lib/types.ts` exports all model + view + coach types named above.
- A Vitest type/shape test imports every module index without error.

## Task 3: Prisma schema + migration + demo user

Implement `prisma/schema.prisma` exactly per PRD §8 (Opening, Line,
MoveExplanation, DrillAttempt, UserProgress) with relations, an `id` PK and
`createdAt`/`updatedAt` where the PRD lists them, and a `User` model holding the
single `DEMO_USER_ID`. Generate the client and create the initial migration.
Add a migration/seed step that upserts the demo user.

**Owner:** `prisma/schema.prisma`, `prisma/migrations/**`.

**Acceptance:**
- `docker compose up -d db` then `pnpm prisma migrate dev` applies cleanly.
- `pnpm prisma generate` exits 0.
- All five PRD §8 models exist with the listed fields and correct relations
  (verified by a Vitest test querying the generated client types / a smoke
  query against the test DB).
- Demo user row exists after migrate+seed.

## Task 4: chess-rules wrapper (deterministic core)

Wrap chess.js in `src/lib/chess-rules`: functions for `legalMoves(fen)`,
`applyMove(fen, san) -> { ok, fenAfter, san } | { ok: false, reason }`,
`isLegal(fen, san)`, `validateLine(startingFen, pgn) -> { ok, fens[] } | error`,
and board-flip orientation helper. No React here — pure logic.

**Owner:** `src/lib/chess-rules/**`, its tests.

**Acceptance:**
- Vitest unit tests cover: a legal move applied returns correct `fenAfter` and
  SAN; an illegal move is rejected with a reason; `validateLine` accepts the
  London primary line PGN and rejects a deliberately illegal PGN.
- `pnpm test src/lib/chess-rules` exits 0.
- No import of `react` or `next` in this module (asserted by a test/grep).

## Task 5: Curated opening content + validated seed

Author the curated London + Caro-Kann content as structured data (openings,
lines as PGN, per-move explanations/themes/common-mistakes/hints/reveal) in
`src/lib/opening-content`. Content per PRD §5 and §6.2: London primary line +
≥3 Black responses (classical ...d5/...Nf6/...e6, ...c5, ...Bf5 or ...g6 or
...c6); Caro-Kann Advance, Classical, Exchange (+ Fantasy content). Write
`prisma/seed.ts` that validates **every** line's PGN through `chess-rules`
(N8) before inserting, deriving `fenBefore`/`fenAfter`/`san` per move.

**Owner:** `src/lib/opening-content/**`, `prisma/seed.ts`.

**Acceptance:**
- `pnpm db:seed` exits 0 against the migrated DB and is idempotent (re-runnable).
- Seed aborts with a clear error if any line's PGN is illegal (verified by a
  Vitest test feeding a bad line to the validator).
- After seed: ≥1 London opening with primary line + ≥3 Black-response lines;
  Caro-Kann with Advance/Classical/Exchange lines; every MoveExplanation row
  has non-empty `explanation` and valid `fenBefore`/`fenAfter`.

## --- WAVE 2 START ---

## Milestone: Feature modules (parallel lanes)

## Task 6: Interactive board + Lesson mode UI  [Lane A]

Build the reusable board component (`src/components/Board.tsx`) on
react-chessboard: drag-and-drop, legal-move highlights (from `chess-rules`),
illegal-move rejection, move-notation list, current-FEN tracking, board flip.
Build the Lesson page (`/openings/[slug]/lesson`) per PRD §11.3: board left,
explanation panel right, move list, Next/Previous controls, and an AI-coach
drawer that calls the coach endpoint over HTTP (Task 8 contract). Build the
Opening Overview page (§11.2).

**Owner:** `src/components/Board.tsx`, `src/app/openings/**` lesson/overview
routes, lesson-only UI. Read-only consumer of `chess-rules` and content.

**Acceptance:**
- Component tests (Vitest + Testing Library): legal move accepted updates FEN;
  illegal move rejected leaves FEN unchanged; board orientation flips.
- Lesson page renders the London basic setup sequence with an explanation for
  every move (N2); Next/Previous step through moves.
- `pnpm test src/components src/app/openings` exits 0.

## Task 7: Drill engine + Drill page  [Lane B]

Implement the drill state machine in `src/lib/drill-engine`: present position →
accept user move → validate via `chess-rules` → if correct play opponent reply
from the line → if incorrect escalate hint (L1 general → L2 strategic → L3
reveal+explanation) → persist `DrillAttempt` (N4). Implement scoring inputs per
PRD §6.5 (+3/+1/-1). Build the Drill page (`/openings/[slug]/drill`, §11.4):
board, prompt, feedback panel, hint button, progress indicator, "Explain this"
button (calls coach endpoint, Task 8 contract). Persist via a server action /
route under this lane's ownership.

**Owner:** `src/lib/drill-engine/**`, `src/app/openings/[slug]/drill/**`,
`src/app/api/drills/**` (attempt persistence).

**Acceptance:**
- Vitest tests: correct move advances and triggers opponent reply; first/second
  incorrect return L1/L2 hints; third reveals correct move + explanation;
  a `DrillAttempt` is persisted per attempt (against test DB).
- Drill works for a London line and a Caro-Kann line (N3 practice path).
- `pnpm test src/lib/drill-engine` exits 0.

## Task 8: AI Coach endpoint (constrained, explanation-only)  [Lane C]

Implement `src/lib/ai-coach`: an Ollama client (OpenAI-compatible chat) and the
constrained prompt template (PRD §9.1 system prompt). Build the API route
`src/app/api/coach/route.ts` that accepts a `CoachRequest` (opening name,
current FEN, legal moves from chess.js, expected move, attempted move, lesson
explanation, common mistake, optional evaluation, skill level — PRD §9.2),
calls the model server-side, and returns a `CoachResponse`. Log every
request/response (N5). The route must include legal moves from `chess-rules` in
the payload and must never assert legality itself (N5, N6).

**Owner:** `src/lib/ai-coach/**`, `src/app/api/coach/**`.

**Acceptance:**
- Vitest tests with a mocked Ollama transport: the built prompt contains the
  system prompt, the supplied FEN, legal moves, and lesson content; the client
  is called server-side; a response is returned and a log entry written.
- A test asserts the coach module never calls move-application/legality APIs
  (it only reads the provided legal-move list).
- Endpoint handles model-unavailable with a graceful error (no crash), verified
  by a test simulating transport failure.
- `pnpm test src/lib/ai-coach src/app/api/coach` exits 0.

## Task 9: Progress tracking module  [Lane D]

Implement `src/lib/progress-tracking`: compute/update `UserProgress`
(confidenceScore with +3/+1/-1 and recency decay per §6.5), aggregate per
opening/line, and surface "weak lines". Expose read functions for the dashboard
(Task 10) and an update function called after drill attempts (consumes the
`DrillAttempt` shape from Task 2 types, not Lane B internals).

**Owner:** `src/lib/progress-tracking/**`, `src/app/api/progress/**` (read).

**Acceptance:**
- Vitest tests: correct-first-try adds +3; correct-after-hint +1; reveal -1;
  decay lowers an un-practiced line's score; weak-line selection returns lowest
  confidence lines.
- Aggregates compute against the test DB without error.
- `pnpm test src/lib/progress-tracking` exits 0.

## --- WAVE 3 START ---

## Milestone: Integration & verification

## Task 10: Home + Progress dashboard wiring

Build the Home page (§11.1: choose repertoire, London/Caro-Kann cards, continue
practice, progress summary) and the Progress page (§11.5: overall confidence,
per-opening progress, weak lines, suggested next drill). Wire them to
`progress-tracking` (Task 9) and `opening-content`. Connect navigation between
Home → Overview → Lesson/Drill → Progress.

**Owner:** `src/app/page.tsx`, `src/app/progress/**`, shared nav.

**Acceptance:**
- Home lists both repertoires and a progress summary; Progress page renders
  confidence, per-opening progress, and weak lines (N7).
- Suggested-next-drill links to a real drill route.
- `pnpm test src/app` exits 0.

## Task 11: End-to-end happy path

Add an integration/e2e test (Vitest, against a seeded test DB; Next route
handlers exercised directly or via a lightweight harness) that walks the PRD
demo flow §10.2: open London lesson → make correct moves → make a wrong move →
get a hint → call coach (mocked model) → switch to Caro-Kann Advance drill →
record an attempt → progress updates.

**Owner:** `tests/e2e/**`.

**Acceptance:**
- The e2e test passes and exercises board, drill hints/reveal, coach call
  (mocked), persistence, and progress update in one flow.
- `pnpm test tests/e2e` exits 0.

## Task 12: Final verification + traceability

Run the full repo gate and produce a traceability table mapping each PRD §12
acceptance criterion and §16 DoD item (N1–N8) to the implementing files/tests.

**Owner:** `docs/plans/traceability.md`.

**Acceptance:**
- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` exits 0.
- `docs/plans/traceability.md` maps N1–N8 and every §12 sub-criterion to a file
  and a passing test; no criterion unmapped.

---

## Parallel Execution

**Mode:** parallel

Structure: sequential foundation (Wave 1) → 4 parallel lanes (Wave 2) →
sequential integration (Wave 3). Wave boundaries are the barriers below and are
marked in the plan body with `## --- WAVE N START ---`.

### Ownership

| Lane | Agent type | Tasks | Write scope | Shared-surface owner | Dependencies | Verification |
|---|---|---|---|---|---|---|
| Foundation | general-purpose | 1–5 | root manifests, `src/lib/types.ts`, `prisma/**`, `src/lib/chess-rules/**`, `src/lib/opening-content/**` | Foundation | none | `pnpm lint && pnpm typecheck && pnpm build && pnpm test` |
| A — Lesson UI | general-purpose | 6 | `src/components/Board.tsx`, `src/app/openings/**` (lesson/overview) | Foundation | Foundation | `pnpm test src/components src/app/openings` |
| B — Drill | general-purpose | 7 | `src/lib/drill-engine/**`, `src/app/openings/[slug]/drill/**`, `src/app/api/drills/**` | Foundation | Foundation | `pnpm test src/lib/drill-engine` |
| C — AI Coach | general-purpose | 8 | `src/lib/ai-coach/**`, `src/app/api/coach/**` | Foundation | Foundation | `pnpm test src/lib/ai-coach src/app/api/coach` |
| D — Progress | general-purpose | 9 | `src/lib/progress-tracking/**`, `src/app/api/progress/**` | Foundation | Foundation | `pnpm test src/lib/progress-tracking` |
| Integration | general-purpose | 10–12 | `src/app/page.tsx`, `src/app/progress/**`, `tests/e2e/**`, `docs/plans/traceability.md` | Integration | A, B, C, D | `pnpm lint && pnpm typecheck && pnpm build && pnpm test` |

### Barriers

| Barrier | After | Before | Reason |
|---|---|---|---|
| B1 | Wave 1 (Tasks 1–5) | Wave 2 (Tasks 6–9) | All lanes consume the shared types, Prisma schema/client, chess-rules, and seeded content produced in Wave 1. |
| B2 | Wave 2 (Tasks 6–9) | Wave 3 (Tasks 10–12) | Integration wiring and the e2e happy-path require all four feature modules complete. |

### Single-Owner Files

Written only by the Foundation lane in Wave 1; never edited by Wave 2 lanes:

- `package.json`, `pnpm-lock.yaml`
- `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`
- `src/lib/types.ts`
- `docker-compose.yml`, `next.config.*`, `tsconfig.json`, Tailwind config

### Parallel Safety Checks

- [ ] Wave 2 lane write scopes are disjoint — lanes A/B/C/D own separate directories and no file is edited by two lanes.
- [ ] Shared/public contracts (`src/lib/types.ts`, `chess-rules`, generated Prisma client, seeded content) are produced in Wave 1 before any Wave 2 consumer runs.
- [ ] Each Wave 2 lane has a focused verification command (see Ownership table).
- [ ] The Integration lane (Wave 3) owns the final root gates (`lint`/`typecheck`/`build`/`test`).
- [ ] Worker prompts include the multi-agent coordination warning: do not edit files outside the lane's write scope; the lesson/drill pages call the coach endpoint over HTTP rather than importing Lane C.
