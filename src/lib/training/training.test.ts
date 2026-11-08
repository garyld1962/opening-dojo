import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadSession, NEW_PER_DAY, recordReview, trainingStats, UnknownCardError } from "./index";

const USER = "test-user-trainer";
const NOW = new Date("2026-11-08T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await prisma.user.upsert({ where: { id: USER }, create: { id: USER }, update: {} });
});

beforeEach(async () => {
  await prisma.reviewCard.deleteMany({ where: { userId: USER } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
});

describe("loadSession (review mode)", () => {
  it("starts a new user on today's allowance of new positions, from move 1", async () => {
    const s = await loadSession(prisma, USER, { slug: "caro-kann", mode: "review", now: NOW });
    expect(s.items.length).toBe(NEW_PER_DAY);
    expect(s.items.every((i) => i.isNew)).toBe(true);
    expect(s.items[0]).toMatchObject({ expectedSan: "c6", path: ["e4"], side: "black" });
    expect(s.stats).toMatchObject({ due: 0, learned: 0, newToday: NEW_PER_DAY });
    expect(s.stats.total).toBe(s.stats.unseen);
  });

  it("serves due positions before new ones and counts today's introductions", async () => {
    const first = await loadSession(prisma, USER, { slug: "london-system", mode: "review", now: NOW });
    const [a, b] = first.items;
    await recordReview(prisma, USER, { cardKey: a.cardKey, correct: true, hintUsed: 0 }, NOW);
    await recordReview(prisma, USER, { cardKey: b.cardKey, correct: false, hintUsed: 3 }, NOW);

    // Same day, 15 minutes later: the failed card (10-min relearn) is due again.
    const later = await loadSession(prisma, USER, {
      slug: "london-system",
      mode: "review",
      now: new Date(NOW.getTime() + 15 * 60 * 1000),
    });
    expect(later.items[0]).toMatchObject({ cardKey: b.cardKey, isNew: false });
    expect(later.stats.due).toBe(1);
    expect(later.stats.learned).toBe(2);
    expect(later.stats.newToday).toBe(NEW_PER_DAY - 2);

    // Two days later both are due and the daily allowance has reset.
    const twoDays = await loadSession(prisma, USER, {
      slug: "london-system",
      mode: "review",
      now: new Date(NOW.getTime() + 2 * DAY),
    });
    expect(twoDays.stats.due).toBe(2);
    expect(twoDays.items.filter((i) => i.isNew)).toHaveLength(NEW_PER_DAY);
  });
});

describe("loadSession (line mode)", () => {
  it("returns one line from move 1 for the trained side", async () => {
    const s = await loadSession(prisma, USER, {
      slug: "london-system",
      mode: "line",
      now: NOW,
      rng: () => 0,
    });
    expect(s.items.length).toBeGreaterThan(3);
    expect(s.items[0]).toMatchObject({ expectedSan: "d4", path: [] });
    expect(s.items.every((i) => i.side === "white")).toBe(true);
  });
});

describe("recordReview", () => {
  it("schedules a clean answer for tomorrow and a hinted one sooner", async () => {
    const s = await loadSession(prisma, USER, { slug: "caro-kann", mode: "review", now: NOW });
    const clean = await recordReview(
      prisma,
      USER,
      { cardKey: s.items[0].cardKey, correct: true, hintUsed: 0 },
      NOW,
    );
    expect(clean).toMatchObject({ grade: "good", intervalDays: 1, nextReview: "1 day" });

    const again = await recordReview(
      prisma,
      USER,
      { cardKey: s.items[0].cardKey, correct: true, hintUsed: 0 },
      clean.due,
    );
    expect(again.intervalDays).toBe(3);

    const row = await prisma.reviewCard.findUnique({
      where: { userId_cardKey: { userId: USER, cardKey: s.items[0].cardKey } },
    });
    expect(row).toMatchObject({ reps: 2, openingSlug: "caro-kann", expectedSan: "c6" });
  });

  it("rejects keys that are not repertoire positions", async () => {
    await expect(
      recordReview(prisma, USER, { cardKey: "caro-kann:nope", correct: true, hintUsed: 0 }, NOW),
    ).rejects.toBeInstanceOf(UnknownCardError);
  });
});

describe("trainingStats", () => {
  it("reports per-opening totals", async () => {
    const stats = await trainingStats(prisma, USER, NOW);
    expect(stats.map((s) => s.slug).sort()).toEqual(["caro-kann", "london-system"]);
    for (const s of stats) expect(s.total).toBeGreaterThan(5);
  });
});
