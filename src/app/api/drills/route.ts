/**
 * POST /api/drills — persist a single drill attempt (PRD §6.3 step 7, §12.4).
 *
 * Accepts an AttemptPayload (see drill-engine.toAttemptPayload) and writes a
 * DrillAttempt row. The engine — not this route — decides correctness and
 * scoring; this endpoint only persists the resolved result.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpeningBySlug } from "@/lib/opening-content";
import { updateProgressForAttempt } from "@/lib/progress-tracking";
import type { AttemptPayload } from "@/lib/drill-engine";

/**
 * GET /api/drills?slug=<opening-slug> — load the highest-priority active line
 * for an opening plus its MoveExplanation rows and trained side, so the client
 * drill page can build DrillSteps with real DB ids (FK-valid persistence).
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  const content = getOpeningBySlug(slug);
  if (!content) {
    return NextResponse.json({ error: "Unknown opening" }, { status: 404 });
  }

  try {
    const opening = await prisma.opening.findFirst({
      where: { name: content.name },
      include: {
        lines: {
          where: { active: true },
          orderBy: { priority: "asc" },
          include: { moves: { orderBy: { moveNumber: "asc" } } },
        },
      },
    });
    const line = opening?.lines[0];
    if (!opening || !line) {
      return NextResponse.json({ error: "No active line" }, { status: 404 });
    }
    return NextResponse.json({
      openingName: opening.name,
      trainedSide: opening.side === "white" ? "white" : "black",
      line: {
        id: line.id,
        name: line.name,
        startingFen: line.startingFen,
        moveSequencePgn: line.moveSequencePgn,
      },
      moves: line.moves,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Could not load drill", detail: message },
      { status: 500 },
    );
  }
}

function isAttemptPayload(value: unknown): value is AttemptPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === "string" &&
    typeof v.lineId === "string" &&
    (typeof v.moveExplanationId === "string" || v.moveExplanationId === null) &&
    typeof v.attemptedMove === "string" &&
    typeof v.expectedMove === "string" &&
    typeof v.correct === "boolean" &&
    typeof v.hintUsed === "number"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isAttemptPayload(body)) {
    return NextResponse.json(
      { error: "Invalid attempt payload" },
      { status: 400 },
    );
  }

  try {
    const attempt = await prisma.drillAttempt.create({
      data: {
        userId: body.userId,
        lineId: body.lineId,
        moveExplanationId: body.moveExplanationId,
        attemptedMove: body.attemptedMove,
        expectedMove: body.expectedMove,
        correct: body.correct,
        hintUsed: body.hintUsed,
      },
    });

    // Wire the persisted attempt into progress tracking (N7): a recorded
    // attempt moves the line's confidence score. The line's openingId is
    // looked up so per-opening aggregates attribute correctly.
    const line = await prisma.line.findUnique({
      where: { id: body.lineId },
      select: { openingId: true },
    });
    await updateProgressForAttempt(prisma, {
      userId: body.userId,
      lineId: body.lineId,
      openingId: line?.openingId,
      correct: body.correct,
      hintUsed: body.hintUsed,
    });

    return NextResponse.json(attempt, { status: 201 });
  } catch (err) {
    // FK violation (bad lineId/moveExplanationId) or DB unavailable.
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Could not persist attempt", detail: message },
      { status: 422 },
    );
  }
}
