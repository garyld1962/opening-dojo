import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LessonClient } from "@/components/LessonClient";
import { getOpeningBySlug } from "@/lib/opening-content";
import { primaryLine } from "@/components/lesson-steps";
import { buildLessonSteps } from "@/components/lesson-steps";

const london = getOpeningBySlug("london-system")!;
const line = primaryLine(london.lines);
const steps = buildLessonSteps(line);

function renderLesson() {
  return render(
    <LessonClient
      slug="london-system"
      openingName={london.name}
      side={london.side}
      line={line}
    />,
  );
}

describe("Lesson page (London basic setup)", () => {
  it("renders an explanation for every move in the line (N2)", () => {
    // Every curated ply must carry a non-empty explanation.
    for (const step of steps) {
      expect(step.explanation.length).toBeGreaterThan(0);
    }
    renderLesson();
    // The first move's explanation is shown initially.
    expect(screen.getByTestId("explanation")).toHaveTextContent(
      steps[0].explanation,
    );
    // The move list shows every ply.
    const list = screen.getByTestId("move-list");
    for (const step of steps) {
      expect(within(list).getByTestId(`move-${step.ply}`)).toHaveTextContent(
        step.san,
      );
    }
  });

  it("steps forward and backward through the moves", () => {
    renderLesson();
    const counter = screen.getByTestId("step-counter");
    expect(counter).toHaveTextContent(`Move 1 of ${steps.length}`);

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(counter).toHaveTextContent(`Move 2 of ${steps.length}`);
    expect(screen.getByTestId("explanation")).toHaveTextContent(
      steps[1].explanation,
    );

    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(counter).toHaveTextContent(`Move 1 of ${steps.length}`);
    expect(screen.getByTestId("explanation")).toHaveTextContent(
      steps[0].explanation,
    );
  });

  it("disables Previous on the first move and Next on the last", () => {
    renderLesson();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).not.toBeDisabled();
  });

  it("jumps to a move when its move-list entry is clicked", () => {
    renderLesson();
    fireEvent.click(screen.getByTestId("move-3"));
    expect(screen.getByTestId("explanation")).toHaveTextContent(
      steps[3].explanation,
    );
  });
});
