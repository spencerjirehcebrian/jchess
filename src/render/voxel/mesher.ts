import * as THREE from "three";
import { PieceDefinition } from "./pieces";
import { Palette, Theme } from "./palette";

export const VOXEL_SIZE = 1 / 13; // 1/13 of a world unit square

export interface MeshedPiece {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  boundingHeight: number;
}

// Directional multipliers for baked face shading
const FACE_SHADING = {
  top: 1.0,
  bottom: 0.55,
  sideX: 0.82,
  sideZ: 0.72,
};

// 6 Face directions: +X, -X, +Y, -Y, +Z, -Z
const DIRECTIONS = [
  {
    dir: [1, 0, 0],
    shading: FACE_SHADING.sideX,
    quad: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    dir: [-1, 0, 0],
    shading: FACE_SHADING.sideX,
    quad: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    dir: [0, 1, 0],
    shading: FACE_SHADING.top,
    quad: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    dir: [0, -1, 0],
    shading: FACE_SHADING.bottom,
    quad: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    dir: [0, 0, 1],
    shading: FACE_SHADING.sideZ,
    quad: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    dir: [-0, 0, -1],
    shading: FACE_SHADING.sideZ,
    quad: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];

function hexToRgb(hexStr: string): THREE.Color {
  return new THREE.Color(hexStr);
}

function getMaterialColor(char: string, palette: Palette): THREE.Color | null {
  switch (char) {
    case "#":
      return hexToRgb(palette.base);
    case "+":
      return hexToRgb(palette.accent);
    case "-":
      return hexToRgb(palette.shade);
    case "o":
      return hexToRgb(palette.detail);
    default:
      return null;
  }
}

export function meshPiece(def: PieceDefinition, palette: Palette): MeshedPiece {
  const grid = def.grid;
  const height = grid.length;
  const width = 11;
  const depth = 11;

  // Center footprint at X=0, Z=0 (offset by width/2, depth/2)
  const offsetX = -width / 2;
  const offsetZ = -depth / 2;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertexCount = 0;

  const isFilled = (y: number, z: number, x: number): boolean => {
    if (y < 0 || y >= height) return false;
    const layer = grid[y];
    if (!layer || z < 0 || z >= layer.length) return false;
    const row = layer[z];
    if (!row || x < 0 || x >= row.length) return false;
    return row[x] !== ".";
  };

  for (let y = 0; y < height; y++) {
    const layer = grid[y]!;
    for (let z = 0; z < depth; z++) {
      const row = layer[z]!;
      for (let x = 0; x < width; x++) {
        const char = row[x]!;
        if (char === ".") continue;

        const baseColor = getMaterialColor(char, palette);
        if (!baseColor) continue;

        // Check each of the 6 faces
        for (const face of DIRECTIONS) {
          const [dx, dy, dz] = face.dir;
          const nx = dx!;
          const ny = dy!;
          const nz = dz!;

          if (!isFilled(y + ny, z + nz, x + nx)) {
            const shadedColor = baseColor.clone().multiplyScalar(face.shading);

            // Emit quad
            for (const vertexOffset of face.quad) {
              const vx = (x + vertexOffset[0]! + offsetX) * VOXEL_SIZE;
              const vy = (y + vertexOffset[1]!) * VOXEL_SIZE;
              const vz = (z + vertexOffset[2]! + offsetZ) * VOXEL_SIZE;

              positions.push(vx, vy, vz);
              normals.push(nx, ny, nz);
              colors.push(shadedColor.r, shadedColor.g, shadedColor.b);
            }

            indices.push(
              vertexCount,
              vertexCount + 1,
              vertexCount + 2,
              vertexCount,
              vertexCount + 2,
              vertexCount + 3,
            );
            vertexCount += 4;
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return {
    geometry,
    triangleCount: indices.length / 3,
    boundingHeight: height * VOXEL_SIZE,
  };
}

export const SQUARE_VOXELS = 13;
export const BOARD_FRAME_WIDTH = 8;
/** 104 playing voxels plus the frame on each side. */
export const BOARD_TOTAL_VOXELS = 8 * SQUARE_VOXELS + BOARD_FRAME_WIDTH * 2;

/** Voxels of material below the playing surface. The tray reads as solid. */
const BOARD_DEPTH = 6;
/** The frame stands one voxel proud of the squares, so the board is a tray. */
const FRAME_LIP = 1;

/**
 * 3x5 glyphs, top row first. The frame is 8 voxels wide: one inlay line, a
 * voxel of breathing room, the 5-voxel glyph, then a voxel before the outer
 * edge. Anything larger crowds the inlay; anything smaller stops reading at
 * the board's default zoom.
 */
const COORD_GLYPHS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "##.", "#.#", ".#."],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": [".#.", "#.#", ".#.", "#.#", ".#."],
};

const FILE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const RANK_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/**
 * Marks the voxel columns occupied by an engraved coordinate glyph.
 *
 * Files run along the +Z frame edge (nearest the camera, rank 1) and ranks
 * along the -X edge (file a), which is how a player sitting at the white side
 * reads them. The mesh is rotated 180 degrees when the board flips, so the
 * labels stay correct for both orientations without a rebuild.
 */
function buildCoordinateMask(): Set<number> {
  const mask = new Set<number>();
  const total = BOARD_TOTAL_VOXELS;
  const fw = BOARD_FRAME_WIDTH;

  const stamp = (glyph: string[], originX: number, originZ: number) => {
    for (let row = 0; row < glyph.length; row++) {
      const line = glyph[row]!;
      for (let col = 0; col < line.length; col++) {
        if (line[col] === ".") continue;
        mask.add((originX + col) * total + (originZ + row));
      }
    }
  };

  for (let file = 0; file < 8; file++) {
    // Centre the 3-wide glyph in the 13-voxel square, and the 5-tall glyph in
    // the frame band.
    const originX =
      fw + file * SQUARE_VOXELS + Math.floor((SQUARE_VOXELS - 3) / 2);
    const originZ = total - fw + 2;
    stamp(COORD_GLYPHS[FILE_LABELS[file]!]!, originX, originZ);
  }

  for (let rank = 0; rank < 8; rank++) {
    // Rank 1 sits at high Z, matching squareToWorld.
    const originX = 2;
    const originZ =
      fw + (7 - rank) * SQUARE_VOXELS + Math.floor((SQUARE_VOXELS - 5) / 2);
    stamp(COORD_GLYPHS[RANK_LABELS[rank]!]!, originX, originZ);
  }

  return mask;
}

/**
 * The board is one voxel volume, meshed with the same face shading as the
 * pieces so it reads as the same material. Columns are emitted as a top face
 * plus whatever wall is exposed against each neighbour, which gives the
 * perimeter its full depth and the frame lip its one-voxel step for free.
 */
export function meshBoard(theme: Theme): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertexCount = 0;

  const lightColor = hexToRgb(theme.lightSquare);
  const darkColor = hexToRgb(theme.darkSquare);
  const frameColor = hexToRgb(theme.frame);
  const inlayColor = hexToRgb(theme.frameInlay ?? theme.frame);

  const total = BOARD_TOTAL_VOXELS;
  const fw = BOARD_FRAME_WIDTH;
  const offset = -total / 2;

  const coordMask = buildCoordinateMask();

  const isFrame = (x: number, z: number) =>
    x < fw || x >= total - fw || z < fw || z >= total - fw;

  // The innermost frame ring is the inlay line separating frame from squares.
  const isInlay = (x: number, z: number) =>
    isFrame(x, z) &&
    x >= fw - 1 &&
    x <= total - fw &&
    z >= fw - 1 &&
    z <= total - fw;

  const isEngraved = (x: number, z: number) =>
    isFrame(x, z) && coordMask.has(x * total + z);

  /** Top of the column, in voxels, with the playing surface at 0. */
  const topAt = (x: number, z: number): number => {
    if (x < 0 || x >= total || z < 0 || z >= total) return -BOARD_DEPTH;
    if (!isFrame(x, z)) return 0;
    // Engraved glyphs are recessed to the height of the playing surface.
    return isEngraved(x, z) ? 0 : FRAME_LIP;
  };

  const colorAt = (x: number, z: number): THREE.Color => {
    if (isEngraved(x, z)) return inlayColor;
    if (isInlay(x, z)) return inlayColor;
    if (isFrame(x, z)) return frameColor;
    const sqX = Math.floor((x - fw) / SQUARE_VOXELS);
    const sqZ = Math.floor((z - fw) / SQUARE_VOXELS);
    return (sqX + sqZ) % 2 === 0 ? lightColor : darkColor;
  };

  const pushQuad = (
    corners: number[][],
    normal: number[],
    color: THREE.Color,
  ) => {
    for (const c of corners) {
      positions.push(
        (c[0]! + offset) * VOXEL_SIZE,
        c[1]! * VOXEL_SIZE,
        (c[2]! + offset) * VOXEL_SIZE,
      );
      normals.push(normal[0]!, normal[1]!, normal[2]!);
      colors.push(color.r, color.g, color.b);
    }
    indices.push(
      vertexCount,
      vertexCount + 1,
      vertexCount + 2,
      vertexCount,
      vertexCount + 2,
      vertexCount + 3,
    );
    vertexCount += 4;
  };

  const WALLS = [
    { dx: 1, dz: 0, shading: FACE_SHADING.sideX, normal: [1, 0, 0] },
    { dx: -1, dz: 0, shading: FACE_SHADING.sideX, normal: [-1, 0, 0] },
    { dx: 0, dz: 1, shading: FACE_SHADING.sideZ, normal: [0, 0, 1] },
    { dx: 0, dz: -1, shading: FACE_SHADING.sideZ, normal: [0, 0, -1] },
  ];

  for (let x = 0; x < total; x++) {
    for (let z = 0; z < total; z++) {
      const top = topAt(x, z);
      const base = colorAt(x, z);

      pushQuad(
        [
          [x, top, z + 1],
          [x + 1, top, z + 1],
          [x + 1, top, z],
          [x, top, z],
        ],
        [0, 1, 0],
        base.clone().multiplyScalar(FACE_SHADING.top),
      );

      for (const wall of WALLS) {
        const neighbourTop = topAt(x + wall.dx, z + wall.dz);
        if (neighbourTop >= top) continue;

        const lo = neighbourTop;
        const hi = top;
        const shaded = base.clone().multiplyScalar(wall.shading);

        if (wall.dx === 1) {
          pushQuad(
            [
              [x + 1, lo, z],
              [x + 1, hi, z],
              [x + 1, hi, z + 1],
              [x + 1, lo, z + 1],
            ],
            wall.normal,
            shaded,
          );
        } else if (wall.dx === -1) {
          pushQuad(
            [
              [x, lo, z + 1],
              [x, hi, z + 1],
              [x, hi, z],
              [x, lo, z],
            ],
            wall.normal,
            shaded,
          );
        } else if (wall.dz === 1) {
          pushQuad(
            [
              [x + 1, lo, z + 1],
              [x + 1, hi, z + 1],
              [x, hi, z + 1],
              [x, lo, z + 1],
            ],
            wall.normal,
            shaded,
          );
        } else {
          pushQuad(
            [
              [x, lo, z],
              [x, hi, z],
              [x + 1, hi, z],
              [x + 1, lo, z],
            ],
            wall.normal,
            shaded,
          );
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return geometry;
}
