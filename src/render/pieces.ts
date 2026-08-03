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

/** Radial alpha ramp, opaque at the piece's footprint and gone by the edge. */
function createContactShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class PieceManager {
  readonly piecesGroup = new THREE.Group();
  readonly shadowQuadsGroup = new THREE.Group();

  private activePieces = new Map<string, RenderedPiece>();
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private shadowMaterial: THREE.MeshBasicMaterial;
  private shadowGeo: THREE.PlaneGeometry;
  private shadowTexture: THREE.CanvasTexture | null;
  private sharedMaterial: THREE.MeshLambertMaterial;

  constructor(theme: Theme) {
    this.piecesGroup.name = "piecesGroup";
    this.shadowQuadsGroup.name = "shadowQuadsGroup";

    // Contact shadow: a radial falloff, not a hard square. A flat quad reads as
    // a box painted under the piece, which is exactly what it looked like.
    this.shadowGeo = new THREE.PlaneGeometry(0.98, 0.98);
    this.shadowGeo.rotateX(-Math.PI / 2);

    this.shadowTexture = createContactShadowTexture();
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      ...(this.shadowTexture ? { map: this.shadowTexture } : {}),
    });

    this.sharedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

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
      const whiteMesh = meshPiece(PIECE_DEFINITIONS[role], theme.white);
      const blackMesh = meshPiece(PIECE_DEFINITIONS[role], theme.black);
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
      // Every piece is authored at final size; the pawn no longer needs to be
      // shrunk to read as the smallest, and scaling it also shrank the base
      // that is meant to be identical across the set.
      const scale = 1;

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
        const mesh = new THREE.Mesh(geo, this.sharedMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.position.set(worldPos.x, 0, worldPos.z);
        mesh.scale.set(scale, scale, scale);

        const shadowQuad = new THREE.Mesh(this.shadowGeo, this.shadowMaterial);
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
      this.activePieces.delete(id);
    }
  }

  getActivePieces(): RenderedPiece[] {
    return Array.from(this.activePieces.values());
  }

  dispose() {
    this.shadowGeo.dispose();
    this.shadowTexture?.dispose();
    this.shadowMaterial.dispose();
    this.sharedMaterial.dispose();
    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();
    this.activePieces.clear();
  }
}
