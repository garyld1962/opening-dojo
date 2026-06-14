"use client";

/**
 * Board — reusable interactive chessboard wrapping react-chessboard.
 *
 * The deterministic chess-rules module owns legality; this component only
 * presents the board and forwards accepted moves. The pure move-handling logic
 * is extracted into `handleSquareMove` so it can be unit-tested without
 * simulating real drag-and-drop in jsdom.
 */
import * as React from "react";
import { Chessboard } from "react-chessboard";
import {
  applyMoveFromSquares,
  legalDestinations,
} from "@/lib/chess-rules";
import type { Side } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SquareMoveResult =
  | { ok: true; san: string; fenAfter: string }
  | { ok: false };

/**
 * Pure move handler: given a position and a source/target square pair, decide
 * whether the move is legal and, if so, return the resulting SAN + FEN.
 * Returns { ok: false } for illegal moves (the board snaps back).
 *
 * Extracted from the component so the accept/reject logic is unit-testable
 * without rendering or drag simulation.
 */
export function handleSquareMove(
  fen: string,
  source: string,
  target: string,
  promotion: "q" | "r" | "b" | "n" = "q",
): SquareMoveResult {
  const result = applyMoveFromSquares(fen, source, target, promotion);
  if (!result.ok) return { ok: false };
  return { ok: true, san: result.san, fenAfter: result.fenAfter };
}

export interface BoardProps {
  fen: string;
  orientation?: Side;
  /** Called when a legal move is made. Receives normalized SAN + resulting FEN. */
  onMove?: (san: string, fenAfter: string) => void;
  /** When false, pieces are not draggable (display-only board). */
  interactive?: boolean;
  /** When true, clicking a piece highlights its legal destination squares. */
  highlightLegal?: boolean;
}

const HIGHLIGHT_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 26%)",
  borderRadius: "50%",
};

export function Board({
  fen,
  orientation = "white",
  onMove,
  interactive = true,
  highlightLegal = true,
}: BoardProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

  // Reset any selection when the position changes externally.
  React.useEffect(() => {
    setSelected(null);
  }, [fen]);

  const squareStyles = React.useMemo(() => {
    if (!highlightLegal || !selected) return {};
    const styles: Record<string, React.CSSProperties> = {};
    for (const dest of legalDestinations(fen, selected)) {
      styles[dest] = HIGHLIGHT_STYLE;
    }
    if (Object.keys(styles).length > 0) {
      styles[selected] = { background: "rgba(255, 213, 0, 0.4)" };
    }
    return styles;
  }, [fen, selected, highlightLegal]);

  function onPieceDrop(source: string, target: string): boolean {
    const result = handleSquareMove(fen, source, target);
    setSelected(null);
    if (!result.ok) return false;
    onMove?.(result.san, result.fenAfter);
    return true;
  }

  function onSquareClick(square: string) {
    if (!highlightLegal) return;
    setSelected((prev) => (prev === square ? null : square));
  }

  return (
    <div className="w-full max-w-[480px]" data-testid="board">
      <Chessboard
        id="dojo-board"
        position={fen}
        boardOrientation={orientation}
        arePiecesDraggable={interactive}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        customSquareStyles={squareStyles}
        customBoardStyle={{
          borderRadius: "4px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

export interface MoveListProps {
  /** Moves in SAN, in ply order. */
  sans: string[];
  /** Index of the currently active ply (0-based), if any, for highlighting. */
  activePly?: number;
  /** Optional click handler to jump to a ply. */
  onSelectPly?: (ply: number) => void;
  className?: string;
}

/**
 * MoveList — renders SAN moves grouped into numbered full-move rows
 * (white/black columns). Highlights the active ply.
 */
export function MoveList({
  sans,
  activePly,
  onSelectPly,
  className,
}: MoveListProps) {
  const rows: { num: number; white?: string; black?: string; wPly: number; bPly: number }[] =
    [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({
      num: i / 2 + 1,
      white: sans[i],
      black: sans[i + 1],
      wPly: i,
      bPly: i + 1,
    });
  }

  const cell = (ply: number, san?: string) => {
    if (!san) return <span className="w-16" />;
    const active = activePly === ply;
    return (
      <button
        type="button"
        onClick={onSelectPly ? () => onSelectPly(ply) : undefined}
        disabled={!onSelectPly}
        data-testid={`move-${ply}`}
        aria-current={active ? "step" : undefined}
        className={cn(
          "w-16 rounded px-1 text-left font-mono text-sm",
          onSelectPly && "hover:bg-accent",
          active && "bg-primary text-primary-foreground",
        )}
      >
        {san}
      </button>
    );
  };

  return (
    <ol className={cn("space-y-0.5", className)} data-testid="move-list">
      {rows.map((r) => (
        <li key={r.num} className="flex items-center gap-2">
          <span className="w-6 text-right text-sm text-muted-foreground">
            {r.num}.
          </span>
          {cell(r.wPly, r.white)}
          {cell(r.bPly, r.black)}
        </li>
      ))}
    </ol>
  );
}
