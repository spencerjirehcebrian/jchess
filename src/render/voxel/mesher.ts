import * as THREE from "three";
import { PieceDefinition } from "./pieces";
import { Palette, Theme } from "./palette";
import { Color } from "../../core/types";

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

export function meshPiece(
  def: PieceDefinition,
  palette: Palette,
  colorSide: Color = "white",
): MeshedPiece {
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
        // If knight and black, flip facing (X axis symmetry or flip Z)
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

  // Rotate black knight 180 degrees so it faces opponent
  if (def.role === "knight" && colorSide === "black") {
    geometry.rotateY(Math.PI);
  }

  return {
    geometry,
    triangleCount: indices.length / 3,
    boundingHeight: height * VOXEL_SIZE,
  };
}

export function meshBoard(theme: Theme): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertexCount = 0;

  const lightColor = hexToRgb(theme.lightSquare);
  const darkColor = hexToRgb(theme.darkSquare);
  const frameColor = hexToRgb(theme.frame);

  const squareVoxels = 13;
  const boardSize = 8 * squareVoxels; // 104 voxels
  const frameWidth = 4;
  const totalVoxels = boardSize + frameWidth * 2; // 112 voxels

  const offset = -totalVoxels / 2;

  // Build top board surface (2 voxels deep) & surrounding frame (4 voxels deep)
  for (let x = 0; x < totalVoxels; x++) {
    for (let z = 0; z < totalVoxels; z++) {
      const isFrame =
        x < frameWidth ||
        x >= totalVoxels - frameWidth ||
        z < frameWidth ||
        z >= totalVoxels - frameWidth;

      const depth = isFrame ? 4 : 2;
      const sqX = Math.floor((x - frameWidth) / squareVoxels);
      const sqZ = Math.floor((z - frameWidth) / squareVoxels);
      const isLight = (sqX + sqZ) % 2 === 0;
      const baseColor = isFrame ? frameColor : isLight ? lightColor : darkColor;

      for (let y = -depth; y < 0; y++) {
        // Emit top face only if y === -1
        if (y === -1) {
          const shadedColor = baseColor
            .clone()
            .multiplyScalar(FACE_SHADING.top);
          const quad = [
            [0, 0, 1],
            [1, 0, 1],
            [1, 0, 0],
            [0, 0, 0],
          ];
          for (const v of quad) {
            const vx = (x + v[0]! + offset) * VOXEL_SIZE;
            const vy = 0;
            const vz = (z + v[2]! + offset) * VOXEL_SIZE;
            positions.push(vx, vy, vz);
            normals.push(0, 1, 0);
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
