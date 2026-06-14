import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "../src/generated/prisma";
import {
  buildLineMoves,
  seedDemoUser,
  seedOpenings,
  ContentValidationError,
} from "./seed";
import { openings } from "../src/lib/opening-content";
import { START_FEN } from "../src/lib/chess-rules";
import type { LineContent } from "../src/lib/opening-content";

const prisma = new PrismaClient();

describe("content validation (N8)", () => {
  it("accepts and maps every curated line", () => {
    for (const opening of openings) {
      for (const line of opening.lines) {
        const rows = buildLineMoves(line);
        expect(rows.length).toBe(line.moves.length);
        for (const row of rows) {
          expect(row.explanation.trim().length).toBeGreaterThan(0);
          expect(row.fenBefore.length).toBeGreaterThan(0);
          expect(row.fenAfter.length).toBeGreaterThan(0);
          expect(row.fenBefore).not.toBe(row.fenAfter);
        }
      }
    }
  });

  it("stores moveNumber as the 1-based ply index (not the full-move number)", () => {
    const line = openings[0].lines[0]; // London classical, 15 plies
    const rows = buildLineMoves(line);
    rows.forEach((row, i) => expect(row.moveNumber).toBe(i + 1));
    // Displayed full move = ceil(ply / 2): ply 1 -> move 1, ply 3 -> move 2.
    expect(Math.ceil(rows[0].moveNumber / 2)).toBe(1);
    expect(Math.ceil(rows[2].moveNumber / 2)).toBe(2);
  });

  it("aborts with a clear error on an illegal line", () => {
    const bad: LineContent = {
      name: "bogus",
      startingFen: START_FEN,
      pgn: "1. Nf6", // white cannot reach f6 on move 1
      description: "",
      priority: 99,
      active: true,
      moves: [{ explanation: "x" }],
    };
    expect(() => buildLineMoves(bad)).toThrow(ContentValidationError);
  });

  it("aborts when ply count and content length disagree", () => {
    const mismatch: LineContent = {
      name: "mismatch",
      startingFen: START_FEN,
      pgn: "1. d4 d5",
      description: "",
      priority: 99,
      active: true,
      moves: [{ explanation: "only one" }],
    };
    expect(() => buildLineMoves(mismatch)).toThrow(/plies/);
  });
});

describe("seed against the DB", () => {
  beforeAll(async () => {
    await seedDemoUser(prisma);
    await seedOpenings(prisma);
    await seedOpenings(prisma); // idempotent re-seed
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds a London opening with a primary line plus ≥3 Black-response lines", async () => {
    const london = await prisma.opening.findFirst({
      where: { name: "London System" },
      include: { lines: true },
    });
    expect(london).not.toBeNull();
    expect(london?.side).toBe("white");
    expect((london?.lines.length ?? 0)).toBeGreaterThanOrEqual(4); // primary + 3
  });

  it("seeds Caro-Kann Advance, Classical, and Exchange lines", async () => {
    const caro = await prisma.opening.findFirst({
      where: { name: "Caro-Kann Defense" },
      include: { lines: true },
    });
    expect(caro).not.toBeNull();
    expect(caro?.side).toBe("black");
    const names = caro?.lines.map((l) => l.name) ?? [];
    expect(names.some((n) => n.includes("Advance"))).toBe(true);
    expect(names.some((n) => n.includes("Classical"))).toBe(true);
    expect(names.some((n) => n.includes("Exchange"))).toBe(true);
  });

  it("every MoveExplanation has a non-empty explanation and valid FENs", async () => {
    const moves = await prisma.moveExplanation.findMany();
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.explanation.trim().length).toBeGreaterThan(0);
      expect(move.fenBefore.length).toBeGreaterThan(0);
      expect(move.fenAfter.length).toBeGreaterThan(0);
    }
  });

  it("re-seeding does not duplicate openings", async () => {
    const londons = await prisma.opening.count({
      where: { name: "London System" },
    });
    expect(londons).toBe(1);
  });
});
