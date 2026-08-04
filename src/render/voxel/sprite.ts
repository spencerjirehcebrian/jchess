import { Role } from "../../core/types";
import { PIECE_DEFINITIONS, VoxelGrid } from "./pieces";
import { Palette, FACE_SHADING, tintHex } from "./palette";

/**
 * Renders a voxel grid's front elevation as a pixel sprite.
 *
 * The DOM needs piece icons for the move list, the captured tray and the
 * promotion picker, and control icons for the keyplate. Drawing a second set
 * would mean maintaining two versions of the same shapes, and they would drift.
 * Instead the sprite is a straight orthographic read of the grid the renderer
 * meshes: for each column, the frontmost filled voxel, shaded by whether it is
 * a top face or a front face. Change a shape and its icon changes with it.
 *
 * Keycap icons are authored in the same format for the same reason — one grid
 * language, one renderer, one place where the light comes from.
 */

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const g = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `rgb(${r},${g},${b})`;
}

function materialColor(char: string, palette: Palette): string | null {
  switch (char) {
    case "#":
      return palette.base;
    case "+":
      return palette.accent;
    case "-":
      return palette.shade;
    case "o":
      return palette.detail;
    default:
      return null;
  }
}

const cache = new Map<string, string>();

/** Perceived lightness, enough to decide which way an outline should go. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

/** The widest row anywhere in the grid — the sprite's own width in voxels. */
function gridWidth(grid: VoxelGrid): number {
  let width = 0;
  for (const layer of grid) {
    for (const row of layer) {
      if (row.length > width) width = row.length;
    }
  }
  return width;
}

export interface SpriteOptions {
  /** Device pixels per voxel. */
  pixel?: number;
  /**
   * Light a voxel's top face by tinting *up* toward this colour, instead of
   * shading its other faces down.
   *
   * Pieces leave this unset: they are objects in a lit scene, and the mesher's
   * shading is what makes them agree with the board they stand on.
   *
   * Keycap legends need it. Shading down was free contrast while the housing
   * was pale — a darker ink on cream — and costs it now the deck is dark, which
   * dropped the dimmer materials to 2.1:1 against their own key. It is the same
   * inversion the housing itself went through: on a dark machine, depth reads
   * upward. The unlit face is then the ink at full strength, so the ink's own
   * contrast floor is the worst case rather than a fraction of it.
   */
  litTint?: string;
  /**
   * A one-voxel contrasting outline, and the margin it needs.
   *
   * Pieces need it: the same sprite has to read on a pale keycap, in a dark
   * tray and over the board, and no single background works for both sets — so
   * the fix belongs to the sprite rather than to whatever is behind it.
   *
   * Keycap icons must not have it. They only ever sit on one surface, and a
   * light halo around a dark icon on cream plastic reads as a glow.
   */
  halo?: boolean;
}

/**
 * @param id Identifies the grid for caching; must be unique per shape.
 * @returns A data URL, or null where there is no canvas (tests, SSR).
 */
export function voxelSpriteUrl(
  id: string,
  grid: VoxelGrid,
  palette: Palette,
  opts: SpriteOptions = {},
): string | null {
  const pixel = opts.pixel ?? 3;
  const halo = opts.halo ?? true;

  const key = `${id}-${palette.base}-${palette.detail}-${pixel}-${halo}-${opts.litTint ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  if (typeof document === "undefined") return null;

  const height = grid.length;
  const width = gridWidth(grid);
  if (width === 0 || height === 0) return null;

  // The outline needs a voxel of margin all round to occupy; without one it
  // would be clipped away at the edges of the shape it is meant to surround.
  const margin = halo ? 1 : 0;

  const canvas = document.createElement("canvas");
  canvas.width = (width + margin * 2) * pixel;
  canvas.height = (height + margin * 2) * pixel;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const filled = (y: number, z: number, x: number): boolean => {
    const layer = grid[y];
    if (!layer) return false;
    const row = layer[z];
    if (!row) return false;
    return row[x] !== undefined && row[x] !== ".";
  };

  // Collect the elevation first, so the outline can be painted underneath it.
  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < height; y++) {
    const layer = grid[y]!;
    for (let x = 0; x < width; x++) {
      // The camera faces -Z, so the first filled voxel along Z is the one seen.
      let char: string | null = null;
      let z = 0;
      for (; z < layer.length; z++) {
        const c = layer[z]![x];
        if (c && c !== ".") {
          char = c;
          break;
        }
      }
      if (!char) continue;

      const base = materialColor(char, palette);
      if (!base) continue;

      // A voxel with nothing above it shows its top face; otherwise its front.
      const lit = !filled(y + 1, z, x);
      const color = opts.litTint
        ? lit
          ? tintHex(base, opts.litTint, 0.35)
          : base
        : shade(base, lit ? FACE_SHADING.top : FACE_SHADING.sideZ);

      cells.push({
        x: x + margin,
        // Grids are authored bottom-up, the way the renderer stacks them.
        y: height - 1 - y + margin,
        color,
      });
    }
  }

  if (halo) {
    ctx.fillStyle = isLight(palette.base) ? "#000000" : "#FFFFFF";
    for (const { x, y } of cells) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        ctx.fillRect((x + dx) * pixel, (y + dy) * pixel, pixel, pixel);
      }
    }
  }

  for (const { x, y, color } of cells) {
    ctx.fillStyle = color;
    ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
  }

  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/**
 * @param pixel Device pixels per voxel.
 * @returns A data URL, or null where there is no canvas (tests, SSR).
 */
export function pieceSpriteUrl(
  role: Role,
  palette: Palette,
  pixel = 3,
): string | null {
  return voxelSpriteUrl(`piece-${role}`, PIECE_DEFINITIONS[role].grid, palette, {
    pixel,
    halo: true,
  });
}

/** Drops cached sprites so a theme change re-renders them. */
export function clearSpriteCache(): void {
  cache.clear();
}
