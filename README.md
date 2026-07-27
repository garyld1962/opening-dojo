# Opening Dojo

[![CI](https://github.com/garyld1962/opening-dojo/actions/workflows/ci.yml/badge.svg)](https://github.com/garyld1962/opening-dojo/actions/workflows/ci.yml)

A chess opening trainer (London System as White, Caro-Kann as Black) built end-to-end by a multi-agent AI delivery pipeline — and the pipeline is the point. Every step is on the record in this repo: PRD → closed-decision plan → 3 execution waves with 4 parallel agent lanes in isolated worktrees → layered + adversarial cross-model review → requirements traceability matrix → gated final verification → postmortem. The app itself is a Next.js 15 / TypeScript / Prisma stack with a deterministic chess-rules core and an explanation-only AI coach.

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
