import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../src/generated/prisma";
import { seedDemoUser } from "./seed";

const DEMO_USER_ID =
  process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";

const prisma = new PrismaClient();

describe("prisma schema (PRD §8)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exposes all five PRD §8 models on the generated client", () => {
    for (const model of [
      "opening",
      "line",
      "moveExplanation",
      "drillAttempt",
      "userProgress",
    ] as const) {
      expect(prisma[model]).toBeDefined();
    }
  });

  it("smoke-queries every model without error", async () => {
    const counts = await Promise.all([
      prisma.opening.count(),
      prisma.line.count(),
      prisma.moveExplanation.count(),
      prisma.drillAttempt.count(),
      prisma.userProgress.count(),
      prisma.user.count(),
    ]);
    expect(counts.every((c) => typeof c === "number")).toBe(true);
  });

  it("upserts the demo user idempotently", async () => {
    await seedDemoUser(prisma);
    await seedDemoUser(prisma); // second run must not throw / duplicate
    const user = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
    expect(user).not.toBeNull();
    expect(user?.id).toBe(DEMO_USER_ID);
  });
});
