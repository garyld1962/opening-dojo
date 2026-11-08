/**
 * repertoire — the curated lines of an opening merged into one move tree.
 *
 * Every curated line is replayed through chess-rules; positions are keyed by
 * their FEN without the move clocks, so shared prefixes merge and transpositions
 * (e.g. 3.Nc3 dxe4 4.Nxe4 and 3.Nd2 dxe4 4.Nxe4) land on the same node. The
 * trained side must have exactly one answer per position; two different
 * answers in the same position is a content error and is rejected.
 *
 * Pure logic: no React, no Next, no I/O.
 */
import type { LineContent, MoveContent, OpeningContent } from "@/lib/opening-content";
import { moveSquares, validateLineDetailed } from "@/lib/chess-rules";
import type { Side } from "@/lib/types";

/** FEN minus the halfmove/fullmove clocks: identifies a position for transpositions. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export interface LastMove {
  from: string;
  to: string;
}

export interface RepertoireMove {
  san: string;
  from: string;
  to: string;
  /** Moving piece letter as chess.js reports it (p, n, b, r, q, k). */
  piece: string;
  fenAfter: string;
  toKey: string;
  content: MoveContent;
  /** Names of the curated lines this move appears in. */
  lines: string[];
}

export interface RepertoireNode {
  key: string;
  fen: string;
  sideToMove: Side;
  /** Ply count of the first path that reached this node. */
  depth: number;
  /** SAN path from the start position (first path found, by line priority). */
  path: string[];
  lastMove: LastMove | null;
  moves: RepertoireMove[];
}

export interface Repertoire {
  slug: string;
  name: string;
  side: Side;
  rootKey: string;
  nodes: Map<string, RepertoireNode>;
}

export class RepertoireConflictError extends Error {}

function sortedLines(lines: LineContent[]): LineContent[] {
  return lines.filter((l) => l.active).slice().sort((a, b) => a.priority - b.priority);
}

/** Build the move tree for one opening. Throws on illegal or conflicting content. */
export function buildRepertoire(opening: OpeningContent): Repertoire {
  const nodes = new Map<string, RepertoireNode>();
  let rootKey: string | null = null;

  const ensureNode = (
    fen: string,
    sideToMove: Side,
    path: string[],
    lastMove: LastMove | null,
  ): RepertoireNode => {
    const key = positionKey(fen);
    let node = nodes.get(key);
    if (!node) {
      node = { key, fen, sideToMove, depth: path.length, path, lastMove, moves: [] };
      nodes.set(key, node);
    }
    return node;
  };

  for (const line of sortedLines(opening.lines)) {
    const validated = validateLineDetailed(line.startingFen, line.pgn);
    if (!validated.ok) {
      throw new RepertoireConflictError(`Line "${line.name}": ${validated.error}`);
    }
    const path: string[] = [];
    let lastMove: LastMove | null = null;

    validated.moves.forEach((vm, i) => {
      const node = ensureNode(vm.fenBefore, vm.sideToMove, [...path], lastMove);
      if (i === 0) {
        if (rootKey === null) rootKey = node.key;
        else if (rootKey !== node.key) {
          throw new RepertoireConflictError(
            `Line "${line.name}" starts from a different position than earlier lines`,
          );
        }
      }

      const squares = moveSquares(vm.fenBefore, vm.san);
      if (!squares) {
        throw new RepertoireConflictError(`Line "${line.name}": cannot replay ${vm.san}`);
      }

      const existing = node.moves.find((mv) => mv.san === vm.san);
      if (existing) {
        if (!existing.lines.includes(line.name)) existing.lines.push(line.name);
      } else {
        if (node.sideToMove === opening.side && node.moves.length > 0) {
          throw new RepertoireConflictError(
            `Repertoire conflict in "${line.name}": after ${node.path.join(" ") || "the start"}, ` +
              `${opening.name} already plays ${node.moves[0].san}, not ${vm.san}`,
          );
        }
        node.moves.push({
          san: vm.san,
          from: squares.from,
          to: squares.to,
          piece: squares.piece,
          fenAfter: vm.fenAfter,
          toKey: positionKey(vm.fenAfter),
          content: line.moves[i] ?? { explanation: "" },
          lines: [line.name],
        });
      }

      path.push(vm.san);
      lastMove = { from: squares.from, to: squares.to };
      ensureNode(
        vm.fenAfter,
        vm.sideToMove === "white" ? "black" : "white",
        [...path],
        lastMove,
      );
    });
  }

  if (rootKey === null) {
    throw new RepertoireConflictError(`Opening "${opening.name}" has no active lines`);
  }
  return { slug: opening.slug, name: opening.name, side: opening.side, rootKey, nodes };
}

/** One position where the trained side must find its repertoire move. */
export interface TrainingCard {
  /** Stable id: `${slug}:${positionKey}`. Survives content re-seeds. */
  cardKey: string;
  slug: string;
  openingName: string;
  side: Side;
  nodeKey: string;
  fen: string;
  path: string[];
  lastMove: LastMove | null;
  depth: number;
  expected: RepertoireMove;
}

export function cardKeyFor(slug: string, nodeKey: string): string {
  return `${slug}:${nodeKey}`;
}

function toCard(rep: Repertoire, node: RepertoireNode): TrainingCard {
  return {
    cardKey: cardKeyFor(rep.slug, node.key),
    slug: rep.slug,
    openingName: rep.name,
    side: rep.side,
    nodeKey: node.key,
    fen: node.fen,
    path: node.path,
    lastMove: node.lastMove,
    depth: node.depth,
    expected: node.moves[0],
  };
}

/**
 * Every trained-side decision in the repertoire, shallowest first (so new
 * cards are introduced from move 1 outward). Insertion order breaks ties,
 * which follows line priority.
 */
export function trainingCards(rep: Repertoire): TrainingCard[] {
  const cards: TrainingCard[] = [];
  for (const node of rep.nodes.values()) {
    if (node.sideToMove === rep.side && node.moves.length === 1) {
      cards.push(toCard(rep, node));
    }
  }
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.depth - b.c.depth || a.i - b.i)
    .map(({ c }) => c);
}

/** Find a card by key across repertoires. */
export function findCard(reps: Repertoire[], cardKey: string): TrainingCard | undefined {
  for (const rep of reps) {
    const node = [...rep.nodes.values()].find(
      (n) => cardKeyFor(rep.slug, n.key) === cardKey,
    );
    if (node && node.sideToMove === rep.side && node.moves.length === 1) {
      return toCard(rep, node);
    }
  }
  return undefined;
}

/**
 * Walk one line from the start, choosing the opponent's reply at random at
 * each branch. Returns the trained-side cards along the way, with the path and
 * last move as actually played (which can differ from the node's first path
 * after a transposition).
 */
export function randomLine(
  rep: Repertoire,
  rng: () => number = Math.random,
): TrainingCard[] {
  const out: TrainingCard[] = [];
  const seen = new Set<string>();
  let node = rep.nodes.get(rep.rootKey);
  const path: string[] = [];
  let lastMove: LastMove | null = null;

  while (node && node.moves.length > 0 && !seen.has(node.key)) {
    seen.add(node.key);
    let move: RepertoireMove;
    if (node.sideToMove === rep.side) {
      move = node.moves[0];
      out.push({ ...toCard(rep, node), path: [...path], lastMove });
    } else {
      const idx = Math.min(node.moves.length - 1, Math.floor(rng() * node.moves.length));
      move = node.moves[idx];
    }
    path.push(move.san);
    lastMove = { from: move.from, to: move.to };
    node = rep.nodes.get(move.toKey);
  }
  return out;
}

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export interface CardHints {
  hint1: string;
  hint2: string;
  reveal: string;
}

/**
 * The hint ladder for a card. Curated hints win; otherwise hints are derived
 * deterministically from the move itself (theme first, then which piece).
 */
export function hintsFor(card: TrainingCard): CardHints {
  const { content, san, from, piece } = card.expected;
  const castles = san.startsWith("O-O");
  const derived2 = castles
    ? "Get your king to safety: castle."
    : `Move your ${PIECE_NAMES[piece] ?? "piece"} on ${from}.`;
  const derived1 = content.theme
    ? `Think about the idea here: ${content.theme}.`
    : "What does this opening want to do in this position?";
  return {
    hint1: content.hintLevel1 ?? derived1,
    hint2: content.hintLevel2 ?? derived2,
    reveal: content.revealExplanation ?? `${san} — ${content.explanation}`,
  };
}
