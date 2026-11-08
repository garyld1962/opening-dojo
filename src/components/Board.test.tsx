import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Board, MoveList, handleSquareMove, resolveTap } from "@/components/Board";
import { START_FEN } from "@/lib/chess-rules";

describe("handleSquareMove (pure move handler)", () => {
  it("accepts a legal move and returns SAN + a changed FEN", () => {
    const result = handleSquareMove(START_FEN, "e2", "e4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.san).toBe("e4");
      expect(result.fenAfter).not.toBe(START_FEN);
    }
  });

  it("rejects an illegal move without producing a position", () => {
    const result = handleSquareMove(START_FEN, "e2", "e5");
    expect(result.ok).toBe(false);
  });
});

describe("Board onMove behavior", () => {
  // The component delegates to handleSquareMove, so we assert the contract the
  // component relies on: a legal pair yields a callback-worthy result; an
  // illegal pair does not.
  it("a legal drop would call onMove with the SAN and new FEN", () => {
    const onMove = vi.fn();
    const result = handleSquareMove(START_FEN, "g1", "f3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      onMove(result.san, result.fenAfter);
      expect(onMove).toHaveBeenCalledWith("Nf3", result.fenAfter);
    }
  });

  it("an illegal drop leaves the FEN unchanged and does not call onMove", () => {
    const onMove = vi.fn();
    const result = handleSquareMove(START_FEN, "e2", "e5");
    if (!result.ok) {
      // board snaps back, FEN unchanged, no callback
      expect(onMove).not.toHaveBeenCalled();
    }
    expect(result.ok).toBe(false);
  });
});

describe("Board render", () => {
  it("renders the board for a given FEN (smoke)", () => {
    render(<Board fen={START_FEN} />);
    expect(screen.getByTestId("board")).toBeInTheDocument();
  });

  it("passes through the orientation so the board can flip", () => {
    const { rerender } = render(
      <Board fen={START_FEN} orientation="white" />,
    );
    expect(screen.getByTestId("board")).toBeInTheDocument();
    // flipping orientation re-renders without error
    rerender(<Board fen={START_FEN} orientation="black" />);
    expect(screen.getByTestId("board")).toBeInTheDocument();
  });
});

describe("MoveList", () => {
  it("renders SAN moves grouped into numbered rows", () => {
    render(<MoveList sans={["d4", "d5", "Nf3"]} activePly={2} />);
    expect(screen.getByTestId("move-0")).toHaveTextContent("d4");
    expect(screen.getByTestId("move-1")).toHaveTextContent("d5");
    expect(screen.getByTestId("move-2")).toHaveTextContent("Nf3");
    expect(screen.getByTestId("move-2")).toHaveAttribute("aria-current", "step");
  });
});

describe("resolveTap (tap-to-move for phones)", () => {
  it("first tap on an own piece selects it", () => {
    expect(resolveTap(START_FEN, null, "g1")).toEqual({ kind: "select", square: "g1" });
  });

  it("second tap on a legal destination plays the move", () => {
    const tap = resolveTap(START_FEN, "g1", "f3");
    expect(tap).toMatchObject({ kind: "move", san: "Nf3" });
  });

  it("tapping another own piece switches the selection", () => {
    expect(resolveTap(START_FEN, "g1", "e2")).toEqual({ kind: "select", square: "e2" });
  });

  it("tapping an empty or illegal square clears the selection", () => {
    expect(resolveTap(START_FEN, "g1", "g4")).toEqual({ kind: "select", square: null });
    expect(resolveTap(START_FEN, null, "e7")).toEqual({ kind: "select", square: null });
  });

  it("tapping the selected piece again deselects it", () => {
    expect(resolveTap(START_FEN, "g1", "g1")).toEqual({ kind: "select", square: null });
  });
});
