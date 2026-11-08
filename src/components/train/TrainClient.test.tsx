import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { openings } from "@/lib/opening-content";
import { buildRepertoire, trainingCards } from "@/lib/repertoire";
import { toTrainItem, type TrainSession } from "@/lib/training";
import { TrainClient } from "./TrainClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const caro = buildRepertoire(openings.find((o) => o.slug === "caro-kann")!);
const session: TrainSession = {
  mode: "review",
  items: trainingCards(caro)
    .slice(0, 1)
    .map((c) => toTrainItem(c, true)),
  stats: { due: 0, newToday: 1, unseen: 38, learned: 0, total: 38 },
};

let posts: unknown[] = [];

beforeEach(() => {
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ nextReview: "10 min" }), { status: 200 });
      }
      return new Response(JSON.stringify(session), { status: 200 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderTrainer() {
  return render(
    <TrainClient
      openings={[{ slug: "caro-kann", name: "Caro-Kann Defense" }]}
      initialOpening="caro-kann"
      initialMode="review"
    />,
  );
}

describe("TrainClient", () => {
  it("loads a session and shows the position, path and stats", async () => {
    renderTrainer();
    expect(await screen.findByTestId("train-prompt")).toHaveTextContent("Black to move");
    expect(screen.getByTestId("train-path")).toHaveTextContent("1. e4");
    expect(screen.getByTestId("train-stats")).toHaveTextContent("0 due");
    expect(screen.getByText("New position")).toBeInTheDocument();
  });

  it("walks the hint ladder, reveals, records the review, and requeues the miss", async () => {
    renderTrainer();
    await screen.findByTestId("train-prompt");

    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByTestId("train-hint1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByTestId("train-hint2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));

    expect(screen.getByTestId("train-result")).toHaveTextContent("The move is c6");
    await waitFor(() =>
      expect(posts).toEqual([
        { cardKey: session.items[0].cardKey, correct: false, hintUsed: 3 },
      ]),
    );
    expect(await screen.findByTestId("train-next-review")).toHaveTextContent("10 min");

    // The missed position comes back once at the end of the session.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next position" }));
    });
    expect(await screen.findByTestId("train-prompt")).toBeInTheDocument();
    expect(screen.queryByText("New position")).not.toBeInTheDocument();
  });

  it("shows a summary when the session is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ...session, items: [] }), { status: 200 })),
    );
    renderTrainer();
    expect(await screen.findByTestId("train-summary")).toHaveTextContent("Nothing due right now");
  });
});
