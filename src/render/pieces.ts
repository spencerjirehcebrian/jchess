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

/**
 * Everything the renderer already knows about a move, so the manager never has
 * to infer which mesh moved. Squares are pre-resolved: `capturedSquare` is the
 * pawn's square on en passant, not the destination.
 */
export interface MoveSpec {
  from: Square;
  to: Square;
  promotion?: Role | undefined;
  capturedSquare?: Square | undefined;
  rookFrom?: Square | undefined;
  rookTo?: Square | undefined;
}

export interface AppliedMove {
  moved: RenderedPiece;
  captured: RenderedPiece | null;
  rook: RenderedPiece | null;
}

/** Resting opacity of a contact shadow. One value, used everywhere. */
export const SHADOW_REST_OPACITY = 0.42;

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

/**
 * Owns one mesh per piece on the board.
 *
 * A piece's identity is the square it stands on: `bySquare` is the whole truth,
 * and the only ways it changes are {@link applyMove}, which is told exactly
 * which mesh went where, and {@link syncPosition}, which reconciles square by
 * square and never moves a mesh between squares.
 *
 * This replaces a scheme that matched meshes to squares by role and colour with
 * an insertion-order fallback. With no identity to appeal to, that scheme could
 * hand a square the wrong mesh and then sweep the right one out of the scene —
 * pieces vanished from the board while the position still held them.
 */
export class PieceManager {
  readonly piecesGroup = new THREE.Group();
  readonly shadowQuadsGroup = new THREE.Group();

  /** Live pieces, keyed by the square they occupy. */
  private bySquare = new Map<Square, RenderedPiece>();
  /**
   * Captured pieces that have left the position but are still tumbling. They
   * are in the scene and out of `bySquare`, so nothing can match against them.
   */
  private settling = new Set<RenderedPiece>();
  /** Square whose mesh is under the pointer; `syncPosition` leaves it alone. */
  private heldSquare: Square | null = null;

  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private shadowGeo: THREE.PlaneGeometry;
  private shadowTexture: THREE.CanvasTexture | null;
  private sharedMaterial: THREE.MeshLambertMaterial;
  private nextId = 0;

  constructor(theme: Theme) {
    this.piecesGroup.name = "piecesGroup";
    this.shadowQuadsGroup.name = "shadowQuadsGroup";

    // Contact shadow: a radial falloff, not a hard square. A flat quad reads as
    // a box painted under the piece, which is exactly what it looked like.
    this.shadowGeo = new THREE.PlaneGeometry(0.98, 0.98);
    this.shadowGeo.rotateX(-Math.PI / 2);

    this.shadowTexture = createContactShadowTexture();

    this.sharedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

    this.precacheGeometries(theme);
  }

  setTheme(theme: Theme) {
    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();
    this.precacheGeometries(theme);

    for (const piece of this.allPieces()) {
      const newGeo = this.geometryCache.get(`${piece.color}-${piece.role}`);
      if (newGeo) piece.mesh.geometry = newGeo;
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

  private allPieces(): RenderedPiece[] {
    return [...this.bySquare.values(), ...this.settling];
  }

  /**
   * Each quad owns its material. Sharing one meant a single piece lifting faded
   * every shadow on the board, because the animation writes opacity per piece.
   */
  private createShadowQuad(): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: SHADOW_REST_OPACITY,
      depthWrite: false,
      ...(this.shadowTexture ? { map: this.shadowTexture } : {}),
    });
    return new THREE.Mesh(this.shadowGeo, material);
  }

  private createPiece(
    role: Role,
    color: Color,
    square: Square,
    boardFlipped: boolean,
  ): RenderedPiece {
    const world = squareToWorld(square, boardFlipped);
    const geo = this.geometryCache.get(`${color}-${role}`)!;

    const mesh = new THREE.Mesh(geo, this.sharedMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.position.set(world.x, 0, world.z);

    const shadowQuad = this.createShadowQuad();
    shadowQuad.position.set(world.x, 0.01, world.z);

    const piece: RenderedPiece = {
      id: `${color}-${role}-${this.nextId++}`,
      role,
      color,
      mesh,
      shadowQuad,
      square,
    };

    this.piecesGroup.add(mesh);
    this.shadowQuadsGroup.add(shadowQuad);
    return piece;
  }

  /** Detaches from the scene and frees the quad's own material. */
  private destroyPiece(piece: RenderedPiece) {
    this.piecesGroup.remove(piece.mesh);
    this.shadowQuadsGroup.remove(piece.shadowQuad);
    (piece.shadowQuad.material as THREE.Material).dispose();
  }

  /** Puts a mesh flat on its square at rest. */
  private settleAt(piece: RenderedPiece, square: Square, boardFlipped: boolean) {
    const world = squareToWorld(square, boardFlipped);
    piece.mesh.position.set(world.x, 0, world.z);
    piece.mesh.rotation.set(0, 0, 0);
    piece.mesh.scale.set(1, 1, 1);
    piece.shadowQuad.position.set(world.x, 0.01, world.z);
    piece.shadowQuad.scale.set(1, 1, 1);
    piece.shadowQuad.visible = true;
    (piece.shadowQuad.material as THREE.MeshBasicMaterial).opacity =
      SHADOW_REST_OPACITY;
  }

  /**
   * Reconciles the board against `pos`, square by square. A square whose
   * occupant already matches is repositioned; anything else is rebuilt in
   * place. No mesh ever migrates between squares here, so a mismatch can only
   * ever cost a rebuild — it can never delete a piece the position still holds.
   */
  syncPosition(pos: Position, boardFlipped: boolean) {
    for (let sq = 0; sq < 64; sq++) {
      const occupant = pos.board.get(sq);
      const rendered = this.bySquare.get(sq);

      if (!occupant) {
        if (rendered) {
          this.destroyPiece(rendered);
          this.bySquare.delete(sq);
        }
        continue;
      }

      if (
        rendered &&
        rendered.role === occupant.role &&
        rendered.color === occupant.color
      ) {
        // The held piece is following the pointer; its transform is not ours.
        if (sq !== this.heldSquare) this.settleAt(rendered, sq, boardFlipped);
        continue;
      }

      if (rendered) this.destroyPiece(rendered);
      this.bySquare.set(
        sq,
        this.createPiece(occupant.role, occupant.color, sq, boardFlipped),
      );
    }

    // A sync is a hard statement about the board, so nothing may still be
    // mid-tumble from a move that has been superseded.
    this.discardAllSettling();
  }

  /**
   * Moves the mesh the caller names, and returns the meshes the animation is
   * about to drive. Transforms are left untouched — the animation owns them
   * until it completes or is cancelled, which is why no orientation is needed
   * here.
   */
  applyMove(spec: MoveSpec): AppliedMove | null {
    const moved = this.bySquare.get(spec.from);
    if (!moved) return null;

    let captured: RenderedPiece | null = null;
    if (spec.capturedSquare !== undefined) {
      captured = this.bySquare.get(spec.capturedSquare) ?? null;
      if (captured) {
        this.bySquare.delete(spec.capturedSquare);
        this.settling.add(captured);
      }
    }

    // A piece may already stand on the destination when the capture square was
    // not given (a defensive path, and en passant's captured square differs).
    const displaced = this.bySquare.get(spec.to);
    if (displaced && displaced !== captured) {
      this.destroyPiece(displaced);
    }

    this.bySquare.delete(spec.from);
    moved.square = spec.to;
    this.bySquare.set(spec.to, moved);

    // Promotion swaps the geometry on the same mesh, so the pawn that set off
    // is the queen that lands. Retiring it and building a new mesh meant the
    // move was animating an object already out of the scene.
    if (spec.promotion) {
      const geo = this.geometryCache.get(`${moved.color}-${spec.promotion}`);
      if (geo) {
        moved.role = spec.promotion;
        moved.mesh.geometry = geo;
      }
    }

    let rook: RenderedPiece | null = null;
    if (spec.rookFrom !== undefined && spec.rookTo !== undefined) {
      rook = this.bySquare.get(spec.rookFrom) ?? null;
      if (rook) {
        this.bySquare.delete(spec.rookFrom);
        rook.square = spec.rookTo;
        this.bySquare.set(spec.rookTo, rook);
      }
    }

    if (this.heldSquare === spec.from) this.heldSquare = spec.to;

    return { moved, captured, rook };
  }

  /** Removes a tumbling capture once its animation has finished or been cut. */
  discardSettling(piece: RenderedPiece) {
    if (!this.settling.delete(piece)) return;
    this.destroyPiece(piece);
  }

  discardAllSettling() {
    for (const piece of this.settling) {
      this.destroyPiece(piece);
    }
    this.settling.clear();
  }

  /** Marks a square's mesh as pointer-driven, so syncPosition won't reset it. */
  holdPiece(square: Square | null) {
    this.heldSquare = square;
  }

  getHeldSquare(): Square | null {
    return this.heldSquare;
  }

  releasePiece(boardFlipped: boolean) {
    const square = this.heldSquare;
    this.heldSquare = null;
    if (square === null) return;
    const piece = this.bySquare.get(square);
    if (piece) this.settleAt(piece, square, boardFlipped);
  }

  getPieceAt(square: Square): RenderedPiece | null {
    return this.bySquare.get(square) ?? null;
  }

  getActivePieces(): RenderedPiece[] {
    return Array.from(this.bySquare.values());
  }

  dispose() {
    for (const piece of this.allPieces()) {
      this.destroyPiece(piece);
    }
    this.bySquare.clear();
    this.settling.clear();
    this.heldSquare = null;

    this.shadowGeo.dispose();
    this.shadowTexture?.dispose();
    this.sharedMaterial.dispose();
    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();
  }
}
