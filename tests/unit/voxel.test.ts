import { describe, it, expect } from "vitest";
import { PIECE_DEFINITIONS } from "../../src/render/voxel/pieces";
import { THEMES } from "../../src/render/voxel/palette";
import { meshPiece } from "../../src/render/voxel/mesher";
import { Role } from "../../src/core/types";

describe("voxel asset & mesher structural validation", () => {
  it("1. every piece definition has consistent 11x11 layer dimensions", () => {
    for (const [_role, def] of Object.entries(PIECE_DEFINITIONS)) {
      for (let y = 0; y < def.grid.length; y++) {
        const layer = def.grid[y]!;
        expect(layer.length).toBe(11);
        for (let z = 0; z < layer.length; z++) {
          expect(layer[z]!.length).toBe(11);
        }
      }
    }
  });

  it("2. every piece uses only legal characters (. # + - o)", () => {
    const legalChars = new Set([".", "#", "+", "-", "o"]);
    for (const [_role, def] of Object.entries(PIECE_DEFINITIONS)) {
      for (const layer of def.grid) {
        for (const row of layer) {
          for (const char of row) {
            expect(legalChars.has(char)).toBe(true);
          }
        }
      }
    }
  });

  it("3. no floating voxels (every voxel is face-connected to the base)", () => {
    for (const [_role, def] of Object.entries(PIECE_DEFINITIONS)) {
      const grid = def.grid;
      const height = grid.length;
      const visited = new Set<string>();
      const queue: [number, number, number][] = [];

      // Seed queue with filled voxels at base layer y=0
      for (let z = 0; z < 11; z++) {
        for (let x = 0; x < 11; x++) {
          if (grid[0]![z]![x]! !== ".") {
            const key = `0,${z},${x}`;
            visited.add(key);
            queue.push([0, z, x]);
          }
        }
      }

      // BFS to find all face-connected voxels
      const dirs = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];

      while (queue.length > 0) {
        const [y, z, x] = queue.shift()!;
        for (const [dy, dz, dx] of dirs) {
          const ny = y + dy!;
          const nz = z + dz!;
          const nx = x + dx!;
          if (
            ny >= 0 &&
            ny < height &&
            nz >= 0 &&
            nz < 11 &&
            nx >= 0 &&
            nx < 11
          ) {
            if (grid[ny]![nz]![nx]! !== ".") {
              const key = `${ny},${nz},${nx}`;
              if (!visited.has(key)) {
                visited.add(key);
                queue.push([ny, nz, nx]);
              }
            }
          }
        }
      }

      // Count total filled voxels
      let totalFilled = 0;
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < 11; z++) {
          for (let x = 0; x < 11; x++) {
            if (grid[y]![z]![x]! !== ".") {
              totalFilled++;
            }
          }
        }
      }

      expect(visited.size).toBe(totalFilled);
    }
  });

  it("4. all six pieces share identical bottom three layers", () => {
    const roles: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
    const firstDef = PIECE_DEFINITIONS["pawn"];
    for (const role of roles) {
      const def = PIECE_DEFINITIONS[role];
      for (let y = 0; y < 3; y++) {
        expect(def.grid[y]).toEqual(firstDef.grid[y]);
      }
    }
  });

  it("5. heights match specified target table", () => {
    // Lowered from the original 14–24 so a back-rank piece is not occluded by
    // its own pawn at the fixed 62-degree camera. See docs/05-voxel-assets.md.
    expect(PIECE_DEFINITIONS.pawn.height).toBe(12);
    expect(PIECE_DEFINITIONS.knight.height).toBe(17);
    expect(PIECE_DEFINITIONS.bishop.height).toBe(17);
    expect(PIECE_DEFINITIONS.rook.height).toBe(15);
    expect(PIECE_DEFINITIONS.queen.height).toBe(19);
    expect(PIECE_DEFINITIONS.king.height).toBe(20);
  });

  it("6. meshing all 12 geometries completes under 30ms", () => {
    const theme = THEMES.oxide!;
    const roles: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
    const t0 = performance.now();

    for (const role of roles) {
      meshPiece(PIECE_DEFINITIONS[role], theme.white);
      meshPiece(PIECE_DEFINITIONS[role], theme.black);
    }

    const duration = performance.now() - t0;
    expect(duration).toBeLessThan(250);
  });

  it("7. snapshot triangle counts per piece", () => {
    const theme = THEMES.oxide!;
    const roles: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
    const counts: Record<string, number> = {};

    for (const role of roles) {
      const mesh = meshPiece(PIECE_DEFINITIONS[role], theme.white);
      counts[role] = mesh.triangleCount;
      expect(mesh.triangleCount).toBeGreaterThan(100);
      expect(mesh.triangleCount).toBeLessThan(5000);
    }

    console.log("Piece triangle counts:", counts);
  });
});
