/**
 * Build per-ply lesson steps for a curated line by pairing the validated move
 * sequence (from chess-rules) with the curated per-ply content. Pure — no React
 * — so it is reusable by the page and testable in isolation.
 */
import { validateLineDetailed } from "@/lib/chess-rules";
import type { LineContent, MoveContent } from "@/lib/opening-content";

export interface LessonStep {
  /** 0-based ply index. */
  ply: number;
  /** 1-based ply index (matches MoveExplanation.moveNumber). */
  moveNumber: number;
  san: string;
  fenBefore: string;
  fenAfter: string;
  explanation: string;
  theme: string | null;
  commonMistake: string | null;
}

export function buildLessonSteps(line: LineContent): LessonStep[] {
  const result = validateLineDetailed(line.startingFen, line.pgn);
  if (!result.ok) {
    throw new Error(`Invalid curated line "${line.name}": ${result.error}`);
  }
  return result.moves.map((mv, i) => {
    const content: MoveContent | undefined = line.moves[i];
    return {
      ply: i,
      moveNumber: i + 1,
      san: mv.san,
      fenBefore: mv.fenBefore,
      fenAfter: mv.fenAfter,
      explanation: content?.explanation ?? "",
      theme: content?.theme ?? null,
      commonMistake: content?.commonMistake ?? null,
    };
  });
}

/** The primary (priority-1) line for an opening, or the first line as fallback. */
export function primaryLine(lines: LineContent[]): LineContent {
  return lines.find((l) => l.priority === 1) ?? lines[0];
}
