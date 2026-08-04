import { describe, it, expect } from "vitest";
import { DIFFICULTY_LEVELS, getDifficulty } from "../../src/core/difficulty";
import {
  THEMES,
  applyThemeToCss,
  shadeHex,
  tintHex,
  inkPalette,
  LCD_SHADING,
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
   * The housing has now been inverted twice — dark, then pale, then dark again
   * — and each flip turned every contrast ratio in the app upside down at once.
   * These assertions are the reason that is a safe thing to keep doing. They
   * assert ratios rather than polarity, so they survive a flip intact and fail
   * loudly on whatever it broke, which is exactly what happened both times.
   */
  /*
   * The keycap legends are drawn, not typed, so nothing about them is caught by
   * the ink assertions below — they go through the sprite renderer.
   *
   * They are rendered with `litTint`, which lights a top face by tinting *up*
   * rather than shading the other faces down. That is what makes the ink's own
   * value the worst case: the unlit face is the ink at full strength, and the
   * lit face can only be lighter than it against a dark deck. Shading down
   * instead — which is what pieces do, and what these did while the housing was
   * pale — put the dimmer materials at 2.1:1 against their own key.
   */
  it("keeps every keycap icon readable on its own key", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      const ink = inkPalette(theme.cssTokens);
      // The keycap and the deck are one shot of plastic: the +Y face at 1.00.
      const keycap = theme.cssTokens.surfaceRaised;

      for (const material of ["base", "accent", "shade", "detail"] as const) {
        expect(
          contrast(ink[material], keycap),
          `${id}: icon ${material} on the keycap`,
        ).toBeGreaterThanOrEqual(3);

        // And the lit face genuinely goes up, or the argument above is void.
        expect(
          contrast(tintHex(ink[material], theme.white.base, 0.35), keycap),
          `${id}: icon ${material}, lit face, on the keycap`,
        ).toBeGreaterThanOrEqual(3);
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

      /*
       * The lit edge is what separates a control from the deck. Both are the
       * same shot of plastic, so no value difference does that job — and on a
       * dark machine the moulded gap that used to do it cannot: `seam` is
       * `material x 0.30`, which fell to near-black on cream and gave 6.68:1,
       * but lands 1.28:1 from a dark deck. There is no headroom below, so the
       * boundary is carried by going up. UI boundary, so 3:1.
       *
       * This is the load-bearing assertion of the entire dark palette. If it
       * fails, every button on the machine has stopped being identifiable as a
       * button.
       */
      expect(
        contrast(t.bevel, face),
        `${id}: --voxel-top, the lit edge, against the deck`,
      ).toBeGreaterThanOrEqual(3);

      // And it has to be lighter than the deck, not merely different from it —
      // a bevel that reads as a shadow is not a bevel.
      expect(
        luminance(t.bevel) > luminance(face),
        `${id}: the lit edge is lighter than the deck`,
      ).toBe(true);

      /*
       * The hovered key is a lighter surface than the deck, and on a dark
       * machine a lighter surface *costs* an ink its headroom rather than
       * giving it more. Only `--text` is ever set on it — a hovered control
       * brightens its own label — so that is the pairing asserted. Putting a
       * dimmer ink on this surface is what measured 3.5:1 and moved the
       * active-row cue off a panel and onto an edge.
       */
      const hovered = tintHex(face, t.bevel, 0.28);
      expect(
        contrast(t.text, hovered),
        `${id}: --text on a hovered control`,
      ).toBeGreaterThanOrEqual(4.5);

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
