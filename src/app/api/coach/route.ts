import type { CoachRequest } from "@/lib/types";
import { callCoach } from "@/lib/ai-coach";

/**
 * POST /api/coach — server-side coach endpoint.
 *
 * The request already carries `legalMoves` from chess-rules; this handler does
 * NOT compute or assert legality. It forwards the constrained request to the
 * Ollama client and returns a CoachResponse. Model/transport failures are
 * caught and returned as a graceful 503 — the route never crashes.
 */
export async function POST(req: Request): Promise<Response> {
  let body: CoachRequest;
  try {
    body = (await req.json()) as CoachRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const response = await callCoach(body);
    return Response.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coach unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}
