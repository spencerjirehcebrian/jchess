import { describe, it, expect } from "vitest";
import { DIFFICULTY_LEVELS, getDifficulty } from "../../src/core/difficulty";
import {
  THEMES,
  applyThemeToCss,
  shadeHex,
  inkPalette,
  FACE_SHADING,
  LCD_SHADING,
  SEAM_SHADING,
} from "../../src/render/voxel/palette";

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const channels = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return (
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

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

  /*
   * The housing is pale and every ink on it is dark, which inverted every
   * contrast ratio in the app at once. These assertions are the reason that
   * flip is safe to keep making: a theme cannot be added, or an ink nudged for
   * looks, without proving it is still readable.
   */
  /*
   * The keycap legends are drawn, not typed, so nothing about them is caught by
   * the ink assertions below: they go through the sprite renderer, which
   * multiplies each material by the mesher's face shading before painting it.
   * A material that clears 4.5:1 as text can only get darker from there — but
   * "can only get darker" is an argument, and this is the assertion.
   */
  it("keeps every keycap icon readable on its own key", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      const ink = inkPalette(theme.cssTokens);
      // The keycap and the deck are one shot of plastic: the +Y face at 1.00.
      const keycap = theme.cssTokens.surfaceRaised;

      for (const material of ["base", "accent", "shade", "detail"] as const) {
        // Both faces the renderer can give a voxel: a lit top and a front.
        for (const face of [FACE_SHADING.top, FACE_SHADING.sideZ]) {
          expect(
            contrast(shadeHex(ink[material], face), keycap),
            `${id}: icon ${material} at face ${face} on the keycap`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("keeps every housing ink legible on its own housing", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      const t = theme.cssTokens;
      // The deck is the material seen face-on — the mesher's +Y face at 1.00.
      const face = t.surfaceRaised;

      for (const ink of ["text", "textDim", "textFaint", "accent"] as const) {
        expect(
          contrast(t[ink], face),
          `${id}: --${ink} on the housing`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      for (const ink of ["warning", "error", "success"] as const) {
        expect(
          contrast(t[ink], face),
          `${id}: --${ink} on the housing`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      // The seam is the moulded gap a keycap sits in, and it is what separates
      // a control from the deck — both are the same shot of plastic, so there
      // is no value difference doing that job. UI boundary, so 3:1.
      expect(
        contrast(shadeHex(face, SEAM_SHADING), face),
        `${id}: --voxel-seam against the deck`,
      ).toBeGreaterThanOrEqual(3);

      // A decorative rule, not a boundary, so it only owes 3:1.
      expect(
        contrast(t.accentDim, face),
        `${id}: --accent-dim rule`,
      ).toBeGreaterThanOrEqual(3);

      // The focus ring has to be visible or keyboard use is broken, and it must
      // differ from the resting accent or it reads as no state change at all.
      expect(
        contrast(t.accentBright, face),
        `${id}: focus ring on the housing`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(t.accentBright, `${id}: focus ring differs from accent`).not.toBe(
        t.accent,
      );
    }
  });

  it("keeps the display legible against its own unlit cells", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      const t = theme.cssTokens;
      // Worst case is the off-cell, the lightest thing ever directly under a
      // lit glyph — not the gutter between cells.
      const off = shadeHex(t.lcdOn, LCD_SHADING.off);

      expect(contrast(t.lcdOn, off), `${id}: lit text`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(shadeHex(t.lcdOn, LCD_SHADING.dim), off),
        `${id}: secondary text`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(t.lcdAlert, off),
        `${id}: alert segment`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  /*
   * The board is read against the dark room, the housing against pale plastic.
   * These used to be one field, and the flip is exactly the change that would
   * silently drag the board's highlights down into invisibility with the ink.
   */
  it("keeps the board signals bright enough for the dark room", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      const t = theme.cssTokens;
      for (const signal of [
        "boardAccent",
        "boardAccentBright",
        "premove",
      ] as const) {
        expect(
          contrast(t[signal], theme.background),
          `${id}: --${signal} against the room`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
