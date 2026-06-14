/**
 * Shared domain types for Opening Dojo.
 *
 * Model interfaces mirror the Prisma data model (PRD §8). View/contract types
 * (`DrillStep`, `DrillFeedback`, `HintLevel`, `Coach*`) are the boundaries
 * between the deterministic core and the UI / AI-coach layers.
 *
 * This module is pure: no imports, no runtime dependencies.
 */

export type Side = "white" | "black";

// ---------------------------------------------------------------------------
// Data model (PRD §8)
// ---------------------------------------------------------------------------

/** PRD §8.1 */
export interface Opening {
  id: string;
  name: string;
  side: Side;
  description: string;
  difficulty: string;
  createdAt: Date;
  updatedAt: Date;
}

/** PRD §8.2 */
export interface Line {
  id: string;
  openingId: string;
  name: string;
  startingFen: string;
  moveSequencePgn: string;
  description: string;
  priority: number;
  active: boolean;
}

/** PRD §8.3 */
export interface MoveExplanation {
  id: string;
  lineId: string;
  moveNumber: number;
  san: string;
  fenBefore: string;
  fenAfter: string;
  explanation: string;
  theme: string | null;
  commonMistake: string | null;
  hintLevel1: string | null;
  hintLevel2: string | null;
  revealExplanation: string | null;
}

/** PRD §8.4 */
export interface DrillAttempt {
  id: string;
  userId: string;
  lineId: string;
  moveExplanationId: string | null;
  attemptedMove: string;
  expectedMove: string;
  correct: boolean;
  /** Highest hint level reached before the attempt resolved (0 = none). */
  hintUsed: number;
  createdAt: Date;
}

/** PRD §8.5 */
export interface UserProgress {
  id: string;
  userId: string;
  openingId: string | null;
  lineId: string | null;
  confidenceScore: number;
  completedLessons: number;
  lastPracticedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Drill-engine view types (PRD §6.3, §6.5)
// ---------------------------------------------------------------------------

/**
 * Hint escalation level.
 * 0 = none, 1 = general (L1), 2 = strategic (L2), 3 = reveal + explanation (L3).
 */
export type HintLevel = 0 | 1 | 2 | 3;

/** A single position the user must solve in a drill. */
export interface DrillStep {
  lineId: string;
  moveExplanationId: string;
  /** Half-move index within the line (0-based). */
  ply: number;
  /** Move number as displayed (PRD §8.3 `moveNumber`). */
  moveNumber: number;
  /** Side to move at this step. */
  sideToMove: Side;
  fenBefore: string;
  /** The correct move in SAN the user is expected to find. */
  expectedSan: string;
  /** Human-readable prompt shown above the board. */
  prompt: string;
}

/** Result of evaluating a single user attempt against a `DrillStep`. */
export interface DrillFeedback {
  correct: boolean;
  /** Hint level now in effect after this attempt. */
  hintLevel: HintLevel;
  /** Hint text, present when `hintLevel` is 1 or 2. */
  hint?: string;
  /** Correct move, revealed at `hintLevel` 3. */
  revealedSan?: string;
  /** Reveal explanation, present at `hintLevel` 3. */
  revealExplanation?: string;
  /** Opponent reply (SAN) played after a correct user move, if any. */
  opponentReplySan?: string;
  /** FEN after the user move (and opponent reply) was applied. */
  fenAfter?: string;
  /** Score delta for this attempt (+3 / +1 / -1 per PRD §6.5). */
  scoreDelta: number;
  /** True when this was the final step of the line. */
  complete: boolean;
}

// ---------------------------------------------------------------------------
// AI-coach contract types (PRD §6.4, §9)
// ---------------------------------------------------------------------------

/** Supported constrained question kinds (PRD §6.4). */
export type CoachQuestionKind =
  | "why-good"
  | "what-plan"
  | "what-wrong"
  | "what-watch-out"
  | "what-threatening"
  | "free";

export interface CoachQuestion {
  kind: CoachQuestionKind;
  /** Optional free-text elaboration (required when kind is "free"). */
  text?: string;
}

/** The constrained payload sent to the coach (PRD §9.2). */
export interface CoachRequest {
  openingName: string;
  /** Current board state (authoritative, from chess.js). */
  fen: string;
  /** Legal moves (SAN) supplied by chess-rules — the coach never derives these. */
  legalMoves: string[];
  expectedMove?: string;
  attemptedMove?: string;
  lessonExplanation?: string;
  commonMistake?: string;
  /** Optional Stockfish evaluation (reserved; not produced in MVP). */
  evaluation?: string;
  /** User skill level descriptor (e.g. "returning adult beginner"). */
  skillLevel: string;
  question?: CoachQuestion;
}

export interface CoachResponse {
  /** Plain-English explanation produced by the model. */
  answer: string;
  /** Model identifier that produced the answer. */
  model: string;
}
