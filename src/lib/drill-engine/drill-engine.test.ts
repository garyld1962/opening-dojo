/**
 * drill-engine tests (PRD §6.3, §6.5, §12.4).
 *
 * DB isolation: a dedicated test user ('test-user-lane-b') owns every attempt
 * written here; afterAll deletes those attempts and the user. We only READ
 * seeded Opening/Line/MoveExplanation rows (never seed, modify, or delete them)
 * and never touch the demo user.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Side } from "@/lib/types";
import {
  buildDrillSteps,
  evaluateAttempt,
  toAttemptPayload,
  type DrillLine,
} from "@/lib/drill-engine";

const TEST_USER_ID = "test-user-lane-b";

/** Load the highest-priority active line for an opening as a DrillLine. */
async function loadDrillLine(openingName: string): Promise<DrillLine> {
  const opening = await prisma.opening.findFirst({
    where: { name: openingName },
    include: {
      lines: {
        where: { active: true },
        orderBy: { priority: "asc" },
        include: { moves: { orderBy: { moveNumber: "asc" } } },
      },
    },
  });
  if (!opening) throw new Error(`Opening not seeded: ${openingName}`);
  const line = opening.lines[0];
  if (!line) throw new Error(`No active line for: ${openingName}`);
  return {
    line: {
      id: line.id,
      startingFen: line.startingFen,
      moveSequencePgn: line.moveSequencePgn,
    },
    trainedSide: opening.side as Side,
    moves: line.moves,
  };
}

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: { id: TEST_USER_ID },
    update: {},
  });
});

afterAll(async () => {
  await prisma.drillAttempt.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

describe("buildDrillSteps", () => {
  it("emits one step per trained-side ply for a London (white) line", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);

    expect(steps.length).toBeGreaterThan(0);
    // Every step is the trained side to move, carries real DB ids, and uses
    // even-indexed plies (white moves at ply 0,2,4… in a from-start line).
    for (const s of steps) {
      expect(s.sideToMove).toBe("white");
      expect(s.lineId).toBe(drill.line.id);
      expect(s.moveExplanationId).toBeTruthy();
      expect(s.prompt).toContain("White to move");
    }
    // First trained move of the London is 1.d4.
    expect(steps[0].expectedSan).toBe("d4");
  });

  it("emits one step per trained-side ply for a Caro-Kann (black) line", async () => {
    const drill = await loadDrillLine("Caro-Kann Defense");
    const steps = buildDrillSteps(drill);

    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(s.sideToMove).toBe("black");
      expect(s.prompt).toContain("Black to move");
    }
    // First trained move of the Caro-Kann is 1...c6.
    expect(steps[0].expectedSan).toBe("c6");
  });
});

describe("evaluateAttempt — scoring and advancement", () => {
  it("correct first try scores +3 and plays the opponent reply", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);
    const step = steps[0]; // 1.d4

    const fb = evaluateAttempt(drill, step, "d4", 0, steps);
    expect(fb.correct).toBe(true);
    expect(fb.scoreDelta).toBe(3);
    expect(fb.opponentReplySan).toBe("d5"); // Black's 1...d5 reply
    expect(fb.fenAfter).toBeTruthy();
    expect(fb.complete).toBe(false);
  });

  it("normalizes the attempt through chess.js before comparing", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);
    const step = steps[0]; // expects "d4"
    // Long-algebraic "d2d4" and SAN "d4" both normalize to the same move and
    // must match the expected SAN.
    expect(evaluateAttempt(drill, step, "d2d4", 0, steps).correct).toBe(true);
    expect(evaluateAttempt(drill, step, "d4", 0, steps).correct).toBe(true);
    // A genuinely different legal move must not pass.
    expect(evaluateAttempt(drill, step, "e4", 0, steps).correct).toBe(false);
  });

  it("correct after a hint scores +1", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);
    const step = steps[0];

    const fb = evaluateAttempt(drill, step, "d4", 1, steps);
    expect(fb.correct).toBe(true);
    expect(fb.scoreDelta).toBe(1);
  });

  it("marks the final trained step complete", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);
    const last = steps[steps.length - 1];

    const fb = evaluateAttempt(drill, last, last.expectedSan, 0, steps);
    expect(fb.correct).toBe(true);
    expect(fb.complete).toBe(true);
    expect(fb.opponentReplySan).toBeUndefined();
  });
});

describe("evaluateAttempt — hint escalation", () => {
  it("escalates 0→1→2→3 on repeated misses, revealing at L3 with -1", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);
    // Use a step that has curated hints (the signature Bf4 step at ply 4).
    const bf4Step = steps.find((s) => s.expectedSan === "Bf4");
    expect(bf4Step).toBeDefined();
    const step = bf4Step!;
    const wrong = "a3"; // legal but not the expected move

    const miss1 = evaluateAttempt(drill, step, wrong, 0, steps);
    expect(miss1.correct).toBe(false);
    expect(miss1.hintLevel).toBe(1);
    expect(miss1.hint).toBeTruthy();
    expect(miss1.scoreDelta).toBe(0);

    const miss2 = evaluateAttempt(drill, step, wrong, 1, steps);
    expect(miss2.hintLevel).toBe(2);
    expect(miss2.hint).toBeTruthy();
    expect(miss2.scoreDelta).toBe(0);

    const miss3 = evaluateAttempt(drill, step, wrong, 2, steps);
    expect(miss3.hintLevel).toBe(3);
    expect(miss3.revealedSan).toBe("Bf4");
    expect(miss3.revealExplanation).toBeTruthy();
    expect(miss3.scoreDelta).toBe(-1);
  });

  it("escalates hints for a Caro-Kann line too", async () => {
    const drill = await loadDrillLine("Caro-Kann Defense");
    const steps = buildDrillSteps(drill);
    const step = steps[0]; // 1...c6

    const miss1 = evaluateAttempt(drill, step, "e5", 0, steps);
    expect(miss1.correct).toBe(false);
    expect(miss1.hintLevel).toBe(1);
    expect(miss1.hint).toBeTruthy();

    const reveal = evaluateAttempt(drill, step, "e5", 2, steps);
    expect(reveal.hintLevel).toBe(3);
    expect(reveal.revealedSan).toBe("c6");
    expect(reveal.scoreDelta).toBe(-1);
  });
});

describe("persistence", () => {
  it("persists a DrillAttempt per attempt against the test DB", async () => {
    const drill = await loadDrillLine("London System");
    const steps = buildDrillSteps(drill);
    const step = steps[0];

    const fb = evaluateAttempt(drill, step, "d4", 0, steps);
    const payload = toAttemptPayload(TEST_USER_ID, step, fb, "d4");

    const row = await prisma.drillAttempt.create({ data: payload });
    expect(row.id).toBeTruthy();
    expect(row.userId).toBe(TEST_USER_ID);
    expect(row.lineId).toBe(step.lineId);
    expect(row.moveExplanationId).toBe(step.moveExplanationId);
    expect(row.correct).toBe(true);
    expect(row.hintUsed).toBe(0);

    const found = await prisma.drillAttempt.findUnique({ where: { id: row.id } });
    expect(found).not.toBeNull();
  });

  it("persists an incorrect attempt with the reached hint level", async () => {
    const drill = await loadDrillLine("Caro-Kann Defense");
    const steps = buildDrillSteps(drill);
    const step = steps[0];

    const fb = evaluateAttempt(drill, step, "e5", 2, steps); // reveal at L3
    const payload = toAttemptPayload(TEST_USER_ID, step, fb, "e5");
    const row = await prisma.drillAttempt.create({ data: payload });

    expect(row.correct).toBe(false);
    expect(row.hintUsed).toBe(3);
    expect(row.expectedMove).toBe("c6");
    expect(row.attemptedMove).toBe("e5");
  });
});
