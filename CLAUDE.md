# Opening Dojo

Chess opening trainer (London System + Caro-Kann) for returning adult players.
Deterministic chess logic owns correctness; AI is constrained to explanation.

**Source of truth:** `docs/opening-dojo-prd.md`.

## Stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS + shadcn/ui
- react-chessboard + chess.js (deterministic move legality)
- PostgreSQL + Prisma ORM
- Vitest for unit/integration tests
- AI Coach: Ollama on Sherlock (`http://localhost:11434`, OpenAI-compatible API) — server-side only, explanation-only

## Architecture

Module boundaries (see PRD §7.2). The deterministic chess system owns
correctness; the AI owns explanation and never mutates board state or
determines move legality.

- `opening-content` — curated openings/lines as PGN, validated on seed
- `chess-rules` — chess.js wrappers; legal moves, FEN, SAN
- `drill-engine` — drill state machine, hint escalation, scoring
- `ai-coach` — constrained prompt + Ollama client; receives board state, never authoritative
- `progress-tracking` — confidence scoring, decay
- `repertoire` — merges an opening's curated lines into one move tree keyed by
  position (transpositions merge); rejects two different trained-side answers
  in the same position; yields training cards and random lines
- `srs` — pure spaced-repetition scheduler (SM-2 variant) and daily queue
- `training` — trainer service: builds sessions from tree + `ReviewCard` rows,
  records reviews; `ReviewCard.cardKey` = `<slug>:<position key>` so it
  survives content re-seeds
- `lesson-ui` / drill / progress pages

## Commands

All commands run from the repo root. Package manager: **pnpm**.

| Purpose | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Build | `pnpm build` |
| Test (all) | `pnpm test` |
| Test (single file) | `pnpm test <path>` |
| DB up (local Postgres) | `docker compose up -d db` |
| Prisma generate | `pnpm prisma generate` |
| Prisma migrate (dev) | `pnpm prisma migrate dev` |
| Seed openings | `pnpm db:seed` |
| New migration (no TTY) | `pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql` then `pnpm exec prisma migrate deploy` |

**Final verification gate** (run before any task is considered done):

```
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

`package.json` scripts must provide: `dev`, `build`, `lint`, `typecheck`
(`tsc --noEmit`), `test` (`vitest run`), `db:seed`.

## Conventions

- Curated opening lines are stored as PGN and validated through chess.js
  during seed import — never trust hand-authored FENs without validation.
  `repertoire.test.ts` also builds every opening's tree, so a line that
  contradicts another line's answer fails the tests.
- UI must work on phones: boards size to the viewport (see `Board`), taps
  move pieces (`resolveTap`), primary actions are at least 44px tall.
- The AI Coach endpoint receives legal moves from chess.js; it must not
  invent lines or assert legality. All coach responses are logged.
- Server-side AI calls only. The Ollama endpoint is never exposed to the client.
- Secrets (DB URL, model endpoint) live in `.env` / `.env.local`; never commit them.
