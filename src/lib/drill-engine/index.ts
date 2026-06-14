/**
 * drill-engine — drill state machine, hint escalation, scoring (PRD §6.3, §6.5).
 *
 * Pure logic: no React, no Next, no I/O. Consumes chess-rules for legality and
 * move normalization; never determines legality itself beyond delegating to it.
 *
 * A drill walks one curated line. The TRAINED side's moves are the ones the
 * user must find; the opponent's moves are played automatically. `DrillStep`s
 * are therefore emitted only for plies where the trained side is to move, and
 * each step's `expectedSan` is the curated move at that ply.
 */
import type {
  DrillFeedback,
  DrillStep,
  HintLevel,
  Line,
  MoveExplanation,
  Side,
} from "@/lib/types";
import { applyMove, validateLineDetailed } from "@/lib/chess-rules";

/** A line plus its per-ply curated explanations, as loaded from the DB. */
export interface DrillLine {
  line: Pick<Line, "id" | "startingFen" | "moveSequencePgn">;
  /** Trained side for the line's opening (white = London, black = Caro-Kann). */
  trainedSide: Side;
  /** MoveExplanation rows for the line (any order; keyed by 1-based ply). */
  moves: MoveExplanation[];
}

function prompt(side: Side, openingHint: string): string {
  const who = side === "white" ? "White" : "Black";
  return `${who} to move — find the ${openingHint} move`;
}

/**
 * Build the ordered list of positions the user must solve for a line.
 *
 * Each ply is validated via `validateLineDetailed`; a `DrillStep` is emitted
 * only where the trained side is to move. The step carries the DB ids
 * (`lineId`, `moveExplanationId`) needed to persist attempts.
 */
export function buildDrillSteps(drill: DrillLine): DrillStep[] {
  const { line, trainedSide, moves } = drill;
  const validated = validateLineDetailed(line.startingFen, line.moveSequencePgn);
  if (!validated.ok) {
    throw new Error(`Cannot build drill for line ${line.id}: ${validated.error}`);
  }

  // Key explanations by 1-based ply index (MoveExplanation.moveNumber).
  const byPly = new Map<number, MoveExplanation>();
  for (const me of moves) byPly.set(me.moveNumber, me);

  const sideLabel = trainedSide === "white" ? "London" : "Caro-Kann";
  const steps: DrillStep[] = [];

  validated.moves.forEach((vm, i) => {
    if (vm.sideToMove !== trainedSide) return;
    const moveNumber = i + 1; // 1-based ply
    const explanation = byPly.get(moveNumber);
    if (!explanation) {
      throw new Error(
        `Missing MoveExplanation for line ${line.id} at ply ${moveNumber}`,
      );
    }
    steps.push({
      lineId: line.id,
      moveExplanationId: explanation.id,
      ply: i,
      moveNumber,
      sideToMove: vm.sideToMove,
      fenBefore: vm.fenBefore,
      expectedSan: vm.san,
      prompt: prompt(trainedSide, sideLabel),
    });
  });

  return steps;
}

/**
 * Whether two SAN strings refer to the same move in `fen`, normalized through
 * chess.js (so "Bf4" / "Bcf4" / decorations all reconcile). Returns false if
 * either is illegal in the position.
 */
function sameMove(fen: string, a: string, b: string): boolean {
  const ra = applyMove(fen, a);
  const rb = applyMove(fen, b);
  return ra.ok && rb.ok && ra.san === rb.san;
}

function explanationFor(
  moves: MoveExplanation[],
  step: DrillStep,
): MoveExplanation | undefined {
  return moves.find((m) => m.id === step.moveExplanationId);
}

/**
 * Evaluate a single user attempt against the current `DrillStep`.
 *
 * Correct (SAN matches the expected move, normalized):
 *   - scoreDelta = +3 if no hint had been used (currentHintLevel === 0), else +1
 *   - includes the opponent reply (next ply SAN) when one exists, plus the FEN
 *     after the user move and opponent reply
 *   - complete = true when this was the last trained step
 *
 * Incorrect (hint escalation, scoreDelta 0 except reveal):
 *   - 0 → 1: general hint (hintLevel1)
 *   - 1 → 2: strategic hint (hintLevel2)
 *   - 2 → 3: reveal correct move + revealExplanation, scoreDelta -1
 */
export function evaluateAttempt(
  drill: DrillLine,
  step: DrillStep,
  attemptedSan: string,
  currentHintLevel: HintLevel,
  steps?: DrillStep[],
): DrillFeedback {
  const allSteps = steps ?? buildDrillSteps(drill);
  const explanation = explanationFor(drill.moves, step);

  const correct = sameMove(step.fenBefore, attemptedSan, step.expectedSan);

  if (correct) {
    const idx = allSteps.findIndex((s) => s.moveExplanationId === step.moveExplanationId);
    const isLast = idx === allSteps.length - 1;

    // Apply the user move, then the opponent reply (the ply immediately after
    // this trained ply, if any), to produce the resulting board state.
    const afterUser = applyMove(step.fenBefore, step.expectedSan);
    let fenAfter = afterUser.ok ? afterUser.fenAfter : undefined;
    let opponentReplySan: string | undefined;

    if (!isLast && afterUser.ok) {
      const validated = validateLineDetailed(
        drill.line.startingFen,
        drill.line.moveSequencePgn,
      );
      if (validated.ok) {
        const replyPly = validated.moves[step.ply + 1];
        if (replyPly && replyPly.sideToMove !== step.sideToMove) {
          opponentReplySan = replyPly.san;
          fenAfter = replyPly.fenAfter;
        }
      }
    }

    return {
      correct: true,
      hintLevel: currentHintLevel,
      opponentReplySan,
      fenAfter,
      scoreDelta: currentHintLevel === 0 ? 3 : 1,
      complete: isLast,
    };
  }

  // Incorrect: escalate the hint level.
  const nextLevel = Math.min(currentHintLevel + 1, 3) as HintLevel;

  if (nextLevel === 1) {
    return {
      correct: false,
      hintLevel: 1,
      hint: explanation?.hintLevel1 ?? undefined,
      scoreDelta: 0,
      complete: false,
    };
  }
  if (nextLevel === 2) {
    return {
      correct: false,
      hintLevel: 2,
      hint: explanation?.hintLevel2 ?? undefined,
      scoreDelta: 0,
      complete: false,
    };
  }
  // nextLevel === 3: reveal.
  return {
    correct: false,
    hintLevel: 3,
    revealedSan: step.expectedSan,
    revealExplanation: explanation?.revealExplanation ?? undefined,
    scoreDelta: -1,
    complete: false,
  };
}

/** Payload shape for persisting an attempt (matches DrillAttempt create input). */
export interface AttemptPayload {
  userId: string;
  lineId: string;
  moveExplanationId: string | null;
  attemptedMove: string;
  expectedMove: string;
  correct: boolean;
  hintUsed: number;
}

/**
 * Build the persistence payload for a resolved attempt. `hintUsed` is the
 * highest hint level reached before the attempt resolved (0 = solved first try).
 */
export function toAttemptPayload(
  userId: string,
  step: DrillStep,
  feedback: DrillFeedback,
  attemptedSan: string,
): AttemptPayload {
  return {
    userId,
    lineId: step.lineId,
    moveExplanationId: step.moveExplanationId,
    attemptedMove: attemptedSan,
    expectedMove: step.expectedSan,
    correct: feedback.correct,
    hintUsed: feedback.hintLevel,
  };
}
