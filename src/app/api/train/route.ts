/**
 * Repertoire trainer API.
 *
 * GET  /api/train?opening=<slug|all>&mode=<review|line>
 *   → today's session: positions to quiz, with hints and explanations.
 * POST /api/train  { cardKey, correct, hintUsed }
 *   → records the result and returns when the position comes back.
 *
 * The user is resolved on the server (single demo user for now); the client
 * never chooses whose schedule it writes to. Correctness of the move itself
 * is decided client-side by chess-rules, exactly as in drill mode; the server
 * only accepts keys of real repertoire positions.
 */
import { NextResponse } from "next/server";
import { DEMO_USER_ID, prisma } from "@/lib/db";
import { getOpeningBySlug } from "@/lib/opening-content";
import { loadSession, recordReview, UnknownCardError, type TrainMode } from "@/lib/training";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const opening = params.get("opening") ?? "all";
  const mode: TrainMode = params.get("mode") === "line" ? "line" : "review";
  if (opening !== "all" && !getOpeningBySlug(opening)) {
    return NextResponse.json({ error: "Unknown opening" }, { status: 404 });
  }
  try {
    const session = await loadSession(prisma, DEMO_USER_ID, { slug: opening, mode });
    return NextResponse.json(session);
  } catch (err) {
    console.error("GET /api/train failed:", err);
    return NextResponse.json({ error: "Could not load training" }, { status: 500 });
  }
}

function isReviewBody(v: unknown): v is { cardKey: string; correct: boolean; hintUsed: number } {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.cardKey === "string" &&
    b.cardKey.length > 0 &&
    b.cardKey.length < 200 &&
    typeof b.correct === "boolean" &&
    typeof b.hintUsed === "number" &&
    Number.isInteger(b.hintUsed) &&
    b.hintUsed >= 0 &&
    b.hintUsed <= 3
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isReviewBody(body)) {
    return NextResponse.json(
      { error: "Invalid review (need cardKey, correct, hintUsed 0-3)" },
      { status: 400 },
    );
  }
  try {
    const result = await recordReview(prisma, DEMO_USER_ID, body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnknownCardError) {
      return NextResponse.json({ error: "Unknown position" }, { status: 404 });
    }
    console.error("POST /api/train failed:", err);
    return NextResponse.json({ error: "Could not save review" }, { status: 500 });
  }
}
