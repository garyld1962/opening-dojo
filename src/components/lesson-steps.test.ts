import { describe, expect, it } from "vitest";
import { openings } from "@/lib/opening-content";
import { lineByPriority } from "./lesson-steps";

const caro = openings.find((o) => o.slug === "caro-kann")!;

describe("lineByPriority", () => {
  it("picks the requested line so every line has a lesson and a drill", () => {
    for (const line of caro.lines) {
      expect(lineByPriority(caro.lines, String(line.priority)).name).toBe(line.name);
    }
  });

  it("falls back to the primary line for missing or unknown values", () => {
    expect(lineByPriority(caro.lines, undefined).priority).toBe(1);
    expect(lineByPriority(caro.lines, "999").priority).toBe(1);
    expect(lineByPriority(caro.lines, "abc").priority).toBe(1);
  });
});
