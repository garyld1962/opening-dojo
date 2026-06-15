import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../../generated/prisma";
import { overallConfidence, weakLines } from "./index";

/**
 * Proves recency decay (PRD §6.5) is applied at READ time in the aggregation
 * paths — not just unit-tested in isolation. Raw vs decayed ordering differ,
 * so a passing assertion can only hold if decay is wired in.
 */
const prisma = new PrismaClient();
const USER = "test-user-decay-wiring";

const NOW = new Date("2026-06-14T00:00:00.000Z");
const FOUR_WEEKS_AGO = new Date(NOW.getTime() - 28 * 24 * 60 * 60 * 1000);

let lineAId: string;
let lineBId: string;

describe("decay is applied at read time", () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: USER },
      update: {},
      create: { id: USER },
    });
    const lines = await prisma.line.findMany({ take: 2 });
    lineAId = lines[0].id;
    lineBId = lines[1].id;

    // Line A: high raw score (10) but stale (4 weeks) → decays to 6.
    await prisma.userProgress.upsert({
      where: { userId_lineId: { userId: USER, lineId: lineAId } },
      update: { confidenceScore: 10, lastPracticedAt: FOUR_WEEKS_AGO },
      create: {
        userId: USER,
        lineId: lineAId,
        confidenceScore: 10,
        lastPracticedAt: FOUR_WEEKS_AGO,
      },
    });
    // Line B: lower raw score (8) but fresh → no decay.
    await prisma.userProgress.upsert({
      where: { userId_lineId: { userId: USER, lineId: lineBId } },
      update: { confidenceScore: 8, lastPracticedAt: NOW },
      create: {
        userId: USER,
        lineId: lineBId,
        confidenceScore: 8,
        lastPracticedAt: NOW,
      },
    });
  });

  afterAll(async () => {
    await prisma.userProgress.deleteMany({ where: { userId: USER } });
    await prisma.user.delete({ where: { id: USER } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("overallConfidence uses decayed scores ((6+8)/2 = 7, not raw 9)", async () => {
    const mean = await overallConfidence(prisma, USER, NOW);
    expect(mean).toBe(7);
  });

  it("weakLines orders by decayed score (stale line A ranks weakest)", async () => {
    const weak = await weakLines(prisma, USER, 2, NOW);
    expect(weak[0].lineId).toBe(lineAId); // 6 (decayed) < 8
    expect(weak[0].confidenceScore).toBe(6);
    expect(weak[1].lineId).toBe(lineBId);
  });
});
