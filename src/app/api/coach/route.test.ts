import { describe, it, expect, vi, afterEach } from "vitest";
import type { CoachRequest } from "@/lib/types";
import { POST } from "./route";
import * as client from "@/lib/ai-coach";

const req: CoachRequest = {
  openingName: "London System",
  fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
  legalMoves: ["d5", "Nf6", "c5"],
  skillLevel: "returning adult beginner",
  question: { kind: "what-plan" },
};

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/coach", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/coach", () => {
  it("returns a 200 CoachResponse on success", async () => {
    vi.spyOn(client, "callCoach").mockResolvedValue({
      answer: "Build a solid pawn triangle.",
      model: "test-model",
    });
    const res = await POST(postRequest(req));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      answer: "Build a solid pawn triangle.",
      model: "test-model",
    });
  });

  it("returns a graceful 503 (no crash) when the coach fails", async () => {
    vi.spyOn(client, "callCoach").mockRejectedValue(
      new client.CoachError("Coach transport request failed"),
    );
    const res = await POST(postRequest(req));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 on an invalid JSON body", async () => {
    const bad = new Request("http://localhost/api/coach", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });
});
