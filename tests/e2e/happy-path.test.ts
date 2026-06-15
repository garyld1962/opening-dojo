/**
 * End-to-end happy path (PRD §10.2 demo flow), exercised against the seeded
 * test DB by driving the real route handlers and domain modules directly:
 *
 *   open London lesson → make correct moves → make a wrong move → get a hint →
 *   call the coach (mocked model) → switch to a Caro-Kann Advance drill →
 *   record an attempt → progress updates.
 *
 * Isolated under a dedicated e2e user; seeded content is read-only.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import { PrismaClient } from "../../src/generated/prisma";
import { getOpeningBySlug } from "@/lib/opening-content";
import { validateLineDetailed } from "@/lib/chess-rules";
import {
  buildDrillSteps,
  evaluateAttempt,
  toAttemptPayload,
  type DrillLine,
} from "@/lib/drill-engine";
import { overallConfidence } from "@/lib/progress-tracking";
import { GET as drillsGET, POST as drillsPOST } from "@/app/api/drills/route";
import { POST as coachPOST } from "@/app/api/coach/route";
import type { CoachRequest } from "@/lib/types";

const prisma = new PrismaClient();
const E2E_USER = "test-user-e2e";

function req(url: string, body?: unknown): Request {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("e2e: PRD §10.2 demo flow", () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: E2E_USER },
      update: {},
      create: { id: E2E_USER },
    });
  });

  afterAll(async () => {
    await prisma.drillAttempt.deleteMany({ where: { userId: E2E_USER } });
    await prisma.userProgress.deleteMany({ where: { userId: E2E_USER } });
    await prisma.user.delete({ where: { id: E2E_USER } }).catch(() => {});
    await prisma.$disconnect();
    vi.unstubAllGlobals();
  });

  it("walks lesson → drill (correct, wrong→hint) → coach → Caro drill → attempt → progress", async () => {
    // 1. Open the London lesson: every move has an explanation (N2).
    const london = getOpeningBySlug("london-system");
    expect(london).toBeDefined();
    const primary = london!.lines[0];
    const lessonPlies = validateLineDetailed(primary.startingFen, primary.pgn);
    expect(lessonPlies.ok).toBe(true);
    if (lessonPlies.ok) {
      expect(lessonPlies.moves.length).toBe(primary.moves.length);
      expect(primary.moves.every((m) => m.explanation.trim().length > 0)).toBe(
        true,
      );
    }

    // 2. Load the London drill via the real route handler.
    const drillRes = await drillsGET(
      req("http://localhost/api/drills?slug=london-system"),
    );
    expect(drillRes.status).toBe(200);
    const drillData = (await drillRes.json()) as {
      openingName: string;
      trainedSide: "white" | "black";
      line: { id: string; startingFen: string; moveSequencePgn: string };
      moves: { id: string; moveNumber: number }[];
    };
    const drill: DrillLine = {
      line: drillData.line,
      trainedSide: drillData.trainedSide,
      // Cast: route returns MoveExplanation rows verbatim.
      moves: drillData.moves as never,
    };
    const steps = buildDrillSteps(drill);
    expect(steps.length).toBeGreaterThan(0);

    // 3. Make the correct first move → +3, opponent reply played.
    const first = steps[0];
    const good = evaluateAttempt(drill, first, first.expectedSan, 0, steps);
    expect(good.correct).toBe(true);
    expect(good.scoreDelta).toBe(3);
    expect(good.opponentReplySan).toBeTruthy();

    // 4. Make a wrong move on the next step → first hint (L1).
    const second = steps[1];
    const wrong = evaluateAttempt(drill, second, "a3", 0, steps);
    expect(wrong.correct).toBe(false);
    expect(wrong.hintLevel).toBe(1);

    // 5. Ask the coach — mock the model transport (no real Ollama).
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: "Bf4 develops the bishop before e3." } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
    const coachReq: CoachRequest = {
      openingName: drillData.openingName,
      fen: second.fenBefore,
      legalMoves: ["Bf4", "e3", "Nf3"],
      expectedMove: second.expectedSan,
      attemptedMove: "a3",
      lessonExplanation: "Develop the dark-square bishop before e3.",
      skillLevel: "returning adult beginner",
      question: { kind: "what-wrong" },
    };
    const coachRes = await coachPOST(req("http://localhost/api/coach", coachReq));
    expect(coachRes.status).toBe(200);
    const coachJson = (await coachRes.json()) as { answer: string };
    expect(coachJson.answer).toContain("Bf4");
    expect(mockFetch).toHaveBeenCalled(); // model was called server-side

    // 6. Switch to a Caro-Kann Advance drill (load the Advance line directly).
    const caro = getOpeningBySlug("caro-kann");
    const advanceContent = caro!.lines.find((l) => l.name.includes("Advance"))!;
    const advanceLine = await prisma.line.findFirst({
      where: { name: advanceContent.name, opening: { name: caro!.name } },
      include: { moves: { orderBy: { moveNumber: "asc" } } },
    });
    expect(advanceLine).not.toBeNull();
    const caroDrill: DrillLine = {
      line: advanceLine!,
      trainedSide: "black",
      moves: advanceLine!.moves,
    };
    const caroSteps = buildDrillSteps(caroDrill);
    expect(caroSteps.length).toBeGreaterThan(0);
    const caroStep = caroSteps[0];
    const caroFb = evaluateAttempt(
      caroDrill,
      caroStep,
      caroStep.expectedSan,
      0,
      caroSteps,
    );
    expect(caroFb.correct).toBe(true);

    // 7. Record the attempt via the real POST route (persists + updates progress).
    const payload = toAttemptPayload(E2E_USER, caroStep, caroFb, caroStep.expectedSan);
    const postRes = await drillsPOST(req("http://localhost/api/drills", payload));
    expect(postRes.status).toBe(201);

    const persisted = await prisma.drillAttempt.findFirst({
      where: { userId: E2E_USER, lineId: caroStep.lineId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.correct).toBe(true);

    // 8. Progress updated for the e2e user (N7): a correct first try → +3.
    const confidence = await overallConfidence(prisma, E2E_USER);
    expect(confidence).toBeGreaterThan(0);
    const progressRow = await prisma.userProgress.findFirst({
      where: { userId: E2E_USER, lineId: caroStep.lineId },
    });
    expect(progressRow?.confidenceScore).toBe(3);
  });
});
