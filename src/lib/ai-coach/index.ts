/**
 * ai-coach — constrained Ollama client + prompt template (explanation-only).
 *
 * Receives board state and the legal moves supplied by chess-rules; it READS
 * `req.legalMoves` but NEVER determines legality or applies moves. Implemented
 * in Task 8 (Lane C).
 */
export { buildCoachPrompt, COACH_SYSTEM_PROMPT } from "./prompt";
export { callCoach, CoachError } from "./client";
export type { CallCoachOptions } from "./client";
export { coachLog, logCoachInteraction } from "./log";
export type { CoachLogEntry } from "./log";
