import { describe, it, expect } from "vitest";
import { DIFFICULTY_LEVELS, getDifficulty } from "../../src/core/difficulty";
import { THEMES, applyThemeToCss } from "../../src/render/voxel/palette";

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

  it("defines cssTokens for all themes and applies them to root", () => {
    for (const themeKey of Object.keys(THEMES)) {
      const theme = THEMES[themeKey]!;
      expect(theme.cssTokens).toBeDefined();
      expect(theme.cssTokens.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.cssTokens.surface).toMatch(/^#[0-9A-Fa-f]{6}$/);

      applyThemeToCss(theme);
      expect(document.documentElement.style.getPropertyValue("--bg")).toBe(
        theme.cssTokens.bg,
      );
      expect(document.documentElement.style.getPropertyValue("--surface")).toBe(
        theme.cssTokens.surface,
      );
    }
  });
});
