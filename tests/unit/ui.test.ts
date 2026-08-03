import { describe, it, expect } from "vitest";
import { DIFFICULTY_LEVELS, getDifficulty } from "../../src/core/difficulty";

describe("UI component unit tests", () => {
  it("defines all 8 difficulty rungs", () => {
    expect(Object.keys(DIFFICULTY_LEVELS).length).toBe(8);
    const lvl4 = getDifficulty(4);
    expect(lvl4.label).toBe("Strong club");
    expect(lvl4.approxElo).toBe(1700);
  });

  it("identifies levels requiring multi-threading", () => {
    expect(DIFFICULTY_LEVELS[7]!.requiresThreads).toBe(true);
    expect(DIFFICULTY_LEVELS[8]!.requiresThreads).toBe(true);
    expect(DIFFICULTY_LEVELS[6]!.requiresThreads).toBe(false);
  });
});
