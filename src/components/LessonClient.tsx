"use client";

/**
 * LessonClient — interactive lesson stepper (PRD §11.3).
 * Chessboard left, explanation panel right, move list below, Next/Previous
 * controls, and an AI-coach drawer. Steps through the opening's primary line.
 */
import * as React from "react";
import Link from "next/link";
import { Board, MoveList } from "@/components/Board";
import { CoachDrawer } from "@/components/CoachDrawer";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { buildLessonSteps, type LessonStep } from "@/components/lesson-steps";
import { boardOrientation } from "@/lib/chess-rules";
import type { LineContent } from "@/lib/opening-content";
import type { Side } from "@/lib/types";

export interface LessonClientProps {
  slug: string;
  openingName: string;
  side: Side;
  line: LineContent;
}

export function LessonClient({
  slug,
  openingName,
  side,
  line,
}: LessonClientProps) {
  const steps = React.useMemo<LessonStep[]>(
    () => buildLessonSteps(line),
    [line],
  );
  const [index, setIndex] = React.useState(0);
  const [coachOpen, setCoachOpen] = React.useState(false);

  const step = steps[index];
  const orientation = boardOrientation(side);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/openings/${slug}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {openingName}
          </Link>
          <h1 className="text-2xl font-bold">Lesson: {line.name}</h1>
        </div>
        <Link href={`/openings/${slug}/drill`}>
          <Button variant="secondary">Start drills</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,480px)_1fr]">
        <div className="flex flex-col gap-4">
          <Board
            fen={step.fenAfter}
            orientation={orientation}
            interactive={false}
            highlightLegal={false}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              ← Previous
            </Button>
            <span className="text-sm text-muted-foreground" data-testid="step-counter">
              Move {index + 1} of {steps.length}
            </span>
            <Button
              variant="secondary"
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={index === steps.length - 1}
            >
              Next →
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {step.moveNumber}. {step.san}
                {step.theme && (
                  <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                    {step.theme}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p data-testid="explanation">{step.explanation}</p>
              {step.commonMistake && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Common mistake:{" "}
                  </span>
                  {step.commonMistake}
                </p>
              )}
              <Button variant="ghost" onClick={() => setCoachOpen(true)}>
                Ask the coach
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Moves</CardTitle>
            </CardHeader>
            <CardContent>
              <MoveList
                sans={steps.map((s) => s.san)}
                activePly={index}
                onSelectPly={setIndex}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <CoachDrawer
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        openingName={openingName}
        fen={step.fenAfter}
        lessonExplanation={step.explanation}
        commonMistake={step.commonMistake}
      />
    </main>
  );
}
