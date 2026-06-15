import type { CoachRequest, CoachResponse } from "@/lib/types";

/**
 * Structured log entry for a single coach interaction. Every request and every
 * response is recorded (PRD N5: all coach interactions are logged).
 */
export interface CoachLogEntry {
  at: string;
  direction: "request" | "response";
  model: string;
  /** Present on request entries. */
  request?: CoachRequest;
  /** Present on response entries. */
  response?: CoachResponse;
}

/**
 * In-memory log of coach interactions. Exported so tests can assert that an
 * entry was recorded. In production this is a rolling buffer alongside the
 * structured console output.
 */
export const coachLog: CoachLogEntry[] = [];

const MAX_ENTRIES = 500;

export function logCoachInteraction(entry: CoachLogEntry): void {
  coachLog.push(entry);
  if (coachLog.length > MAX_ENTRIES) {
    coachLog.splice(0, coachLog.length - MAX_ENTRIES);
  }
  // Structured console output for server-side observability.
  console.info("[ai-coach]", JSON.stringify(entry));
}
