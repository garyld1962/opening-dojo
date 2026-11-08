"use client";

/**
 * Drill page (PRD §11.4). Drives one opening line: chessboard, prompt, feedback
 * panel, hint button, progress indicator, and an "Explain this" coach button.
 *
 * All correctness/scoring decisions come from the drill-engine; this component
 * only renders state and persists resolved attempts. The Board component is
 * owned by Lane A (`@/components/Board`) and supplies square-based moves.
 */
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/Board";
import { boardOrientation, legalMoves } from "@/lib/chess-rules";
import {
  buildDrillSteps,
  evaluateAttempt,
  toAttemptPayload,
  type DrillLine,
} from "@/lib/drill-engine";
import type {
  CoachRequest,
  DrillFeedback,
  DrillStep,
  HintLevel,
  MoveExplanation,
  Side,
} from "@/lib/types";

interface DrillData {
  openingName: string;
  trainedSide: Side;
  line: { id: string; name: string; startingFen: string; moveSequencePgn: string };
  moves: MoveExplanation[];
}

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export default function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { slug } = use(params);
  const lineParam = use(searchParams).line;

  const [data, setData] = useState<DrillData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [fen, setFen] = useState<string>("");
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const [score, setScore] = useState(0);
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  // Load the seeded line + explanations for this opening.
  useEffect(() => {
    let cancelled = false;
    const lineQuery = lineParam ? `&line=${encodeURIComponent(lineParam)}` : "";
    fetch(`/api/drills?slug=${encodeURIComponent(slug)}${lineQuery}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: DrillData) => {
        if (cancelled) return;
        setData(d);
        setFen(d.line.startingFen);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, lineParam]);

  const drill: DrillLine | null = useMemo(
    () =>
      data
        ? { line: data.line, trainedSide: data.trainedSide, moves: data.moves }
        : null,
    [data],
  );

  const steps: DrillStep[] = useMemo(
    () => (drill ? buildDrillSteps(drill) : []),
    [drill],
  );

  const step = steps[stepIndex] ?? null;
  const complete = stepIndex >= steps.length && steps.length > 0;

  // Keep the rendered FEN aligned with the current step's position.
  useEffect(() => {
    if (step) setFen(step.fenBefore);
  }, [step]);

  const persist = useCallback(
    (s: DrillStep, fb: DrillFeedback, san: string) => {
      const payload = toAttemptPayload(DEMO_USER_ID, s, fb, san);
      fetch("/api/drills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        /* persistence is best-effort from the client */
      });
    },
    [],
  );

  // Board (Lane A) validates legality and reports the move as (SAN, FEN-after).
  // We never re-derive the move from squares here — the deterministic core
  // already did that inside Board.
  const onMove = useCallback(
    (san: string): boolean => {
      if (!drill || !step) return false;

      const fb = evaluateAttempt(drill, step, san, hintLevel, steps);
      setFeedback(fb);
      setScore((s) => s + fb.scoreDelta);
      persist(step, fb, san);

      // Correct, OR the 3rd miss revealed the answer: the step is resolved.
      // Advance past it (the revealed move is auto-played, never replayed for
      // credit). A reveal already charged -1; the revealed move earns nothing.
      if (fb.correct || fb.hintLevel === 3) {
        if (fb.fenAfter) setFen(fb.fenAfter);
        setHintLevel(0);
        setStepIndex((i) => i + 1);
        return true;
      }
      // Incorrect (but legal) move below reveal: escalate the hint, snap back.
      setHintLevel(fb.hintLevel);
      setFen(step.fenBefore);
      return false;
    },
    [drill, step, hintLevel, steps, persist],
  );

  const askCoach = useCallback(async () => {
    if (!data || !step) return;
    setCoachLoading(true);
    setCoachAnswer(null);
    const explanation = data.moves.find((m) => m.id === step.moveExplanationId);
    const body: CoachRequest = {
      openingName: data.openingName,
      fen: step.fenBefore,
      legalMoves: legalMoves(step.fenBefore),
      expectedMove: step.expectedSan,
      lessonExplanation: explanation?.explanation,
      commonMistake: explanation?.commonMistake ?? undefined,
      skillLevel: "returning adult beginner",
      question: { kind: "why-good" },
    };
    try {
      const r = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as { answer?: string };
      setCoachAnswer(json.answer ?? "No explanation available.");
    } catch {
      setCoachAnswer("The coach is unavailable right now.");
    } finally {
      setCoachLoading(false);
    }
  }, [data, step]);

  if (loadError) {
    return <main className="p-6">Could not load this drill: {loadError}</main>;
  }
  if (!data || !drill) {
    return <main className="p-6">Loading drill…</main>;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:p-6 md:flex-row md:gap-6">
      <div className="flex w-full justify-center md:w-auto md:max-w-[560px] md:flex-1">
        <Board
          fen={fen}
          orientation={boardOrientation(data.trainedSide)}
          onMove={onMove}
        />
      </div>

      <section className="flex flex-1 flex-col gap-4">
        <header>
          <h1 className="text-xl font-semibold">{data.openingName}</h1>
          <p className="text-sm text-gray-500">{data.line.name}</p>
        </header>

        {/* Progress indicator */}
        <p className="text-sm" data-testid="progress">
          Move {Math.min(stepIndex + 1, steps.length)} of {steps.length} · Score{" "}
          {score}
        </p>

        {/* Prompt */}
        {!complete && step && (
          <p className="text-lg font-medium" data-testid="prompt">
            {step.prompt}
          </p>
        )}
        {complete && (
          <p className="text-lg font-medium text-green-700">
            Line complete — well done.
          </p>
        )}

        {/* Feedback panel */}
        {feedback && !complete && (
          <div className="rounded border p-3" data-testid="feedback">
            {feedback.correct && (
              <p className="text-green-700">
                Correct{" "}
                {feedback.opponentReplySan
                  ? `— opponent replied ${feedback.opponentReplySan}.`
                  : "."}
              </p>
            )}
            {!feedback.correct && feedback.hintLevel < 3 && feedback.hint && (
              <p className="text-amber-700">Hint: {feedback.hint}</p>
            )}
            {!feedback.correct && feedback.hintLevel === 3 && (
              <p className="text-red-700">
                The move was <strong>{feedback.revealedSan}</strong>.{" "}
                {feedback.revealExplanation}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {/* Hint button — escalates a level without consuming a move */}
          <button
            type="button"
            className="min-h-11 flex-1 rounded border px-3 py-1 text-sm sm:flex-none"
            disabled={complete || !step || hintLevel >= 3}
            onClick={() => {
              if (!drill || !step) return;
              // Force a miss to surface the next hint level.
              const fb = evaluateAttempt(drill, step, "@@nomove@@", hintLevel, steps);
              setFeedback(fb);
              // Reaching the reveal via the hint ladder scores -1 and resolves
              // the step (PRD §6.5), advancing past it just like a 3rd miss.
              if (fb.hintLevel === 3) {
                setScore((s) => s + fb.scoreDelta);
                persist(step, fb, "(revealed)");
                if (fb.fenAfter) setFen(fb.fenAfter);
                setHintLevel(0);
                setStepIndex((i) => i + 1);
              } else {
                setHintLevel(fb.hintLevel);
              }
            }}
          >
            Hint
          </button>

          {/* Explain this — constrained coach request */}
          <button
            type="button"
            className="min-h-11 flex-1 rounded border px-3 py-1 text-sm sm:flex-none"
            disabled={complete || !step || coachLoading}
            onClick={askCoach}
          >
            {coachLoading ? "Asking…" : "Explain this"}
          </button>
        </div>

        {coachAnswer && (
          <div className="rounded border bg-gray-50 p-3 text-sm" data-testid="coach">
            {coachAnswer}
          </div>
        )}
      </section>
    </main>
  );
}
