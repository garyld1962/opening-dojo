/**
 * Training session state machine (pure, no React) for the repertoire trainer.
 *
 * Each item is one position. The user gets up to two hints (or two wrong
 * moves) before the answer is revealed. A resolved item reports
 * `{ correct, hintUsed }`, which the server turns into a spaced-repetition
 * grade. In review mode, a position you missed comes back once more at the
 * end of the session, so you see it again while it's fresh.
 */
import { applyMove } from "@/lib/chess-rules";
import type { HintLevel } from "@/lib/types";
import type { TrainItem, TrainMode } from "@/lib/training";

export type ItemOutcome = "clean" | "hinted" | "missed";

export interface ResolvedResult {
  correct: boolean;
  /** Highest hint level reached (3 = revealed). */
  hintUsed: number;
  outcome: ItemOutcome;
}

export interface SessionState {
  mode: TrainMode;
  items: TrainItem[];
  index: number;
  hintLevel: HintLevel;
  status: "asking" | "resolved" | "done";
  /** Set when the current item resolves. */
  result: ResolvedResult | null;
  /** The last wrong move, for "Not quite" feedback. */
  wrongSan: string | null;
  /** Outcomes of every resolved item, in order. */
  log: { cardKey: string; outcome: ItemOutcome }[];
  /** Card keys already re-queued this session (so each comes back at most once). */
  requeued: string[];
}

export type SessionAction =
  | { type: "attempt"; san: string }
  | { type: "hint" }
  | { type: "next" }
  | { type: "load"; mode: TrainMode; items: TrainItem[] };

export function initSession(mode: TrainMode, items: TrainItem[]): SessionState {
  return {
    mode,
    items,
    index: 0,
    hintLevel: 0,
    status: items.length === 0 ? "done" : "asking",
    result: null,
    wrongSan: null,
    log: [],
    requeued: [],
  };
}

/** Whether `san` is the same move as the expected one in `fen` (normalized). */
export function isExpectedMove(item: Pick<TrainItem, "fen" | "expectedSan">, san: string): boolean {
  const a = applyMove(item.fen, san);
  const b = applyMove(item.fen, item.expectedSan);
  return a.ok && b.ok && a.san === b.san;
}

function resolve(state: SessionState, correct: boolean, hintUsed: number): SessionState {
  const outcome: ItemOutcome = !correct ? "missed" : hintUsed === 0 ? "clean" : "hinted";
  const item = state.items[state.index];
  return {
    ...state,
    status: "resolved",
    result: { correct, hintUsed, outcome },
    log: [...state.log, { cardKey: item.cardKey, outcome }],
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "load":
      return initSession(action.mode, action.items);

    case "attempt": {
      if (state.status !== "asking") return state;
      const item = state.items[state.index];
      if (isExpectedMove(item, action.san)) {
        return resolve({ ...state, wrongSan: null }, true, state.hintLevel);
      }
      const next = Math.min(3, state.hintLevel + 1) as HintLevel;
      if (next === 3) return resolve({ ...state, hintLevel: 3, wrongSan: action.san }, false, 3);
      return { ...state, hintLevel: next, wrongSan: action.san };
    }

    case "hint": {
      if (state.status !== "asking") return state;
      const next = Math.min(3, state.hintLevel + 1) as HintLevel;
      if (next === 3) return resolve({ ...state, hintLevel: 3, wrongSan: null }, false, 3);
      return { ...state, hintLevel: next, wrongSan: null };
    }

    case "next": {
      if (state.status !== "resolved") return state;
      const item = state.items[state.index];
      let items = state.items;
      let requeued = state.requeued;
      if (
        state.mode === "review" &&
        state.result?.outcome === "missed" &&
        !requeued.includes(item.cardKey)
      ) {
        items = [...items, { ...item, isNew: false }];
        requeued = [...requeued, item.cardKey];
      }
      const index = state.index + 1;
      return {
        ...state,
        items,
        requeued,
        index,
        hintLevel: 0,
        status: index >= items.length ? "done" : "asking",
        result: null,
        wrongSan: null,
      };
    }
  }
}

/**
 * Whether `next` continues straight on from `current` (same game, one
 * opponent reply later), so the board can animate instead of jumping.
 */
export function isContinuation(current: TrainItem, next: TrainItem): boolean {
  if (next.path.length !== current.path.length + 2) return false;
  const expected = [...current.path, current.expectedSan];
  return expected.every((san, i) => next.path[i] === san);
}

/** Path as numbered move-list tokens: ["1.", "e4", "c6", "2.", "d4", …]. */
export function formatPath(path: string[]): string {
  const parts: string[] = [];
  path.forEach((san, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(san);
  });
  return parts.join(" ");
}

export function summarize(log: SessionState["log"]): Record<ItemOutcome, number> {
  const out: Record<ItemOutcome, number> = { clean: 0, hinted: 0, missed: 0 };
  for (const entry of log) out[entry.outcome] += 1;
  return out;
}
