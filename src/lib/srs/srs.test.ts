import { describe, expect, it } from "vitest";
import {
  buildReviewQueue,
  DEFAULT_EASE,
  describeInterval,
  gradeFromAttempt,
  MIN_EASE,
  newCardState,
  schedule,
  type StoredCardState,
} from "./index";

const NOW = new Date("2026-11-08T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("gradeFromAttempt", () => {
  it("maps drill outcomes to grades", () => {
    expect(gradeFromAttempt({ correct: true, hintUsed: 0 })).toBe("good");
    expect(gradeFromAttempt({ correct: true, hintUsed: 1 })).toBe("hard");
    expect(gradeFromAttempt({ correct: true, hintUsed: 2 })).toBe("hard");
    expect(gradeFromAttempt({ correct: false, hintUsed: 3 })).toBe("again");
    expect(gradeFromAttempt({ correct: false, hintUsed: 0 })).toBe("again");
  });
});

describe("schedule", () => {
  it("grows intervals 1 → 3 → ×ease on repeated good answers", () => {
    let s = newCardState(NOW);
    s = schedule(s, "good", NOW);
    expect(s.intervalDays).toBe(1);
    expect(s.due.getTime()).toBe(NOW.getTime() + DAY);
    s = schedule(s, "good", s.due);
    expect(s.intervalDays).toBe(3);
    s = schedule(s, "good", s.due);
    expect(s.intervalDays).toBe(7.5);
    expect(s.reps).toBe(3);
    expect(s.ease).toBe(DEFAULT_EASE);
  });

  it("a hard answer grows slower and lowers ease", () => {
    let s = schedule(schedule(newCardState(NOW), "good", NOW), "good", NOW); // interval 3
    s = schedule(s, "hard", NOW);
    expect(s.intervalDays).toBe(4);
    expect(s.ease).toBe(2.35);
  });

  it("again resets the card to 10 minutes and counts a lapse only once learned", () => {
    const fresh = schedule(newCardState(NOW), "again", NOW);
    expect(fresh.lapses).toBe(0);
    expect(fresh.due.getTime() - NOW.getTime()).toBe(10 * 60 * 1000);

    const learned = schedule(schedule(newCardState(NOW), "good", NOW), "good", NOW);
    const lapsed = schedule(learned, "again", NOW);
    expect(lapsed).toMatchObject({ reps: 0, intervalDays: 0, lapses: 1 });
  });

  it("never drops ease below the floor", () => {
    let s = newCardState(NOW);
    for (let i = 0; i < 20; i++) s = schedule(s, "again", NOW);
    expect(s.ease).toBe(MIN_EASE);
  });

  it("caps intervals at a year", () => {
    let s = newCardState(NOW);
    for (let i = 0; i < 30; i++) s = schedule(s, "easy", NOW);
    expect(s.intervalDays).toBe(365);
  });
});

describe("buildReviewQueue", () => {
  const cards = ["a", "b", "c", "d", "e"].map((cardKey) => ({ cardKey }));
  const stored = (key: string, dueOffsetDays: number): StoredCardState => ({
    ...newCardState(NOW),
    cardKey: key,
    reps: 1,
    intervalDays: 1,
    due: new Date(NOW.getTime() + dueOffsetDays * DAY),
    createdAt: new Date(NOW.getTime() - 3 * DAY),
  });

  it("puts due cards first (most overdue first), then new cards", () => {
    const map = new Map([
      ["a", stored("a", -1)],
      ["b", stored("b", -3)],
      ["c", stored("c", 2)],
    ]);
    const q = buildReviewQueue(cards, map, NOW, { newPerDay: 10, introducedToday: 0 });
    expect(q.items.map((i) => [i.card.cardKey, i.isNew])).toEqual([
      ["b", false],
      ["a", false],
      ["d", true],
      ["e", true],
    ]);
    expect(q).toMatchObject({ dueCount: 2, unseenCount: 2, learnedCount: 3 });
  });

  it("respects the daily new-card allowance", () => {
    const q = buildReviewQueue(cards, new Map(), NOW, { newPerDay: 3, introducedToday: 2 });
    expect(q.items.map((i) => i.card.cardKey)).toEqual(["a"]);
    const none = buildReviewQueue(cards, new Map(), NOW, { newPerDay: 3, introducedToday: 5 });
    expect(none.items).toEqual([]);
  });
});

describe("describeInterval", () => {
  it("labels minutes, days, weeks and months", () => {
    const at = (ms: number) => ({ intervalDays: 0, due: new Date(NOW.getTime() + ms) });
    expect(describeInterval(at(10 * 60 * 1000), NOW)).toBe("10 min");
    expect(describeInterval(at(DAY), NOW)).toBe("1 day");
    expect(describeInterval(at(3 * DAY), NOW)).toBe("3 days");
    expect(describeInterval(at(21 * DAY), NOW)).toBe("3 weeks");
    expect(describeInterval(at(90 * DAY), NOW)).toBe("3 months");
  });
});
