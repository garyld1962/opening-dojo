# Opening Dojo

[![CI](https://github.com/garyld1962/opening-dojo/actions/workflows/ci.yml/badge.svg)](https://github.com/garyld1962/opening-dojo/actions/workflows/ci.yml)

A chess opening trainer (London System as White, Caro-Kann as Black) built end-to-end by a multi-agent AI delivery pipeline — and the pipeline is the point. Every step is on the record in this repo: PRD → closed-decision plan → 3 execution waves with 4 parallel agent lanes in isolated worktrees → layered + adversarial cross-model review → requirements traceability matrix → gated final verification → postmortem. The app itself is a Next.js 15 / TypeScript / Prisma stack with a deterministic chess-rules core and an explanation-only AI coach.

## Repertoire trainer (Nov 2026 refresh)

- **Train** (`/train`): every curated line is merged into one move tree per opening. Each position where it's your move is a card, scheduled with spaced repetition (SM-2 variant): find the move first try and it comes back in 1 day, then 3, then longer; need a hint and it comes back sooner; miss it and it returns in 10 minutes and again at the end of the session. Ten new positions are introduced per day (`TRAIN_NEW_PER_DAY`).
- **Play a line**: walk one line from move 1 with the opponent's replies chosen at random from the tree, so you see the Advance one day and the Panov the next.
- **Deeper content**: the Caro-Kann lines now run to move 6–10 and cover 2.Nc3, 2.c4, 2.d3, the Panov and 3.Nd2; London sidelines are extended.
- **Every line is reachable**: the opening page lists all lines, each with its own lesson and drill.
- **Phone-ready**: the board fills the screen width on a phone (and fits the height on a short screen), tap a piece then a square to move, large buttons pinned to the bottom of the screen.

### Try it on your phone

Run it on a machine on your home network and open it from the phone's browser:

```bash
pnpm build && pnpm start -H 0.0.0.0     # then browse to http://<that machine's LAN IP>:3000
```

From the phone, "Add to Home Screen" gives it an app icon. For use away from home, put it behind Tailscale or deploy it (any Next.js host plus a Postgres database).

## The numbers

- **12/12 tasks** completed across 3 milestones / 3 waves (Wave 2 = 4 parallel lanes), 22 commits
- **86 tests / 15 files**, final gate `lint && typecheck && build && test` → all exit 0 (CI runs the same gate)
- **5 review passes** (2 breakpoint, full, craft, adversarial cross-model) — every critical/major finding fixed, including a reveal→replay scoring exploit only the adversarial pass caught

## The receipts

- [PRD](docs/opening-dojo-prd.md) — what was asked for
- [Plan](docs/plans/opening-dojo.plan.md) — closed-decision task breakdown
- [Traceability matrix](docs/plans/traceability.md) — requirement → task → commit → test
- [Execution report](docs/runs/opening-dojo-20260614/execution-report.md) — per-task commits, review findings and dispositions
- [Postmortem](docs/runs/opening-dojo-20260614/postmortem.md) — what worked, what broke down

## Run it (60 seconds)

```bash
docker compose up -d          # Postgres 16
cp .env.example .env
pnpm install
pnpm exec prisma migrate deploy && pnpm exec prisma db seed
pnpm test                     # 86 tests
pnpm dev                      # http://localhost:3000
```

The AI coach speaks to any OpenAI-compatible endpoint (defaults to local Ollama, configured in `.env`); everything else — move legality, drills, progress — is deterministic and runs without it.

## License

MIT
