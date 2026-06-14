import { describe, it, expect } from "vitest";
import type {
  Side,
  Opening,
  Line,
  MoveExplanation,
  DrillAttempt,
  UserProgress,
  DrillStep,
  DrillFeedback,
  HintLevel,
  CoachQuestion,
  CoachRequest,
  CoachResponse,
} from "@/lib/types";

describe("module skeleton", () => {
  it("imports every src/lib module index without error", async () => {
    const mods = await Promise.all([
      import("@/lib/chess-rules"),
      import("@/lib/opening-content"),
      import("@/lib/drill-engine"),
      import("@/lib/ai-coach"),
      import("@/lib/progress-tracking"),
    ]);
    expect(mods).toHaveLength(5);
    for (const m of mods) expect(m).toBeTypeOf("object");
  });

  it("exposes the documented domain + view + coach types", () => {
    // Compile-time assertion: constructing values of each type proves the
    // export surface exists and is shaped as the PRD specifies.
    const side: Side = "white";
    const hint: HintLevel = 2;

    const opening: Opening = {
      id: "o1",
      name: "London System",
      side,
      description: "",
      difficulty: "beginner",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const line: Line = {
      id: "l1",
      openingId: opening.id,
      name: "Primary",
      startingFen: "start",
      moveSequencePgn: "1. d4 d5",
      description: "",
      priority: 1,
      active: true,
    };
    const move: MoveExplanation = {
      id: "m1",
      lineId: line.id,
      moveNumber: 1,
      san: "d4",
      fenBefore: "a",
      fenAfter: "b",
      explanation: "Claim the centre.",
      theme: null,
      commonMistake: null,
      hintLevel1: null,
      hintLevel2: null,
      revealExplanation: null,
    };
    const attempt: DrillAttempt = {
      id: "a1",
      userId: "u1",
      lineId: line.id,
      moveExplanationId: move.id,
      attemptedMove: "d4",
      expectedMove: "d4",
      correct: true,
      hintUsed: 0,
      createdAt: new Date(0),
    };
    const progress: UserProgress = {
      id: "p1",
      userId: "u1",
      openingId: opening.id,
      lineId: line.id,
      confidenceScore: 3,
      completedLessons: 1,
      lastPracticedAt: new Date(0),
    };
    const step: DrillStep = {
      lineId: line.id,
      moveExplanationId: move.id,
      ply: 0,
      moveNumber: 1,
      sideToMove: side,
      fenBefore: "a",
      expectedSan: "d4",
      prompt: "White to move.",
    };
    const feedback: DrillFeedback = {
      correct: true,
      hintLevel: hint,
      scoreDelta: 3,
      complete: false,
    };
    const question: CoachQuestion = { kind: "why-good" };
    const request: CoachRequest = {
      openingName: opening.name,
      fen: "a",
      legalMoves: ["d4", "Nf3"],
      skillLevel: "returning adult beginner",
      question,
    };
    const response: CoachResponse = { answer: "Because…", model: "test" };

    expect([
      opening,
      line,
      move,
      attempt,
      progress,
      step,
      feedback,
      request,
      response,
    ]).toHaveLength(9);
  });
});
