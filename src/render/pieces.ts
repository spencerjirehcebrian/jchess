import * as THREE from "three";
import { Square, Role, Color } from "../core/types";
import { squareToWorld } from "./picking";
import { Theme } from "./voxel/palette";
import { PIECE_DEFINITIONS } from "./voxel/pieces";
import { meshPiece } from "./voxel/mesher";
import { Position } from "../core/rules";

export interface RenderedPiece {
  id: string;
  role: Role;
  color: Color;
  mesh: THREE.Mesh;
  shadowQuad: THREE.Mesh;
  square: Square;
}

export interface UpdatePositionOptions {
  skipSquares?: Set<Square> | undefined;
  retainedIds?: Set<string> | undefined;
}

export class PieceManager {
  readonly piecesGroup = new THREE.Group();
  readonly shadowQuadsGroup = new THREE.Group();

  private activePieces = new Map<string, RenderedPiece>();
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private shadowMaterial: THREE.MeshBasicMaterial;

  constructor(theme: Theme) {
    this.piecesGroup.name = "piecesGroup";
    this.shadowQuadsGroup.name = "shadowQuadsGroup";

    // Soft contact shadow material
    const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    shadowGeo.rotateX(-Math.PI / 2);

    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    this.precacheGeometries(theme);
  }

  setTheme(theme: Theme) {
    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();
    this.precacheGeometries(theme);

    for (const active of this.activePieces.values()) {
      const geoKey = `${active.color}-${active.role}`;
      const newGeo = this.geometryCache.get(geoKey);
      if (newGeo) {
        active.mesh.geometry = newGeo;
      }
    }
  }

  private precacheGeometries(theme: Theme) {
    const roles: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
    for (const role of roles) {
      const whiteMesh = meshPiece(
        PIECE_DEFINITIONS[role],
        theme.white,
        "white",
      );
      const blackMesh = meshPiece(
        PIECE_DEFINITIONS[role],
        theme.black,
        "black",
      );
      this.geometryCache.set(`white-${role}`, whiteMesh.geometry);
      this.geometryCache.set(`black-${role}`, blackMesh.geometry);
    }
  }

  updatePosition(
    pos: Position,
    boardFlipped: boolean,
    options?: UpdatePositionOptions,
  ) {
    const currentPieces = new Map<Square, { role: Role; color: Color }>();

    for (let sq = 0; sq < 64; sq++) {
      const piece = pos.board.get(sq);
      if (piece) {
        currentPieces.set(sq, { role: piece.role, color: piece.color });
      }
    }

    // Match existing active pieces to new squares or create/remove
    const usedIds = new Set<string>();
    if (options?.retainedIds) {
      for (const id of options.retainedIds) {
        usedIds.add(id);
      }
    }

    const materialCache = new Map<string, THREE.MeshLambertMaterial>();

    const getMaterial = () => {
      if (!materialCache.has("mat")) {
        materialCache.set(
          "mat",
          new THREE.MeshLambertMaterial({ vertexColors: true }),
        );
      }
      return materialCache.get("mat")!;
    };

    // Assign stable IDs based on initial role & file/rank or square
    currentPieces.forEach(({ role, color }, sq) => {
      let matchedPiece: RenderedPiece | null = null;

      // Check if we already have an active piece at this square or matching piece
      for (const [id, active] of this.activePieces.entries()) {
        if (
          !usedIds.has(id) &&
          active.role === role &&
          active.color === color &&
          active.square === sq
        ) {
          matchedPiece = active;
          break;
        }
      }

      if (!matchedPiece) {
        for (const [id, active] of this.activePieces.entries()) {
          if (
            !usedIds.has(id) &&
            active.role === role &&
            active.color === color
          ) {
            matchedPiece = active;
            break;
          }
        }
      }

      const worldPos = squareToWorld(sq, boardFlipped);
      const scale = role === "pawn" ? 0.85 : 1;

      if (matchedPiece) {
        usedIds.add(matchedPiece.id);
        matchedPiece.square = sq;

        // Skip direct position snapping if piece is currently being animated
        if (!options?.skipSquares?.has(sq)) {
          matchedPiece.mesh.position.set(worldPos.x, 0, worldPos.z);
          matchedPiece.mesh.rotation.set(0, 0, 0);
          matchedPiece.mesh.scale.set(scale, scale, scale);
          matchedPiece.shadowQuad.position.set(worldPos.x, 0.01, worldPos.z);
          matchedPiece.shadowQuad.scale.set(scale, scale, scale);
        }
      } else {
        // Create new piece mesh
        const id = `${color}-${role}-${sq}-${Math.random().toString(36).slice(2, 6)}`;
        const geoKey = `${color}-${role}`;
        const geo = this.geometryCache.get(geoKey)!;
        const mesh = new THREE.Mesh(geo, getMaterial());
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.position.set(worldPos.x, 0, worldPos.z);
        mesh.scale.set(scale, scale, scale);

        const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
        shadowGeo.rotateX(-Math.PI / 2);
        const shadowQuad = new THREE.Mesh(shadowGeo, this.shadowMaterial);
        shadowQuad.position.set(worldPos.x, 0.01, worldPos.z);
        shadowQuad.scale.set(scale, scale, scale);

        const newPiece: RenderedPiece = {
          id,
          role,
          color,
          mesh,
          shadowQuad,
          square: sq,
        };

        this.activePieces.set(id, newPiece);
        usedIds.add(id);

        this.piecesGroup.add(mesh);
        this.shadowQuadsGroup.add(shadowQuad);
      }
    });

    // Remove retired pieces
    for (const [id, active] of Array.from(this.activePieces.entries())) {
      if (!usedIds.has(id)) {
        this.piecesGroup.remove(active.mesh);
        this.shadowQuadsGroup.remove(active.shadowQuad);
        active.mesh.geometry.dispose();
        this.activePieces.delete(id);
      }
    }
  }

  getPieceAt(square: Square): RenderedPiece | null {
    for (const active of this.activePieces.values()) {
      if (active.square === square) return active;
    }
    return null;
  }

  removePiece(id: string) {
    const active = this.activePieces.get(id);
    if (active) {
      this.piecesGroup.remove(active.mesh);
      this.shadowQuadsGroup.remove(active.shadowQuad);
      active.mesh.geometry.dispose();
      this.activePieces.delete(id);
    }
  }

  getActivePieces(): RenderedPiece[] {
    return Array.from(this.activePieces.values());
  }
}
