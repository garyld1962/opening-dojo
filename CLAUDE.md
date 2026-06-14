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

**Final verification gate** (run before any task is considered done):

```
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

`package.json` scripts must provide: `dev`, `build`, `lint`, `typecheck`
(`tsc --noEmit`), `test` (`vitest run`), `db:seed`.

## Conventions

- Curated opening lines are stored as PGN and validated through chess.js
  during seed import — never trust hand-authored FENs without validation.
- The AI Coach endpoint receives legal moves from chess.js; it must not
  invent lines or assert legality. All coach responses are logged.
- Server-side AI calls only. The Ollama endpoint is never exposed to the client.
- Secrets (DB URL, model endpoint) live in `.env` / `.env.local`; never commit them.
