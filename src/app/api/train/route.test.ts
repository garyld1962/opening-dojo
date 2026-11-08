import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/train", () => {
  it("404s an unknown opening", async () => {
    const res = await GET(new Request("http://localhost/api/train?opening=kings-gambit"));
    expect(res.status).toBe(404);
  });

  it("400s malformed reviews", async () => {
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ cardKey: "x", correct: true, hintUsed: 7 }))).status).toBe(400);
    expect((await POST(post({ cardKey: "x", correct: "yes", hintUsed: 0 }))).status).toBe(400);
  });

  it("404s a review for a position that isn't in the repertoire", async () => {
    const res = await POST(post({ cardKey: "caro-kann:not-a-position", correct: true, hintUsed: 0 }));
    expect(res.status).toBe(404);
  });
});
