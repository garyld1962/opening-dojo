/**
 * progress-tracking — confidence scoring (+3/+1/-1), recency decay, weak-line
 * surfacing, and aggregates. Task 9 (Lane D).
 *
 * Consumes the `DrillAttempt` shape from `@/lib/types`, never drill-engine
 * internals. DB-touching functions take a Prisma-like client so they can be
 * exercised against the test DB with an isolated user.
 */
import type { PrismaClient } from "@/generated/prisma";
import type { UserProgress } from "@/lib/types";

/** Minimal slice of the Prisma client this module depends on. */
export type ProgressClient = Pick<PrismaClient, "userProgress">;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_WEEK = 7;

/**
 * Score delta for a single attempt (PRD §6.5).
 * - correct, no hint  → +3
 * - correct, any hint → +1
 * - incorrect (incl. a reveal, which counts as incorrect) → -1
 * Pure.
 */
export function scoreDelta(attempt: {
  correct: boolean;
  hintUsed: number;
}): number {
  if (!attempt.correct) return -1;
  return attempt.hintUsed === 0 ? 3 : 1;
}

/**
 * Recency decay: a line loses confidence the longer it sits un-practiced.
 *
 * Rule: subtract 1 point for every full week (7 days) elapsed between
 * `lastPracticedAt` and `now`. Never returns below 0. A null
 * `lastPracticedAt` (never practiced) or a future timestamp incurs no decay.
 * Pure.
 */
export function applyDecay(
  score: number,
  lastPracticedAt: Date | null,
  now: Date,
): number {
  if (lastPracticedAt === null) return Math.max(0, score);
  const elapsedMs = now.getTime() - lastPracticedAt.getTime();
  if (elapsedMs <= 0) return Math.max(0, score);
  const weeksIdle = Math.floor(elapsedMs / MS_PER_DAY / DAYS_PER_WEEK);
  return Math.max(0, score - weeksIdle);
}

/**
 * Apply one attempt to the user's per-line progress, upserting on
 * (userId, lineId). `confidenceScore` moves by `scoreDelta`, `lastPracticedAt`
 * is set to now, and `completedLessons` increments on a clean first-try
 * correct answer (correct && hintUsed === 0). Returns the updated row.
 */
export async function updateProgressForAttempt(
  client: ProgressClient,
  attempt: {
    userId: string;
    lineId: string;
    openingId?: string;
    correct: boolean;
    hintUsed: number;
  },
  now: Date = new Date(),
): Promise<UserProgress> {
  const delta = scoreDelta(attempt);
  const masteredNow = attempt.correct && attempt.hintUsed === 0 ? 1 : 0;

  const row = await client.userProgress.upsert({
    where: {
      userId_lineId: { userId: attempt.userId, lineId: attempt.lineId },
    },
    create: {
      userId: attempt.userId,
      lineId: attempt.lineId,
      openingId: attempt.openingId ?? null,
      confidenceScore: delta,
      completedLessons: masteredNow,
      lastPracticedAt: now,
    },
    update: {
      confidenceScore: { increment: delta },
      completedLessons: { increment: masteredNow },
      lastPracticedAt: now,
    },
  });

  return row as UserProgress;
}

/**
 * The user's weakest lines (lowest confidence first), capped at `limit`.
 * Only rows scoped to a line are considered.
 */
export async function weakLines(
  client: ProgressClient,
  userId: string,
  limit = 3,
): Promise<UserProgress[]> {
  const rows = await client.userProgress.findMany({
    where: { userId, lineId: { not: null } },
    orderBy: { confidenceScore: "asc" },
    take: limit,
  });
  return rows as UserProgress[];
}

/**
 * Mean confidence across the user's line-scoped progress rows. Returns 0 when
 * the user has no progress yet.
 */
export async function overallConfidence(
  client: ProgressClient,
  userId: string,
): Promise<number> {
  const rows = await client.userProgress.findMany({
    where: { userId, lineId: { not: null } },
    select: { confidenceScore: true },
  });
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, r) => sum + r.confidenceScore, 0);
  return total / rows.length;
}

export interface OpeningProgress {
  openingId: string;
  /** Mean confidence across the opening's line-scoped progress rows. */
  averageConfidence: number;
  /** Number of progress rows (lines touched) under this opening. */
  lineCount: number;
  /** Sum of completed (first-try mastered) lessons under this opening. */
  completedLessons: number;
}

/**
 * Per-opening aggregate of the user's line progress. Rows without an
 * `openingId` are skipped (they cannot be attributed to an opening).
 */
export async function progressByOpening(
  client: ProgressClient,
  userId: string,
): Promise<OpeningProgress[]> {
  const rows = await client.userProgress.findMany({
    where: { userId, lineId: { not: null }, openingId: { not: null } },
    select: {
      openingId: true,
      confidenceScore: true,
      completedLessons: true,
    },
  });

  const byOpening = new Map<
    string,
    { sum: number; lineCount: number; completedLessons: number }
  >();
  for (const r of rows) {
    const key = r.openingId as string;
    const agg = byOpening.get(key) ?? {
      sum: 0,
      lineCount: 0,
      completedLessons: 0,
    };
    agg.sum += r.confidenceScore;
    agg.lineCount += 1;
    agg.completedLessons += r.completedLessons;
    byOpening.set(key, agg);
  }

  return [...byOpening.entries()].map(([openingId, agg]) => ({
    openingId,
    averageConfidence: agg.lineCount === 0 ? 0 : agg.sum / agg.lineCount,
    lineCount: agg.lineCount,
    completedLessons: agg.completedLessons,
  }));
}
