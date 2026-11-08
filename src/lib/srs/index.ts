/**
 * srs — spaced-repetition scheduling for repertoire cards (an SM-2 variant).
 *
 * Pure logic: no I/O, no randomness, so schedules are reproducible in tests.
 *
 * A drill outcome maps to a grade:
 *   - found first try          → good
 *   - found after a hint       → hard
 *   - revealed (3rd miss/hint) → again
 *
 * "again" is a lapse: the card comes back in 10 minutes and its interval
 * restarts. "hard" grows the interval slowly, "good" multiplies it by the
 * card's ease, "easy" a bit more. Ease never drops below 1.3.
 */

export type Grade = "again" | "hard" | "good" | "easy";

export interface SrsState {
  ease: number;
  /** Current interval in days (0 while still in first-day learning). */
  intervalDays: number;
  /** Successful reviews in a row since the last lapse. */
  reps: number;
  lapses: number;
  due: Date;
}

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const RELEARN_MINUTES = 10;
export const MAX_INTERVAL_DAYS = 365;

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export function newCardState(now: Date): SrsState {
  return { ease: DEFAULT_EASE, intervalDays: 0, reps: 0, lapses: 0, due: now };
}

/** Grade a resolved drill attempt. `hintUsed` 3 means the move was revealed. */
export function gradeFromAttempt(attempt: { correct: boolean; hintUsed: number }): Grade {
  if (!attempt.correct || attempt.hintUsed >= 3) return "again";
  if (attempt.hintUsed > 0) return "hard";
  return "good";
}

function addDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * MS_PER_DAY);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Next state after reviewing `state` with `grade` at `now`. */
export function schedule(state: SrsState, grade: Grade, now: Date): SrsState {
  if (grade === "again") {
    return {
      ease: round2(Math.max(MIN_EASE, state.ease - 0.2)),
      intervalDays: 0,
      reps: 0,
      lapses: state.lapses + (state.reps > 0 || state.intervalDays > 0 ? 1 : 0),
      due: new Date(now.getTime() + RELEARN_MINUTES * MS_PER_MINUTE),
    };
  }

  const easeDelta = grade === "hard" ? -0.15 : grade === "easy" ? 0.15 : 0;
  const ease = round2(Math.max(MIN_EASE, state.ease + easeDelta));

  let interval: number;
  if (state.reps === 0) {
    interval = grade === "easy" ? 4 : 1;
  } else if (state.reps === 1) {
    interval = grade === "hard" ? 2 : grade === "easy" ? 6 : 3;
  } else {
    const base = Math.max(1, state.intervalDays);
    const factor = grade === "hard" ? 1.2 : grade === "easy" ? ease * 1.3 : ease;
    interval = Math.max(base + 1, base * factor);
  }
  interval = Math.min(MAX_INTERVAL_DAYS, round2(interval));

  return {
    ease,
    intervalDays: interval,
    reps: state.reps + 1,
    lapses: state.lapses,
    due: addDays(now, interval),
  };
}

export interface StoredCardState extends SrsState {
  cardKey: string;
  createdAt: Date;
}

export interface QueueOptions {
  /** New cards allowed per day. */
  newPerDay: number;
  /** New cards already introduced today (cards whose first review was today). */
  introducedToday: number;
}

export interface ReviewQueue<C extends { cardKey: string }> {
  /** Due cards first (most overdue first), then new cards. */
  items: { card: C; isNew: boolean }[];
  dueCount: number;
  /** Unseen cards still waiting to be introduced (ignoring today's limit). */
  unseenCount: number;
  /** Cards seen at least once. */
  learnedCount: number;
}

/**
 * Build today's queue: every card that is due, then up to the remaining daily
 * allowance of new cards in repertoire order (shallowest first).
 */
export function buildReviewQueue<C extends { cardKey: string }>(
  cards: C[],
  stored: Map<string, StoredCardState>,
  now: Date,
  opts: QueueOptions,
): ReviewQueue<C> {
  const due: { card: C; at: number }[] = [];
  const unseen: C[] = [];
  let learned = 0;

  for (const card of cards) {
    const s = stored.get(card.cardKey);
    if (!s) {
      unseen.push(card);
      continue;
    }
    learned += 1;
    if (s.due.getTime() <= now.getTime()) due.push({ card, at: s.due.getTime() });
  }
  due.sort((a, b) => a.at - b.at);

  const allowance = Math.max(0, opts.newPerDay - opts.introducedToday);
  const fresh = unseen.slice(0, allowance);

  return {
    items: [
      ...due.map(({ card }) => ({ card, isNew: false })),
      ...fresh.map((card) => ({ card, isNew: true })),
    ],
    dueCount: due.length,
    unseenCount: unseen.length,
    learnedCount: learned,
  };
}

/** Local-midnight start of `now`'s day, for the daily new-card allowance. */
export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Short human label for an interval, e.g. "10 min", "1 day", "2 weeks". */
export function describeInterval(state: Pick<SrsState, "intervalDays" | "due">, now: Date): string {
  const ms = state.due.getTime() - now.getTime();
  if (ms < MS_PER_DAY) {
    const mins = Math.max(1, Math.round(ms / MS_PER_MINUTE));
    return mins >= 60 ? `${Math.round(mins / 60)} hr` : `${mins} min`;
  }
  const days = Math.round(ms / MS_PER_DAY);
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}
