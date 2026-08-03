import { Role } from "../../core/types";
import { PIECE_DEFINITIONS } from "./pieces";
import { Palette, FACE_SHADING } from "./palette";

/**
 * Renders a piece's front elevation as a pixel sprite.
 *
 * The DOM needs piece icons for the move list, the captured tray and the
 * promotion picker. Drawing a second set of icons would mean maintaining two
 * versions of the same six shapes, and they would drift. Instead the sprite is
 * a straight orthographic read of the voxel grid the renderer meshes: for each
 * column, the frontmost filled voxel, shaded by whether it is a top face or a
 * front face. Change a piece and its icon changes with it.
 */

const WIDTH = 11;

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

/**
 * @param pixel Device pixels per voxel.
 * @returns A data URL, or null where there is no canvas (tests, SSR).
 */
export function pieceSpriteUrl(
  role: Role,
  palette: Palette,
  pixel = 3,
): string | null {
  const key = `${role}-${palette.base}-${palette.detail}-${pixel}`;
  const cached = cache.get(key);
  if (cached) return cached;

  if (typeof document === "undefined") return null;

  const def = PIECE_DEFINITIONS[role];
  const height = def.grid.length;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * pixel;
  canvas.height = height * pixel;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const filled = (y: number, z: number, x: number): boolean => {
    const layer = def.grid[y];
    if (!layer) return false;
    const row = layer[z];
    if (!row) return false;
    return row[x] !== undefined && row[x] !== ".";
  };

  for (let y = 0; y < height; y++) {
    const layer = def.grid[y]!;
    for (let x = 0; x < WIDTH; x++) {
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
      ctx.fillStyle = shade(base, lit ? FACE_SHADING.top : FACE_SHADING.sideZ);
      ctx.fillRect(x * pixel, (height - 1 - y) * pixel, pixel, pixel);
    }
  }

  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/** Drops cached sprites so a theme change re-renders them. */
export function clearSpriteCache(): void {
  cache.clear();
}
