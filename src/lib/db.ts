import { PrismaClient } from "@/generated/prisma";

/**
 * Shared Prisma client singleton. Re-uses one client across hot reloads in
 * dev and across module imports in tests so we don't exhaust connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** The single demo user id (PRD §3 non-goals — no auth UI in MVP). */
export const DEMO_USER_ID =
  process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";
