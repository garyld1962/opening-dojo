import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CoachRequest } from "@/lib/types";
import {
  buildCoachPrompt,
  callCoach,
  CoachError,
  COACH_SYSTEM_PROMPT,
  coachLog,
} from "@/lib/ai-coach";

const baseReq: CoachRequest = {
  openingName: "London System",
  fen: "rnbqkbnr/pp2pppp/2p5/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3",
  legalMoves: ["Nf3", "e3", "Nd2", "Bxb8"],
  expectedMove: "e3",
  lessonExplanation: "Support the d4 pawn and open a path for the bishop.",
  commonMistake: "Playing c4 too early loosens the queenside.",
  skillLevel: "returning adult beginner",
  question: { kind: "why-good" },
};

function fakeOkTransport(content: string): typeof fetch {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as unknown as typeof fetch;
}

describe("buildCoachPrompt", () => {
  it("embeds the system prompt, FEN, legal moves, and lesson explanation", () => {
    const { system, user } = buildCoachPrompt(baseReq);
    expect(system).toBe(COACH_SYSTEM_PROMPT);
    expect(user).toContain(baseReq.fen);
    for (const move of baseReq.legalMoves) {
      expect(user).toContain(move);
    }
    expect(user).toContain(baseReq.lessonExplanation!);
    expect(user).toContain(baseReq.openingName);
  });

  it("omits optional fields that are not present", () => {
    const { user } = buildCoachPrompt({
      openingName: "Caro-Kann",
      fen: "fen-here",
      legalMoves: ["c6"],
      skillLevel: "beginner",
    });
    expect(user).not.toContain("Expected move:");
    expect(user).not.toContain("Engine evaluation:");
  });
});

describe("callCoach", () => {
  beforeEach(() => {
    coachLog.length = 0;
  });

  it("calls the transport and returns a CoachResponse", async () => {
    const transport = fakeOkTransport("Develop your pieces toward the center.");
    const res = await callCoach(baseReq, {
      transport,
      baseUrl: "http://test:11434",
      model: "test-model",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = (transport as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://test:11434/v1/chat/completions");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.model).toBe("test-model");
    expect(payload.stream).toBe(false);
    expect(payload.messages[0].role).toBe("system");
    expect(res).toEqual({
      answer: "Develop your pieces toward the center.",
      model: "test-model",
    });
  });

  it("logs both the request and the response (N5)", async () => {
    expect(coachLog).toHaveLength(0);
    await callCoach(baseReq, {
      transport: fakeOkTransport("ok"),
      baseUrl: "http://test:11434",
      model: "test-model",
    });
    expect(coachLog.length).toBeGreaterThanOrEqual(2);
    expect(coachLog.some((e) => e.direction === "request")).toBe(true);
    expect(coachLog.some((e) => e.direction === "response")).toBe(true);
  });

  it("throws a CoachError when the transport throws", async () => {
    const transport = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(
      callCoach(baseReq, {
        transport,
        baseUrl: "http://test:11434",
        model: "test-model",
      }),
    ).rejects.toBeInstanceOf(CoachError);
  });

  it("throws a CoachError on a non-ok HTTP response", async () => {
    const transport = vi.fn(async () =>
      new Response("upstream down", { status: 502 }),
    ) as unknown as typeof fetch;
    await expect(
      callCoach(baseReq, {
        transport,
        baseUrl: "http://test:11434",
        model: "test-model",
      }),
    ).rejects.toBeInstanceOf(CoachError);
  });
});

describe("legality boundary (N5/N6)", () => {
  it("ai-coach source never references move-application/legality APIs", () => {
    const dir = resolve(__dirname);
    const forbidden = [
      "applyMove",
      "isLegal",
      "applyMoveFromSquares",
      "legalMoves(",
    ];
    const sources = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    for (const file of sources) {
      const src = readFileSync(resolve(dir, file), "utf8");
      for (const token of forbidden) {
        expect(src, `${file} must not reference ${token}`).not.toContain(token);
      }
    }
  });
});
