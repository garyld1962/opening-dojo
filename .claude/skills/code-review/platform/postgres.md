---
id: platform/postgres
type: platform
title: PostgreSQL & ORM Patterns
extends: concept/data-integrity
triggers:
  paths:
    - "**/migrations/**"
    - "**/migrate/**"
    - "**/schema.*"
    - "**/drizzle/**"
    - "**/prisma/**"
    - "**/*.sql"
  imports:
    - "drizzle-orm"
    - "prisma"
    - "@prisma/client"
    - "typeorm"
    - "knex"
    - "sequelize"
    - "pg"
    - "postgres"
  always: false
  conditional: "Files contain SQL, ORM models, migration files, or database schema definitions"
severity_owner: false
---

# PostgreSQL & ORM Patterns — Platform Overlay

Extends `concept/data-integrity` with PostgreSQL-specific and ORM-specific smells that a conceptual data-integrity review cannot see.

Read CLAUDE.md and existing schema files before applying. Detect the ORM first (Prisma, Drizzle, TypeORM, Knex, Sequelize, raw pg) and adapt all examples to the ORM in use. Read 2-3 existing tables to learn the project's conventions before flagging deviations.

## Additional smells to hunt for

- **Adding NOT NULL column without default.** Adding a NOT NULL column to an existing table with rows fails the migration. Must provide a DEFAULT. In Prisma: a new non-optional field without `@default` on an existing model. In Drizzle: `.notNull()` without `.default()`. In raw SQL: `ALTER TABLE ... ADD COLUMN x NOT NULL` without `DEFAULT`.
- **Raw SQL without parameterized queries.** String interpolation in SQL queries enables injection. `db.query(\`SELECT * FROM users WHERE id = '\${userId}'\`)` is a vulnerability. Parameterize: `db.query('SELECT * FROM users WHERE id = $1', [userId])`. Exception: static SQL strings with no user input.
- **Missing index on foreign key columns.** FK columns without indexes cause slow JOINs and slow cascading deletes. In Drizzle: `.references()` without a corresponding `index()`. In raw SQL: `REFERENCES` without `CREATE INDEX`.
- **Multi-table writes without transaction.** Operations modifying multiple tables must be wrapped in a transaction. `await db.insert(orders)` followed by `await db.insert(orderItems)` without `db.transaction()` risks partial writes. Exception: read-only multi-table queries.
- **N+1 query patterns.** Querying inside a loop instead of using JOINs, includes, or batch queries. `for (const user of users) { const orders = await db.query(...) }` should be a single join or `include`.
- **Dropping columns or tables without safety net.** Irreversible data loss. Flag as high severity. Recommendation: confirm column/table is truly unused, backup strategy exists, and the migration is reversible or the drop is intentional.
- **Missing timestamps on new tables.** New tables should include created/updated timestamps matching the project's convention (column names, types, defaults). Detect the convention from existing tables before flagging.
- **Connection pool not configured.** Database clients using `new Pool({ connectionString })` without explicit pool settings (max, idleTimeout, connectionTimeout). Also check for connection leaks: clients acquired from pool but not released in a `finally` block.
- **Reserved words as column names.** PostgreSQL reserved words (`user`, `order`, `group`, `table`, `column`, `type`, `role`) as column names cause query errors unless quoted. Check the project's existing columns — if quoted reserved words are the convention, lower priority.
- **Schema types not exported to shared package.** If the project uses a shared package, database types should be exported there. `typeof table.$inferSelect` in the DB package should be re-exported from shared, not re-defined in consuming packages.
- **Migration ordering conflicts.** Two migrations with timestamps that could run in either order but have a dependency between them (one creates a table the other references). The filename timestamps must enforce the correct order.
- **Enum drift.** An application-level enum that doesn't match the database-level enum or check constraint. Values added to the code but not to the migration (or vice versa).
- **Missing `ON DELETE` behavior on foreign keys.** FK without explicit `ON DELETE` defaults to `RESTRICT`. If the application expects `CASCADE` or `SET NULL`, the missing clause is a bug that surfaces only when the parent row is deleted.
