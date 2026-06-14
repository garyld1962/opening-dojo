/**
 * Database seed.
 *
 * Task 3: upserts the single demo user (idempotent).
 * Task 5 extends this to seed curated opening content, validating every
 * line's PGN through chess-rules before insert (N8).
 */
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const DEMO_USER_ID =
  process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";

export async function seedDemoUser(client: PrismaClient = prisma) {
  await client.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: { id: DEMO_USER_ID },
  });
}

async function main() {
  await seedDemoUser();
  console.log(`Seeded demo user ${DEMO_USER_ID}`);
}

// Run as a script (tsx prisma/seed.ts) but not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
