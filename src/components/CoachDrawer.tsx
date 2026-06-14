"use client";

/**
 * CoachDrawer — a side drawer that asks the constrained AI coach about the
 * current position. POSTs a CoachRequest to /api/coach (built by another lane;
 * may be absent). Fetch failures are handled gracefully — the drawer never
 * crashes the lesson page.
 */
import * as React from "react";
import { legalMoves } from "@/lib/chess-rules";
import type { CoachRequest, CoachResponse } from "@/lib/types";
import { Button } from "@/components/ui";

export interface CoachDrawerProps {
  open: boolean;
  onClose: () => void;
  openingName: string;
  fen: string;
  lessonExplanation?: string;
  commonMistake?: string | null;
}

type Status = "idle" | "loading" | "done" | "error";

export function CoachDrawer({
  open,
  onClose,
  openingName,
  fen,
  lessonExplanation,
  commonMistake,
}: CoachDrawerProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [answer, setAnswer] = React.useState("");

  async function ask() {
    setStatus("loading");
    setAnswer("");
    const body: CoachRequest = {
      openingName,
      fen,
      legalMoves: legalMoves(fen),
      lessonExplanation,
      commonMistake: commonMistake ?? undefined,
      skillLevel: "returning adult beginner",
      question: { kind: "why-good" },
    };
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`coach responded ${res.status}`);
      const data = (await res.json()) as CoachResponse;
      setAnswer(data.answer);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-label="AI coach"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-4 border-l border-border bg-card p-6 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ask the coach</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close coach">
          ✕
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Ask why this move works in the current position. The coach explains —
        it never decides legality.
      </p>
      <Button onClick={ask} disabled={status === "loading"}>
        {status === "loading" ? "Thinking…" : "Why is this a good move?"}
      </Button>
      {status === "done" && (
        <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
          {answer}
        </div>
      )}
      {status === "error" && (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          The coach is unavailable right now. The lesson notes on the right
          still cover this move — try again later.
        </div>
      )}
    </aside>
  );
}
