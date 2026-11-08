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

/**
 * Pure tap-to-move logic (phones): the first tap selects one of the side to
 * move's pieces, a second tap on a legal destination plays the move, a tap on
 * another own piece switches the selection, anything else clears it.
 */
export type TapResult =
  | { kind: "select"; square: string | null }
  | { kind: "move"; san: string; fenAfter: string };

export function resolveTap(
  fen: string,
  selected: string | null,
  square: string,
): TapResult {
  if (selected && selected !== square) {
    if (legalDestinations(fen, selected).includes(square)) {
      const result = handleSquareMove(fen, selected, square);
      if (result.ok) return { kind: "move", san: result.san, fenAfter: result.fenAfter };
    }
  }
  if (selected === square) return { kind: "select", square: null };
  return {
    kind: "select",
    square: legalDestinations(fen, square).length > 0 ? square : null,
  };
}

export interface BoardProps {
  fen: string;
  orientation?: Side;
  /**
   * Called when a legal move is made. Receives normalized SAN + resulting FEN.
   * Return `false` to reject the move (the piece snaps back); any other return
   * value accepts it.
   */
  onMove?: (san: string, fenAfter: string) => void | boolean;
  /** When false, pieces are not draggable (display-only board). */
  interactive?: boolean;
  /** When true, clicking a piece highlights its legal destination squares. */
  highlightLegal?: boolean;
  /** Squares of the previous move, highlighted so you can see what just happened. */
  lastMove?: { from: string; to: string } | null;
  /** Extra square highlights (e.g. the piece a hint points at). */
  markSquares?: string[];
  /** Arrows to draw, as [from, to] pairs (e.g. the revealed answer). */
  arrows?: [string, string][];
  /** Move animation in ms (react-chessboard default is 300). */
  animationDuration?: number;
  className?: string;
}

const HIGHLIGHT_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 26%)",
  borderRadius: "50%",
};
const LAST_MOVE_STYLE: React.CSSProperties = { background: "rgba(255, 213, 0, 0.35)" };
const MARK_STYLE: React.CSSProperties = { boxShadow: "inset 0 0 0 4px rgba(37, 99, 235, 0.75)" };

export function Board({
  fen,
  orientation = "white",
  onMove,
  interactive = true,
  highlightLegal = true,
  lastMove = null,
  markSquares = [],
  arrows = [],
  animationDuration,
  className,
}: BoardProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

  // Reset any selection when the position changes externally.
  React.useEffect(() => {
    setSelected(null);
  }, [fen]);

  const squareStyles = React.useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = LAST_MOVE_STYLE;
      styles[lastMove.to] = LAST_MOVE_STYLE;
    }
    for (const sq of markSquares) styles[sq] = { ...styles[sq], ...MARK_STYLE };
    if (highlightLegal && selected) {
      const dests = legalDestinations(fen, selected);
      for (const dest of dests) styles[dest] = { ...styles[dest], ...HIGHLIGHT_STYLE };
      if (dests.length > 0) {
        styles[selected] = { ...styles[selected], background: "rgba(255, 213, 0, 0.55)" };
      }
    }
    return styles;
  }, [fen, selected, highlightLegal, lastMove, markSquares]);

  function onPieceDrop(source: string, target: string): boolean {
    const result = handleSquareMove(fen, source, target);
    setSelected(null);
    if (!result.ok) return false;
    return onMove?.(result.san, result.fenAfter) !== false;
  }

  function onSquareClick(square: string) {
    if (!highlightLegal) return;
    if (!interactive) {
      setSelected((prev) => (prev === square ? null : square));
      return;
    }
    const tap = resolveTap(fen, selected, square);
    if (tap.kind === "move") {
      setSelected(null);
      onMove?.(tap.san, tap.fenAfter);
    } else {
      setSelected(tap.square);
    }
  }

  return (
    <div
      className={cn(
        // Fill the column, but never taller than the screen leaves room for:
        // on a phone the width wins, on a short landscape screen the height does.
        "w-full max-w-[min(560px,calc(100svh_-_13rem))] select-none",
        className,
      )}
      style={interactive ? { touchAction: "none" } : undefined}
      data-testid="board"
    >
      <Chessboard
        id="dojo-board"
        position={fen}
        boardOrientation={orientation}
        arePiecesDraggable={interactive}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        customSquareStyles={squareStyles}
        customArrows={arrows as never}
        areArrowsAllowed={false}
        animationDuration={animationDuration}
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
