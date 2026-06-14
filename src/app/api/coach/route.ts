import type { CoachRequest } from "@/lib/types";
import { callCoach } from "@/lib/ai-coach";

/** Minimal runtime shape guard for the constrained coach payload. */
function isCoachRequest(value: unknown): value is CoachRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.openingName === "string" &&
    typeof v.fen === "string" &&
    Array.isArray(v.legalMoves) &&
    v.legalMoves.every((m) => typeof m === "string") &&
    typeof v.skillLevel === "string"
  );
}

/**
 * POST /api/coach — server-side coach endpoint.
 *
 * The request already carries `legalMoves` from chess-rules; this handler does
 * NOT compute or assert legality. It forwards the constrained request to the
 * Ollama client and returns a CoachResponse. Model/transport failures are
 * caught and returned as a graceful 503 — the route never crashes.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isCoachRequest(body)) {
    return Response.json(
      { error: "Invalid coach request (need openingName, fen, legalMoves[], skillLevel)" },
      { status: 400 },
    );
  }

  try {
    const response = await callCoach(body);
    return Response.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coach unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}
