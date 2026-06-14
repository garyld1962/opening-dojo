import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  START_FEN,
  legalMoves,
  applyMove,
  isLegal,
  sideToMove,
  validateLine,
  validateLineDetailed,
  pgnToSanTokens,
  boardOrientation,
} from "@/lib/chess-rules";

// A clean, fully-legal London System setup line.
const LONDON_PGN = "1. d4 d5 2. Bf4 Nf6 3. e3 e6 4. Nf3 Bd6 5. Bg3";
// White cannot reach f6 with a knight on move 1 — illegal.
const ILLEGAL_PGN = "1. Nf6";

describe("chess-rules: legal moves & application", () => {
  it("lists legal moves for the start position (20)", () => {
    const moves = legalMoves(START_FEN);
    expect(moves).toContain("d4");
    expect(moves).toContain("Nf3");
    expect(moves).toHaveLength(20);
  });

  it("applies a legal move and returns correct fenAfter + SAN", () => {
    const result = applyMove(START_FEN, "d4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.san).toBe("d4");
      // black to move, white pawn now on d4
      expect(result.fenAfter).toContain(" b ");
      expect(result.fenAfter.startsWith("rnbqkbnr/pppppppp/8/8/3P4/")).toBe(
        true,
      );
    }
  });

  it("rejects an illegal move with a reason and does not mutate", () => {
    const result = applyMove(START_FEN, "e5"); // pawn cannot jump e2->e5
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/illegal/i);
  });

  it("rejects a move from an invalid FEN", () => {
    const result = applyMove("not-a-fen", "d4");
    expect(result.ok).toBe(false);
  });

  it("isLegal agrees with applyMove", () => {
    expect(isLegal(START_FEN, "Nf3")).toBe(true);
    expect(isLegal(START_FEN, "Ke2")).toBe(false);
  });

  it("reports the side to move", () => {
    expect(sideToMove(START_FEN)).toBe("white");
    const after = applyMove(START_FEN, "d4");
    expect(after.ok && sideToMove(after.fenAfter)).toBe("black");
  });
});

describe("chess-rules: line validation (N8)", () => {
  it("accepts the London primary line and returns a FEN per move", () => {
    const result = validateLine(START_FEN, LONDON_PGN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sans).toEqual([
        "d4",
        "d5",
        "Bf4",
        "Nf6",
        "e3",
        "e6",
        "Nf3",
        "Bd6",
        "Bg3",
      ]);
      expect(result.fens).toHaveLength(9);
    }
  });

  it("rejects a deliberately illegal line with an error", () => {
    const result = validateLine(START_FEN, ILLEGAL_PGN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/illegal/i);
  });

  it("validateLineDetailed yields fenBefore/fenAfter, move numbers, sides", () => {
    const result = validateLineDetailed(START_FEN, LONDON_PGN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.moves[0]).toMatchObject({
        fullMoveNumber: 1,
        san: "d4",
        sideToMove: "white",
        fenBefore: START_FEN,
      });
      // Full-move number is shared by both colours' moves in the pair.
      expect(result.moves[1].fullMoveNumber).toBe(1); // 1...d5
      expect(result.moves[2].fullMoveNumber).toBe(2); // 2.Bf4
      expect(result.moves[1].sideToMove).toBe("black");
      expect(result.moves[0].fenAfter).toBe(result.moves[1].fenBefore);
    }
  });

  it("tokenizes PGN, stripping move numbers and results", () => {
    expect(pgnToSanTokens("1. d4 d5 2. Bf4 1-0")).toEqual([
      "d4",
      "d5",
      "Bf4",
    ]);
  });

  it("strips comments, NAGs, and black-move-number forms", () => {
    expect(
      pgnToSanTokens("1. d4 {a solid start} d5 $1 2. Bf4 1... is fine *"),
    ).toEqual(["d4", "d5", "Bf4", "is", "fine"]);
    // The "1..." black-move-number prefix is stripped, not the moves.
    expect(pgnToSanTokens("1. e4 c6 2. d4 1... d5")).toEqual([
      "e4",
      "c6",
      "d4",
      "d5",
    ]);
  });
});

describe("chess-rules: orientation", () => {
  it("orients the board to the trained side", () => {
    expect(boardOrientation("white")).toBe("white");
    expect(boardOrientation("black")).toBe("black");
  });
});

describe("chess-rules: purity", () => {
  it("does not import react or next", () => {
    const dir = resolve(__dirname);
    const sources = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    for (const file of sources) {
      const src = readFileSync(resolve(dir, file), "utf8");
      expect(src).not.toMatch(/from\s+["']react["']/);
      expect(src).not.toMatch(/from\s+["']next/);
    }
  });
});
