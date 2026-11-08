import { describe, expect, it } from "vitest";
import { openings, type OpeningContent } from "@/lib/opening-content";
import { START_FEN } from "@/lib/chess-rules";
import {
  buildRepertoire,
  cardKeyFor,
  findCard,
  hintsFor,
  positionKey,
  randomLine,
  RepertoireConflictError,
  trainingCards,
} from "./index";

const london = openings.find((o) => o.slug === "london-system")!;
const caro = openings.find((o) => o.slug === "caro-kann")!;

/** Deterministic rng that cycles through the given values. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("buildRepertoire", () => {
  it("builds a tree for every curated opening without conflicts", () => {
    for (const o of openings) {
      const rep = buildRepertoire(o);
      expect(rep.nodes.get(rep.rootKey)?.fen).toBe(START_FEN);
    }
  });

  it("merges shared prefixes: one root move per side in the Caro-Kann", () => {
    const rep = buildRepertoire(caro);
    const root = rep.nodes.get(rep.rootKey)!;
    expect(root.moves.map((m) => m.san)).toEqual(["e4"]);
    const afterE4 = rep.nodes.get(root.moves[0].toKey)!;
    // Black (trained side) has exactly one answer to 1.e4.
    expect(afterE4.moves.map((m) => m.san)).toEqual(["c6"]);
    // White's second moves branch: d4, Nc3, c4, d3.
    const afterC6 = rep.nodes.get(afterE4.moves[0].toKey)!;
    expect(afterC6.moves.map((m) => m.san).sort()).toEqual(["Nc3", "c4", "d3", "d4"]);
  });

  it("merges transpositions (3.Nc3 and 3.Nd2 reach the same Classical node)", () => {
    const rep = buildRepertoire(caro);
    const viaNc3 = rep.nodes.get(
      positionKey("rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5"),
    );
    expect(viaNc3).toBeDefined();
    expect(viaNc3!.moves.map((m) => m.san)).toContain("Ng3");
    const nodeAfterNxe4 = [...rep.nodes.values()].find(
      (n) => n.moves.some((m) => m.san === "Bf5") && n.path.includes("Nxe4"),
    )!;
    expect(nodeAfterNxe4.moves[0].lines).toEqual(
      expect.arrayContaining(["Classical Variation", "Classical via 3.Nd2"]),
    );
  });

  it("rejects two different trained-side answers in the same position", () => {
    const bad: OpeningContent = {
      ...london,
      lines: [
        { ...london.lines[0], pgn: "1. d4 d5 2. Nf3", moves: london.lines[0].moves.slice(0, 3) },
        {
          ...london.lines[0],
          name: "conflict",
          priority: 9,
          pgn: "1. d4 d5 2. c4",
          moves: london.lines[0].moves.slice(0, 3),
        },
      ],
    };
    expect(() => buildRepertoire(bad)).toThrow(RepertoireConflictError);
  });

  it("allows the opponent to branch freely", () => {
    const rep = buildRepertoire(london);
    const root = rep.nodes.get(rep.rootKey)!;
    const afterD4 = rep.nodes.get(root.moves[0].toKey)!;
    expect(afterD4.moves.map((m) => m.san).sort()).toEqual(["Nf6", "d5"]);
  });

  it("records the moving piece and squares for hints and highlighting", () => {
    const rep = buildRepertoire(london);
    const root = rep.nodes.get(rep.rootKey)!;
    expect(root.moves[0]).toMatchObject({ san: "d4", from: "d2", to: "d4", piece: "p" });
  });
});

describe("trainingCards", () => {
  it("only includes trained-side positions, shallowest first", () => {
    const rep = buildRepertoire(caro);
    const cards = trainingCards(rep);
    expect(cards.length).toBeGreaterThan(20);
    expect(cards.every((c) => c.side === "black")).toBe(true);
    expect(cards[0].expected.san).toBe("c6");
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].depth).toBeGreaterThanOrEqual(cards[i - 1].depth);
    }
  });

  it("gives each position one stable card key", () => {
    const cards = trainingCards(buildRepertoire(london));
    const keys = new Set(cards.map((c) => c.cardKey));
    expect(keys.size).toBe(cards.length);
    expect(cards[0].cardKey).toBe(cardKeyFor("london-system", positionKey(START_FEN)));
  });

  it("findCard resolves a key back to its card, and rejects unknown keys", () => {
    const reps = openings.map(buildRepertoire);
    const card = trainingCards(reps[1])[3];
    expect(findCard(reps, card.cardKey)?.expected.san).toBe(card.expected.san);
    expect(findCard(reps, "caro-kann:not-a-position")).toBeUndefined();
  });
});

describe("randomLine", () => {
  it("walks from the start to a leaf, quizzing only the trained side", () => {
    const rep = buildRepertoire(caro);
    const line = randomLine(rep, seq(0));
    expect(line.length).toBeGreaterThan(2);
    expect(line[0].expected.san).toBe("c6");
    expect(line[0].path).toEqual(["e4"]);
    // Each card's path extends the previous card's path plus its answer.
    for (let i = 1; i < line.length; i++) {
      const prev = line[i - 1];
      expect(line[i].path.slice(0, prev.path.length + 1)).toEqual([
        ...prev.path,
        prev.expected.san,
      ]);
    }
  });

  it("follows different opponent branches for different rolls", () => {
    const rep = buildRepertoire(caro);
    const a = randomLine(rep, seq(0)).map((c) => c.path.join(" "));
    const b = randomLine(rep, seq(0.99)).map((c) => c.path.join(" "));
    expect(a.at(-1)).not.toEqual(b.at(-1));
  });
});

describe("hintsFor", () => {
  it("uses curated hints when present", () => {
    const cards = trainingCards(buildRepertoire(london));
    const bf4 = cards.find((c) => c.expected.san === "Bf4" && c.path.join(" ") === "d4 d5 Nf3 Nf6")!;
    expect(hintsFor(bf4).hint1).toMatch(/problem piece/i);
  });

  it("derives a piece-aware hint when none is curated", () => {
    const cards = trainingCards(buildRepertoire(london));
    const first = cards[0]; // 1.d4 has no curated hints
    const h = hintsFor(first);
    expect(h.hint2).toBe("Move your pawn on d2.");
    expect(h.reveal).toContain("d4");
  });
});
