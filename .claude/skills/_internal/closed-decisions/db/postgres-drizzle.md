---
id: db/postgres-drizzle
title: PostgreSQL + Drizzle ORM
---

# PostgreSQL + Drizzle ORM

Reusable closed-decision fragment for projects on PostgreSQL with
Drizzle ORM. Include in a plan via
`@closed-decisions/db/postgres-drizzle`.

- **Database:** PostgreSQL 15 or newer. Source: team standard.
- **ORM / query builder:** Drizzle ORM. Source: team standard.
- **Raw SQL:** avoid outside migrations; use Drizzle's query builder. Source: team standard.
- **Other ORMs:** forbidden. Do not add Prisma, TypeORM, Sequelize, Knex, or Kysely to dependencies. Source: team standard.
- **Migrations:** Drizzle Kit. Migrations live under `drizzle/` and are never hand-edited after a migration is applied in any environment beyond local. Source: Drizzle Kit convention.
- **Schema location:** `src/db/schema.ts` (single file) unless the domain is large enough to warrant `src/db/schema/<domain>.ts`. Source: team standard.
- **Connection:** `postgres` driver (node-postgres) via Drizzle's `drizzle-orm/postgres-js` adapter. Source: Drizzle-supported driver.
- **Connection pooling:** handled at the runtime boundary; do not create new pools per request. Source: performance guideline.
- **Transactions:** use Drizzle's `db.transaction(async tx => ...)`; do not mix transactional and non-transactional work in one call site. Source: Drizzle API.
