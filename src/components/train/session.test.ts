import { describe, expect, it } from "vitest";
import { openings } from "@/lib/opening-content";
import { buildRepertoire, randomLine, trainingCards } from "@/lib/repertoire";
import { toTrainItem } from "@/lib/training";
import {
  formatPath,
  initSession,
  isContinuation,
  isExpectedMove,
  sessionReducer,
  summarize,
  type SessionState,
} from "./session";

const caro = buildRepertoire(openings.find((o) => o.slug === "caro-kann")!);
const items = trainingCards(caro)
  .slice(0, 3)
  .map((c) => toTrainItem(c, true));

function run(state: SessionState, ...actions: Parameters<typeof sessionReducer>[1][]) {
  return actions.reduce(sessionReducer, state);
}

describe("isExpectedMove", () => {
  it("normalizes SAN through chess-rules", () => {
    expect(isExpectedMove(items[0], "c6")).toBe(true);
    expect(isExpectedMove(items[0], "e5")).toBe(false);
    expect(isExpectedMove(items[0], "not-a-move")).toBe(false);
  });
});

describe("sessionReducer", () => {
  it("a first-try correct move resolves clean", () => {
    const s = run(initSession("review", items), { type: "attempt", san: "c6" });
    expect(s.status).toBe("resolved");
    expect(s.result).toEqual({ correct: true, hintUsed: 0, outcome: "clean" });
  });

  it("a wrong move escalates the hint and keeps asking", () => {
    const s = run(initSession("review", items), { type: "attempt", san: "e5" });
    expect(s).toMatchObject({ status: "asking", hintLevel: 1, wrongSan: "e5" });
    const s2 = run(s, { type: "attempt", san: "c6" });
    expect(s2.result).toEqual({ correct: true, hintUsed: 1, outcome: "hinted" });
  });

  it("three misses (or hints) reveal the answer", () => {
    const viaMoves = run(
      initSession("review", items),
      { type: "attempt", san: "e5" },
      { type: "attempt", san: "d5" },
      { type: "attempt", san: "Nf6" },
    );
    expect(viaMoves.result).toEqual({ correct: false, hintUsed: 3, outcome: "missed" });

    const viaHints = run(initSession("review", items), { type: "hint" }, { type: "hint" }, { type: "hint" });
    expect(viaHints.result?.outcome).toBe("missed");
  });

  it("ignores moves after the item is resolved", () => {
    const s = run(initSession("review", items), { type: "attempt", san: "c6" });
    expect(run(s, { type: "attempt", san: "e5" })).toBe(s);
  });

  it("re-queues a missed position once in review mode", () => {
    let s = initSession("review", items.slice(0, 1));
    s = run(s, { type: "hint" }, { type: "hint" }, { type: "hint" }, { type: "next" });
    expect(s.status).toBe("asking");
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toMatchObject({ cardKey: items[0].cardKey, isNew: false });
    // Missing it again does not re-queue a second time.
    s = run(s, { type: "hint" }, { type: "hint" }, { type: "hint" }, { type: "next" });
    expect(s.status).toBe("done");
    expect(summarize(s.log)).toEqual({ clean: 0, hinted: 0, missed: 2 });
  });

  it("does not re-queue in line mode", () => {
    let s = initSession("line", items.slice(0, 1));
    s = run(s, { type: "hint" }, { type: "hint" }, { type: "hint" }, { type: "next" });
    expect(s.status).toBe("done");
  });

  it("an empty session is immediately done", () => {
    expect(initSession("review", []).status).toBe("done");
  });
});

describe("isContinuation", () => {
  it("is true along a played line and false between unrelated positions", () => {
    const line = randomLine(caro, () => 0).map((c) => toTrainItem(c, false));
    expect(isContinuation(line[0], line[1])).toBe(true);
    expect(isContinuation(line[0], line[2])).toBe(false);
  });
});

describe("formatPath", () => {
  it("numbers full moves", () => {
    expect(formatPath(["e4", "c6", "d4"])).toBe("1. e4 c6 2. d4");
    expect(formatPath([])).toBe("");
  });
});
