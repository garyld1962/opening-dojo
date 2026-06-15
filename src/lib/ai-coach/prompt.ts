import type { CoachQuestion, CoachRequest } from "@/lib/types";

/**
 * System prompt — verbatim from PRD §9.1. Constrains the model to explanation
 * only: it must not invent lines or assert legality, and must use the supplied
 * board state, legal moves, lesson, and evaluation data.
 */
export const COACH_SYSTEM_PROMPT =
  "You are a chess opening coach for adult returning players. " +
  "Explain moves clearly and practically. Do not invent opening lines. " +
  "Do not claim a move is legal unless it is provided as legal by the chess engine. " +
  "Use the supplied board state, legal moves, opening lesson, and evaluation data. " +
  "Prefer plain English over chess jargon.";

function describeQuestion(question: CoachQuestion | undefined): string {
  if (!question) {
    return "(none — give a brief general explanation of the position)";
  }
  const text = question.text ? ` — ${question.text}` : "";
  return `${question.kind}${text}`;
}

/**
 * Build the constrained prompt sent to the model. Only fields that are present
 * on the request are embedded, so the model is never fed empty placeholders.
 * The coach reads `legalMoves` but never derives or validates them.
 */
export function buildCoachPrompt(req: CoachRequest): {
  system: string;
  user: string;
} {
  const lines: string[] = [];
  lines.push(`Opening: ${req.openingName}`);
  lines.push(`Board state (FEN): ${req.fen}`);
  lines.push(`Legal moves (from chess engine): ${req.legalMoves.join(", ")}`);

  if (req.expectedMove !== undefined) {
    lines.push(`Expected move: ${req.expectedMove}`);
  }
  if (req.attemptedMove !== undefined) {
    lines.push(`Move the player attempted: ${req.attemptedMove}`);
  }
  if (req.lessonExplanation !== undefined) {
    lines.push(`Opening lesson: ${req.lessonExplanation}`);
  }
  if (req.commonMistake !== undefined) {
    lines.push(`Common mistake here: ${req.commonMistake}`);
  }
  if (req.evaluation !== undefined) {
    lines.push(`Engine evaluation: ${req.evaluation}`);
  }

  lines.push(`Player skill level: ${req.skillLevel}`);
  lines.push(`Question (${describeQuestion(req.question)}).`);

  return { system: COACH_SYSTEM_PROMPT, user: lines.join("\n") };
}
