import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressView } from "./ProgressView";
import { suggestNextDrill } from "./suggest";
import { HomeView } from "../HomeView";
import type { ProgressSummaryView } from "./data";

const summary: ProgressSummaryView = {
  overallConfidence: 4.5,
  openings: [
    {
      openingName: "London System",
      openingSlug: "london-system",
      averageConfidence: 6,
      lineCount: 2,
      completedLessons: 1,
    },
    {
      openingName: "Caro-Kann Defense",
      openingSlug: "caro-kann",
      averageConfidence: 3,
      lineCount: 1,
      completedLessons: 0,
    },
  ],
  weakLines: [
    {
      lineId: "l1",
      lineName: "Advance Variation",
      openingName: "Caro-Kann Defense",
      openingSlug: "caro-kann",
      confidenceScore: 1,
    },
  ],
};

const emptySummary: ProgressSummaryView = {
  overallConfidence: 0,
  openings: [],
  weakLines: [],
};

describe("suggestNextDrill", () => {
  it("suggests the weakest line's drill route", () => {
    const s = suggestNextDrill(summary);
    expect(s).not.toBeNull();
    expect(s?.href).toBe("/openings/caro-kann/drill");
    expect(s?.lineName).toBe("Advance Variation");
  });

  it("falls back to the first curated opening when no progress exists", () => {
    const s = suggestNextDrill(emptySummary);
    expect(s).not.toBeNull();
    // Real, routable slug from curated content.
    expect(s?.href).toMatch(/^\/openings\/[a-z-]+\/drill$/);
    expect(s?.lineName).toBeNull();
  });
});

describe("ProgressView (PRD §11.5, N7)", () => {
  it("renders overall confidence, per-opening progress, and weak lines", () => {
    render(
      <ProgressView summary={summary} suggestion={suggestNextDrill(summary)} />,
    );
    expect(screen.getByTestId("overall-confidence")).toHaveTextContent("4.5");
    expect(screen.getByText("London System")).toBeInTheDocument();
    expect(screen.getByText("Caro-Kann Defense")).toBeInTheDocument();
    const weak = screen.getByTestId("weak-lines");
    expect(weak).toHaveTextContent("Advance Variation");
  });

  it("suggested-next-drill links to a real drill route", () => {
    render(
      <ProgressView summary={summary} suggestion={suggestNextDrill(summary)} />,
    );
    const link = screen.getByTestId("suggested-drill");
    expect(link).toHaveAttribute("href", "/openings/caro-kann/drill");
  });
});

describe("HomeView (PRD §11.1)", () => {
  it("lists both repertoires and a progress summary", () => {
    render(
      <HomeView
        openings={[
          {
            slug: "london-system",
            name: "London System",
            side: "white",
            description: "Solid system for White.",
            difficulty: "beginner",
          },
          {
            slug: "caro-kann",
            name: "Caro-Kann Defense",
            side: "black",
            description: "Sound defense to 1.e4.",
            difficulty: "intermediate",
          },
        ]}
        overallConfidence={4.5}
        suggestion={suggestNextDrill(summary)}
      />,
    );
    const cards = screen.getByTestId("repertoires");
    expect(cards).toHaveTextContent("London System");
    expect(cards).toHaveTextContent("Caro-Kann Defense");
    expect(screen.getByTestId("home-confidence")).toHaveTextContent("4.5");
    expect(screen.getByTestId("continue-practice")).toHaveAttribute(
      "href",
      "/openings/caro-kann/drill",
    );
  });
});
