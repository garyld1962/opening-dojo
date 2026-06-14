/**
 * chess-rules — deterministic chess core.
 *
 * Thin wrappers over chess.js. This module owns correctness: legal moves,
 * FEN/SAN, line validation, board orientation. It is pure logic — no React,
 * no Next, no I/O — and is the *only* authority on move legality. The AI coach
 * never decides legality; it consumes the move lists produced here.
 */
import { Chess } from "chess.js";
import type { Side } from "@/lib/types";

/** Standard initial position FEN. */
export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type ApplyMoveResult =
  | { ok: true; fenAfter: string; san: string }
  | { ok: false; reason: string };

export type ValidateLineResult =
  | { ok: true; fens: string[]; sans: string[] }
  | { ok: false; error: string };

/** Per-move record produced while validating a line. */
export interface ValidatedMove {
  /** chess.js full-move number (white and black share one). NOT the ply index. */
  fullMoveNumber: number;
  san: string;
  fenBefore: string;
  fenAfter: string;
  sideToMove: Side;
}

function newGame(fen?: string): Chess {
  // chess.js throws on an invalid FEN; callers that pass user/seed data should
  // guard with try/catch (see applyMove / validateLine).
  return fen ? new Chess(fen) : new Chess();
}

/** Legal moves (SAN) for the side to move in `fen`. */
export function legalMoves(fen: string): string[] {
  try {
    return newGame(fen).moves();
  } catch {
    return [];
  }
}

/** Apply a SAN move to a FEN. Returns the resulting FEN + normalized SAN, or a reason. */
export function applyMove(fen: string, san: string): ApplyMoveResult {
  let game: Chess;
  try {
    game = newGame(fen);
  } catch {
    return { ok: false, reason: `Invalid FEN: ${fen}` };
  }
  try {
    const move = game.move(san);
    return { ok: true, fenAfter: game.fen(), san: move.san };
  } catch {
    return { ok: false, reason: `Illegal move "${san}" in position ${fen}` };
  }
}

/** Whether `san` is a legal move in `fen`. */
export function isLegal(fen: string, san: string): boolean {
  return applyMove(fen, san).ok;
}

/** Which side is to move in `fen`. */
export function sideToMove(fen: string): Side {
  try {
    return newGame(fen).turn() === "w" ? "white" : "black";
  } catch {
    return "white";
  }
}

/**
 * Tokenize PGN movetext into SAN tokens. Strips comments, NAGs, result tokens,
 * and move numbers. Does not handle recursive variations (curated content has
 * none).
 */
export function pgnToSanTokens(pgn: string): string[] {
  return pgn
    .replace(/\{[^}]*\}/g, " ") // comments
    .replace(/\$\d+/g, " ") // NAGs
    .replace(/(?:1-0|0-1|1\/2-1\/2|\*)/g, " ") // results (incl. bare "*")
    .replace(/\d+\.(\.\.)?/g, " ") // move numbers (e.g. "1." or "1...")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Validate a curated line: replay each SAN move from `startingFen`, rejecting
 * the whole line if any move is illegal (N8). Returns the FEN after each move.
 */
export function validateLine(
  startingFen: string,
  pgn: string,
): ValidateLineResult {
  let game: Chess;
  try {
    game = newGame(startingFen);
  } catch {
    return { ok: false, error: `Invalid starting FEN: ${startingFen}` };
  }

  const tokens = pgnToSanTokens(pgn);
  if (tokens.length === 0) {
    return { ok: false, error: "PGN contains no moves" };
  }

  const fens: string[] = [];
  const sans: string[] = [];
  for (const token of tokens) {
    try {
      const move = game.move(token);
      sans.push(move.san);
      fens.push(game.fen());
    } catch {
      return {
        ok: false,
        error: `Illegal move "${token}" at ply ${fens.length + 1} of line`,
      };
    }
  }
  return { ok: true, fens, sans };
}

/**
 * Validate a line and return rich per-move records (fenBefore/fenAfter, move
 * number, side to move) for seeding MoveExplanation rows.
 */
export function validateLineDetailed(
  startingFen: string,
  pgn: string,
):
  | { ok: true; moves: ValidatedMove[] }
  | { ok: false; error: string } {
  let game: Chess;
  try {
    game = newGame(startingFen);
  } catch {
    return { ok: false, error: `Invalid starting FEN: ${startingFen}` };
  }
  const tokens = pgnToSanTokens(pgn);
  if (tokens.length === 0) return { ok: false, error: "PGN contains no moves" };

  const moves: ValidatedMove[] = [];
  for (const token of tokens) {
    const fenBefore = game.fen();
    const turn: Side = game.turn() === "w" ? "white" : "black";
    const fullMoveNumber = game.moveNumber();
    try {
      const move = game.move(token);
      moves.push({
        fullMoveNumber,
        san: move.san,
        fenBefore,
        fenAfter: game.fen(),
        sideToMove: turn,
      });
    } catch {
      return {
        ok: false,
        error: `Illegal move "${token}" at ply ${moves.length + 1} of line`,
      };
    }
  }
  return { ok: true, moves };
}

/**
 * Board orientation for react-chessboard: the board flips so the trained
 * side is at the bottom. White repertoire → "white"; Black repertoire → "black".
 */
export function boardOrientation(side: Side): "white" | "black" {
  return side;
}
