import { VoxelGrid } from "./pieces";

/*
 * Keycap legends, authored the way the pieces are.
 *
 * A control icon is the same kind of object as a piece: a grid of voxels read
 * as a front elevation, lit from above by the same renderer. Drawing them any
 * other way — an SVG set, a font — would put a second visual language on the
 * one surface where the machine's own language should be loudest.
 *
 * They are flat: one voxel deep, so each layer holds a single row. That is
 * what a legend printed on a key is. The extrusion comes from the renderer
 * lighting a voxel's top face differently from its front, which gives every
 * shape a lighter edge along its top without anyone drawing one.
 *
 * Materials, as everywhere else: '#' base, '+' accent, '-' shade, 'o' detail.
 *
 * Eight by eight. It is the size at which a pixel icon has been legible since
 * icons existed, and at pixel 2 it comes to 16px — which sits inside a 40px key
 * with even margins, so nothing lands on a half.
 */

/**
 * Rows top-down, the way they are read.
 *
 * The renderer stacks a grid from the bottom, so this reverses once here rather
 * than asking every icon to be authored upside down — which is the kind of
 * thing that is fine until the day somebody edits one.
 */
function icon(rows: string[]): VoxelGrid {
  return rows
    .slice()
    .reverse()
    .map((row) => [row]);
}

export type IconName =
  | "takeback"
  | "flip"
  | "hint"
  | "resign"
  | "newgame"
  | "settings"
  | "start";

export const ICONS: Record<IconName, VoxelGrid> = {
  /* Back the way you came. A plain arrow rather than the curling undo hook,
     which at this size collapses into an unreadable knot of pixels. */
  takeback: icon([
    "...#....",
    "..##....",
    ".###....",
    "########",
    "########",
    ".###....",
    "..##....",
    "...#....",
  ]),

  /* Two triangles turning past each other: the board swapping ends. */
  flip: icon([
    "...##...",
    "..####..",
    ".######.",
    "........",
    "........",
    ".######.",
    "..####..",
    "...##...",
  ]),

  /* A bulb. The shade marks the screw base, so the glass reads as glass. */
  hint: icon([
    "..####..",
    ".######.",
    ".######.",
    ".######.",
    "..####..",
    "...--...",
    "..----..",
    "...--...",
  ]),

  /*
   * A flag.
   *
   * The toppled king was the better story and the worse icon. A king is only a
   * king because of the cross on its crown, and a cross needs three voxels
   * across — which on an eight-wide grid leaves five for the body, and the
   * whole thing renders as a horizontal smudge. Rendered and looked at, not
   * reasoned about.
   *
   * The flag is what every chess interface a player has already used puts on
   * this control, and it survives being small. The word RESIGN is beside it
   * either way; an icon nobody can read is decoration.
   */
  resign: icon([
    ".######.",
    ".######.",
    ".####...",
    ".##.....",
    ".#......",
    ".#......",
    ".#......",
    ".#......",
  ]),

  /* A board, which is what a new game is. */
  newgame: icon([
    "##..##..",
    "##..##..",
    "..##..##",
    "..##..##",
    "##..##..",
    "##..##..",
    "..##..##",
    "..##..##",
  ]),

  /* Play. The one triangle every machine with a start button already wears. */
  start: icon([
    ".#......",
    ".###....",
    ".#####..",
    ".#######",
    ".#######",
    ".#####..",
    ".###....",
    ".#......",
  ]),

  /* Two sliders. A gear loses its teeth at eight pixels and becomes a blob. */
  settings: icon([
    "........",
    "..#.....",
    "########",
    "..#.....",
    ".....#..",
    "########",
    ".....#..",
    "........",
  ]),
};
