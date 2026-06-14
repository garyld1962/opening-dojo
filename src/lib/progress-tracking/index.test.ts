import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  scoreDelta,
  applyDecay,
  updateProgressForAttempt,
  weakLines,
  overallConfidence,
  progressByOpening,
} from "@/lib/progress-tracking";

const TEST_USER_ID = "test-user-lane-d";

/** Seeded fixtures, resolved in beforeAll for FK validity. */
let openingId: string;
let lineIds: string[] = [];

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: { id: TEST_USER_ID },
    update: {},
  });

  // Pick an opening that has at least 3 lines so the per-opening aggregate
  // assertions are exact.
  const openings = await prisma.opening.findMany();
  if (openings.length === 0) throw new Error("expected seeded openings");

  let chosen: { id: string; lineIds: string[] } | null = null;
  for (const o of openings) {
    const lines = await prisma.line.findMany({
      where: { openingId: o.id },
      take: 3,
      orderBy: { id: "asc" },
    });
    if (lines.length >= 3) {
      chosen = { id: o.id, lineIds: lines.map((l) => l.id) };
      break;
    }
  }
  if (!chosen) throw new Error("expected an opening with at least 3 seeded lines");
  openingId = chosen.id;
  lineIds = chosen.lineIds;
});

afterAll(async () => {
  await prisma.userProgress.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.drillAttempt.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.delete({ where: { id: TEST_USER_ID } });
});

describe("scoreDelta", () => {
  it("correct first try → +3", () => {
    expect(scoreDelta({ correct: true, hintUsed: 0 })).toBe(3);
  });
  it("correct after hint → +1", () => {
    expect(scoreDelta({ correct: true, hintUsed: 1 })).toBe(1);
    expect(scoreDelta({ correct: true, hintUsed: 2 })).toBe(1);
  });
  it("incorrect / reveal → -1", () => {
    expect(scoreDelta({ correct: false, hintUsed: 0 })).toBe(-1);
    expect(scoreDelta({ correct: false, hintUsed: 3 })).toBe(-1);
  });
});

describe("applyDecay", () => {
  const now = new Date("2026-06-14T00:00:00Z");

  it("no decay when never practiced", () => {
    expect(applyDecay(10, null, now)).toBe(10);
  });
  it("no decay within the first week", () => {
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(applyDecay(10, sixDaysAgo, now)).toBe(10);
  });
  it("lowers score for an un-practiced line (3 weeks idle → -3)", () => {
    const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    expect(applyDecay(10, threeWeeksAgo, now)).toBe(7);
  });
  it("never drops below zero", () => {
    const longAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    expect(applyDecay(2, longAgo, now)).toBe(0);
  });
  it("no decay for a future lastPracticedAt", () => {
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(applyDecay(5, future, now)).toBe(5);
  });
});

describe("updateProgressForAttempt", () => {
  it("correct-first-try adds +3 and counts a completed lesson", async () => {
    const lineId = lineIds[0];
    const row = await updateProgressForAttempt(prisma, {
      userId: TEST_USER_ID,
      lineId,
      openingId,
      correct: true,
      hintUsed: 0,
    });
    expect(row.confidenceScore).toBe(3);
    expect(row.completedLessons).toBe(1);
    expect(row.lastPracticedAt).toBeInstanceOf(Date);
  });

  it("correct-after-hint adds +1 (no completed lesson) on the existing row", async () => {
    const lineId = lineIds[0];
    const row = await updateProgressForAttempt(prisma, {
      userId: TEST_USER_ID,
      lineId,
      openingId,
      correct: true,
      hintUsed: 1,
    });
    // 3 (first test) + 1 here
    expect(row.confidenceScore).toBe(4);
    expect(row.completedLessons).toBe(1);
  });

  it("reveal (incorrect) subtracts 1", async () => {
    const lineId = lineIds[0];
    const row = await updateProgressForAttempt(prisma, {
      userId: TEST_USER_ID,
      lineId,
      openingId,
      correct: false,
      hintUsed: 3,
    });
    // 4 - 1
    expect(row.confidenceScore).toBe(3);
    expect(row.completedLessons).toBe(1);
  });
});

describe("weakLines", () => {
  it("returns lowest-confidence lines first", async () => {
    // line[0] already at 3 from the block above. Make line[1] low, line[2] high.
    await updateProgressForAttempt(prisma, {
      userId: TEST_USER_ID,
      lineId: lineIds[1],
      openingId,
      correct: false,
      hintUsed: 0,
    }); // -1
    await updateProgressForAttempt(prisma, {
      userId: TEST_USER_ID,
      lineId: lineIds[2],
      openingId,
      correct: true,
      hintUsed: 0,
    }); // +3
    await updateProgressForAttempt(prisma, {
      userId: TEST_USER_ID,
      lineId: lineIds[2],
      openingId,
      correct: true,
      hintUsed: 0,
    }); // +3 → 6

    const weak = await weakLines(prisma, TEST_USER_ID, 3);
    expect(weak).toHaveLength(3);
    const scores = weak.map((w) => w.confidenceScore);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(weak[0].lineId).toBe(lineIds[1]); // the weakest line
    // Decay is applied at read time and clamps confidence at 0, so the
    // mistake-driven -1 surfaces as 0 (still the lowest of {0, 3, 6}).
    expect(weak[0].confidenceScore).toBe(0);
  });

  it("respects the limit", async () => {
    const weak = await weakLines(prisma, TEST_USER_ID, 1);
    expect(weak).toHaveLength(1);
    expect(weak[0].lineId).toBe(lineIds[1]);
  });
});

describe("aggregates", () => {
  it("overallConfidence averages decayed line scores", async () => {
    // Raw line0=3, line1=-1, line2=6. Read-time decay clamps -1 → 0 (rows are
    // fresh, so no time decay), giving mean = (3 + 0 + 6) / 3 = 3.
    const avg = await overallConfidence(prisma, TEST_USER_ID);
    expect(avg).toBeCloseTo(3, 6);
  });

  it("progressByOpening aggregates decayed scores", async () => {
    const byOpening = await progressByOpening(prisma, TEST_USER_ID);
    expect(byOpening.length).toBeGreaterThanOrEqual(1);
    const entry = byOpening.find((o) => o.openingId === openingId);
    expect(entry).toBeDefined();
    expect(entry!.lineCount).toBe(3);
    expect(entry!.averageConfidence).toBeCloseTo(3, 6); // (3 + 0 + 6) / 3
  });

  it("overallConfidence is 0 for a user with no progress", async () => {
    const avg = await overallConfidence(prisma, "test-user-lane-d-absent");
    expect(avg).toBe(0);
  });
});
