import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("scaffold sanity", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });

  it("cn merges class names", () => {
    expect(cn("a", "b", false && "c")).toBe("a b");
  });
});
