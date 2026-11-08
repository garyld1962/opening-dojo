/**
 * training — the repertoire trainer's service layer: builds today's session
 * from the move tree + stored spaced-repetition state, and records reviews.
 *
 * DB-touching functions take a Prisma-like client so tests can run them
 * against the test database with an isolated user. All scheduling decisions
 * come from the pure `srs` module; all chess facts come from `repertoire`.
 */
import type { PrismaClient } from "@/generated/prisma";
import { openings } from "@/lib/opening-content";
import {
  buildRepertoire,
  findCard,
  hintsFor,
  randomLine,
  trainingCards,
  type LastMove,
  type Repertoire,
  type TrainingCard,
} from "@/lib/repertoire";
import {
  buildReviewQueue,
  describeInterval,
  gradeFromAttempt,
  newCardState,
  schedule,
  startOfDay,
  type Grade,
  type StoredCardState,
} from "@/lib/srs";
import type { Side } from "@/lib/types";

export type TrainingClient = Pick<PrismaClient, "reviewCard">;
export type TrainMode = "review" | "line";

/** New positions introduced per day across the whole repertoire. */
export const NEW_PER_DAY = Number(process.env.TRAIN_NEW_PER_DAY ?? 10) || 10;

let cachedReps: Repertoire[] | null = null;

/** Move trees for every curated opening, built once per process. */
export function repertoires(): Repertoire[] {
  if (!cachedReps) cachedReps = openings.map(buildRepertoire);
  return cachedReps;
}

function selectReps(slug: string | null | undefined): Repertoire[] {
  const all = repertoires();
  if (!slug || slug === "all") return all;
  return all.filter((r) => r.slug === slug);
}

/** Everything the client needs to quiz one position. */
export interface TrainItem {
  cardKey: string;
  slug: string;
  openingName: string;
  side: Side;
  fen: string;
  /** SAN moves played to reach this position. */
  path: string[];
  lastMove: LastMove | null;
  expectedSan: string;
  /** Squares of the expected move (for the reveal arrow and hint marker). */
  expectedFrom: string;
  expectedTo: string;
  /** Position after the expected move (the opponent reply is the next item's job). */
  fenAfter: string;
  explanation: string;
  theme: string | null;
  commonMistake: string | null;
  hint1: string;
  hint2: string;
  reveal: string;
  isNew: boolean;
}

export function toTrainItem(card: TrainingCard, isNew: boolean): TrainItem {
  const hints = hintsFor(card);
  return {
    cardKey: card.cardKey,
    slug: card.slug,
    openingName: card.openingName,
    side: card.side,
    fen: card.fen,
    path: card.path,
    lastMove: card.lastMove,
    expectedSan: card.expected.san,
    expectedFrom: card.expected.from,
    expectedTo: card.expected.to,
    fenAfter: card.expected.fenAfter,
    explanation: card.expected.content.explanation,
    theme: card.expected.content.theme ?? null,
    commonMistake: card.expected.content.commonMistake ?? null,
    hint1: hints.hint1,
    hint2: hints.hint2,
    reveal: hints.reveal,
    isNew,
  };
}

export interface TrainStats {
  due: number;
  /** New positions available today (capped by the daily allowance). */
  newToday: number;
  unseen: number;
  learned: number;
  total: number;
}

export interface TrainSession {
  mode: TrainMode;
  items: TrainItem[];
  stats: TrainStats;
}

async function loadStored(
  client: TrainingClient,
  userId: string,
  cardKeys: string[],
): Promise<Map<string, StoredCardState>> {
  const rows = await client.reviewCard.findMany({
    where: { userId, cardKey: { in: cardKeys } },
  });
  return new Map(
    rows.map((r) => [
      r.cardKey,
      {
        cardKey: r.cardKey,
        ease: r.ease,
        intervalDays: r.intervalDays,
        reps: r.reps,
        lapses: r.lapses,
        due: r.due,
        createdAt: r.createdAt,
      },
    ]),
  );
}

async function introducedToday(
  client: TrainingClient,
  userId: string,
  now: Date,
): Promise<number> {
  return client.reviewCard.count({
    where: { userId, createdAt: { gte: startOfDay(now) } },
  });
}

/**
 * Build a training session.
 * - `review`: everything due, then up to today's remaining new positions.
 * - `line`: one full line from move 1 with random opponent replies; every
 *   position on it is quizzed, due or not.
 */
export async function loadSession(
  client: TrainingClient,
  userId: string,
  opts: { slug?: string | null; mode: TrainMode; now?: Date; rng?: () => number },
): Promise<TrainSession> {
  const now = opts.now ?? new Date();
  const rng = opts.rng ?? Math.random;
  const reps = selectReps(opts.slug);
  const cards = reps.flatMap(trainingCards);
  const stored = await loadStored(
    client,
    userId,
    cards.map((c) => c.cardKey),
  );
  const today = await introducedToday(client, userId, now);
  const queue = buildReviewQueue(cards, stored, now, {
    newPerDay: NEW_PER_DAY,
    introducedToday: today,
  });
  const stats: TrainStats = {
    due: queue.dueCount,
    newToday: queue.items.filter((i) => i.isNew).length,
    unseen: queue.unseenCount,
    learned: queue.learnedCount,
    total: cards.length,
  };

  if (opts.mode === "line") {
    if (reps.length === 0) return { mode: "line", items: [], stats };
    const rep = reps[Math.min(reps.length - 1, Math.floor(rng() * reps.length))];
    const items = randomLine(rep, rng).map((c) => toTrainItem(c, !stored.has(c.cardKey)));
    return { mode: "line", items, stats };
  }

  return {
    mode: "review",
    items: queue.items.map(({ card, isNew }) => toTrainItem(card, isNew)),
    stats,
  };
}

export class UnknownCardError extends Error {}

export interface ReviewResult {
  cardKey: string;
  grade: Grade;
  intervalDays: number;
  due: Date;
  /** Human label for when the card comes back, e.g. "3 days". */
  nextReview: string;
}

/** Record one resolved quiz on a card and reschedule it. */
export async function recordReview(
  client: TrainingClient,
  userId: string,
  attempt: { cardKey: string; correct: boolean; hintUsed: number },
  now: Date = new Date(),
): Promise<ReviewResult> {
  const card = findCard(repertoires(), attempt.cardKey);
  if (!card) throw new UnknownCardError(`Unknown card ${attempt.cardKey}`);

  const existing = await client.reviewCard.findUnique({
    where: { userId_cardKey: { userId, cardKey: attempt.cardKey } },
  });
  const state = existing
    ? {
        ease: existing.ease,
        intervalDays: existing.intervalDays,
        reps: existing.reps,
        lapses: existing.lapses,
        due: existing.due,
      }
    : newCardState(now);

  const grade = gradeFromAttempt(attempt);
  const next = schedule(state, grade, now);
  const data = {
    ease: next.ease,
    intervalDays: next.intervalDays,
    reps: next.reps,
    lapses: next.lapses,
    due: next.due,
    lastReviewedAt: now,
    expectedSan: card.expected.san,
  };

  await client.reviewCard.upsert({
    where: { userId_cardKey: { userId, cardKey: attempt.cardKey } },
    create: { userId, cardKey: attempt.cardKey, openingSlug: card.slug, createdAt: now, ...data },
    update: data,
  });

  return {
    cardKey: attempt.cardKey,
    grade,
    intervalDays: next.intervalDays,
    due: next.due,
    nextReview: describeInterval(next, now),
  };
}

export interface OpeningTrainStats extends TrainStats {
  slug: string;
  name: string;
  side: Side;
}

/** Per-opening due/new/learned counts for the home and progress pages. */
export async function trainingStats(
  client: TrainingClient,
  userId: string,
  now: Date = new Date(),
): Promise<OpeningTrainStats[]> {
  const out: OpeningTrainStats[] = [];
  for (const rep of repertoires()) {
    const s = await loadSession(client, userId, { slug: rep.slug, mode: "review", now });
    out.push({ slug: rep.slug, name: rep.name, side: rep.side, ...s.stats });
  }
  return out;
}
