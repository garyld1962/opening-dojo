import { describe, it, expect } from "vitest";
import { buildDrillSteps, evaluateAttempt, type DrillLine } from "./index";
import { openings } from "@/lib/opening-content";
import { validateLineDetailed } from "@/lib/chess-rules";
import type { MoveExplanation } from "@/lib/types";

/**
 * Reveal is terminal (PRD §6.5): reaching the reveal charges -1 exactly once;
 * the revealed move can never be replayed for +1, and further attempts at hint
 * level 3 don't re-score. Built from curated content, no DB needed.
 */
function makeLondonDrill(): { drill: DrillLine; steps: ReturnType<typeof buildDrillSteps> } {
  const line = openings[0].lines[0]; // London classical
  const v = validateLineDetailed(line.startingFen, line.pgn);
  if (!v.ok) throw new Error("fixture line invalid");
  const moves: MoveExplanation[] = v.moves.map((mv, i) => ({
    id: `m${i + 1}`,
    lineId: "L",
    moveNumber: i + 1,
    san: mv.san,
    fenBefore: mv.fenBefore,
    fenAfter: mv.fenAfter,
    explanation: line.moves[i].explanation,
    theme: line.moves[i].theme ?? null,
    commonMistake: line.moves[i].commonMistake ?? null,
    hintLevel1: line.moves[i].hintLevel1 ?? null,
    hintLevel2: line.moves[i].hintLevel2 ?? null,
    revealExplanation: line.moves[i].revealExplanation ?? null,
  }));
  const drill: DrillLine = {
    line: { id: "L", startingFen: line.startingFen, moveSequencePgn: line.pgn },
    trainedSide: "white",
    moves,
  };
  return { drill, steps: buildDrillSteps(drill) };
}

describe("reveal is terminal", () => {
  it("charges -1 once at reveal and advances; replaying the move earns 0", () => {
    const { drill, steps } = makeLondonDrill();
    const step = steps[0]; // White to move, expected d4

    // Two wrong (but legal) guesses → hints, no score.
    expect(evaluateAttempt(drill, step, "Nf3", 0, steps).scoreDelta).toBe(0);
    expect(evaluateAttempt(drill, step, "Nf3", 1, steps).scoreDelta).toBe(0);

    // Third miss → reveal: -1, carries advance info so the UI moves on.
    const reveal = evaluateAttempt(drill, step, "Nf3", 2, steps);
    expect(reveal.correct).toBe(false);
    expect(reveal.hintLevel).toBe(3);
    expect(reveal.scoreDelta).toBe(-1);
    expect(reveal.revealedSan).toBe(step.expectedSan);
    expect(reveal.fenAfter).toBeTruthy(); // advances past the revealed move

    // Playing the now-revealed move at hint level 3 earns nothing (no +1).
    const replay = evaluateAttempt(drill, step, step.expectedSan, 3, steps);
    expect(replay.correct).toBe(true);
    expect(replay.scoreDelta).toBe(0);

    // Net for a revealed step is -1, never 0.
    expect(reveal.scoreDelta + replay.scoreDelta).toBe(-1);
  });
});
