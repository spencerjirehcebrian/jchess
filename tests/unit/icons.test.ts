import { describe, it, expect } from "vitest";
import { ICONS, IconName } from "../../src/render/voxel/icons";
import { voxelSpriteUrl } from "../../src/render/voxel/sprite";
import { PIECE_DEFINITIONS } from "../../src/render/voxel/pieces";
import { THEMES, inkPalette } from "../../src/render/voxel/palette";

const NAMES = Object.keys(ICONS) as IconName[];

describe("keycap icons", () => {
  it("draws every control the keypad has", () => {
    expect(NAMES.sort()).toEqual([
      "flip",
      "hint",
      "newgame",
      "resign",
      "settings",
      "start",
      "takeback",
    ]);
  });

  /*
   * Eight by eight, and rectangular. A ragged grid still renders — the sprite
   * takes its width from the widest row — but it renders a shape nobody drew,
   * silently off-centre, which is the kind of thing that survives review and
   * gets noticed months later.
   */
  it.each(NAMES)("keeps %s on an 8x8 grid", (name) => {
    const grid = ICONS[name];
    expect(grid).toHaveLength(8);

    for (const layer of grid) {
      // Flat: one voxel deep, because a legend printed on a key has no depth.
      expect(layer).toHaveLength(1);
      expect(layer[0]).toHaveLength(8);
    }
  });

  it.each(NAMES)("uses only known materials in %s", (name) => {
    for (const layer of ICONS[name]) {
      expect(layer[0]).toMatch(/^[.#+\-o]+$/);
    }
  });

  it.each(NAMES)("actually puts something in %s", (name) => {
    const filled = ICONS[name]
      .flat()
      .join("")
      .split("")
      .filter((c) => c !== ".").length;
    expect(filled).toBeGreaterThan(4);
  });
});

describe("the generalised sprite renderer", () => {
  const palette = inkPalette(THEMES.lacquer!.cssTokens);

  /*
   * There is no canvas under happy-dom, so the renderer returns null rather
   * than throwing — which is the contract the DOM callers already rely on to
   * fall back to a text glyph. The shape-level assertions above are what cover
   * the icons themselves; this covers the guard.
   */
  it("returns null where there is nothing to draw on", () => {
    expect(voxelSpriteUrl("icon-flip", ICONS.flip, palette)).toBeNull();
  });

  it("refuses an empty grid instead of producing a zero-sized canvas", () => {
    expect(voxelSpriteUrl("empty", [], palette)).toBeNull();
    expect(voxelSpriteUrl("blank", [[""]], palette)).toBeNull();
  });

  /*
   * The renderer used to hardcode a width of 11 — the pieces' width — so an
   * 8-wide icon would have been drawn into an 11-wide canvas and sat three
   * columns off centre. Width has to come from the grid.
   */
  it("takes its width from the grid rather than from the pieces", () => {
    const widthOf = (grid: { length: number }[]) =>
      Math.max(...grid.map((layer: any) => Math.max(...layer.map((r: string) => r.length))));

    expect(widthOf(ICONS.flip as any)).toBe(8);
    expect(widthOf(PIECE_DEFINITIONS.king.grid as any)).toBe(11);
  });
});
