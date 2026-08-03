import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { PieceManager } from "../../src/render/pieces";
import { AnimationEngine } from "../../src/render/animation/engine";
import { THEMES } from "../../src/render/voxel/palette";
import { positionAfter, Position } from "../../src/core/rules";
import { squareToWorld } from "../../src/render/picking";
import { START_FEN, Move, Square } from "../../src/core/types";

const theme = THEMES.lacquer!;

function pos(...moves: Move[]): Position {
  return positionAfter(START_FEN, moves);
}

function occupiedSquares(p: Position): Square[] {
  const squares: Square[] = [];
  for (let sq = 0; sq < 64; sq++) {
    if (p.board.get(sq)) squares.push(sq);
  }
  return squares;
}

/**
 * The board on screen must hold exactly the pieces the position holds, each
 * standing upright on its own square. This is the invariant that the old
 * role-and-colour matching broke: it could hand a square the wrong mesh and
 * sweep the right one out of the scene, so a piece disappeared while the
 * position still had it.
 */
function expectBoardMatches(
  manager: PieceManager,
  p: Position,
  boardFlipped = false,
) {
  const squares = occupiedSquares(p);
  expect(manager.getActivePieces().length).toBe(squares.length);

  for (const sq of squares) {
    const occupant = p.board.get(sq)!;
    const rendered = manager.getPieceAt(sq);
    expect(rendered, `no mesh on square ${sq}`).toBeTruthy();
    expect(rendered!.role).toBe(occupant.role);
    expect(rendered!.color).toBe(occupant.color);
    expect(rendered!.mesh.parent).toBe(manager.piecesGroup);

    const world = squareToWorld(sq, boardFlipped);
    expect(rendered!.mesh.position.x).toBeCloseTo(world.x, 5);
    expect(rendered!.mesh.position.y).toBeCloseTo(0, 5);
    expect(rendered!.mesh.position.z).toBeCloseTo(world.z, 5);
    expect(rendered!.mesh.scale.x).toBeCloseTo(1, 5);
  }
}

describe("PieceManager identity", () => {
  it("syncPosition puts every piece of the start position on the board", () => {
    const manager = new PieceManager(theme);
    const start = pos();
    manager.syncPosition(start, false);
    expectBoardMatches(manager, start);
    manager.dispose();
  });

  it("moves the mesh that actually left the square, not one of its twins", () => {
    const manager = new PieceManager(theme);
    manager.syncPosition(pos(), false);

    // Both black knights are still home. g8 is the higher square index, so the
    // old insertion-order fallback would have picked b8's mesh for f6.
    const g8Knight = manager.getPieceAt(62)!;
    const b8Knight = manager.getPieceAt(57)!;
    expect(g8Knight).not.toBe(b8Knight);

    manager.applyMove({ from: 62, to: 45 });

    expect(manager.getPieceAt(45)).toBe(g8Knight);
    expect(manager.getPieceAt(57)).toBe(b8Knight);
    expect(manager.getPieceAt(62)).toBeNull();
  });

  it("keeps the board whole when a capture is interrupted mid-animation", () => {
    const manager = new PieceManager(theme);

    // 1. e4 d5 2. exd5 — white's pawn takes on d5.
    const beforeCapture = pos({ from: 12, to: 28 }, { from: 51, to: 35 });
    manager.syncPosition(beforeCapture, false);

    const capturingPawn = manager.getPieceAt(28)!;
    const doomedPawn = manager.getPieceAt(35)!;

    const applied = manager.applyMove({
      from: 28,
      to: 35,
      capturedSquare: 35,
    })!;
    expect(applied.moved).toBe(capturingPawn);
    expect(applied.captured).toBe(doomedPawn);

    // The captured mesh is mid-tumble: off the position, still in the scene.
    expect(manager.getPieceAt(35)).toBe(capturingPawn);
    doomedPawn.mesh.scale.set(0.01, 0.01, 0.01);
    doomedPawn.mesh.position.y = -1.5;

    // A second move lands before the tumble finishes. Nothing may be lost.
    const afterCapture = pos(
      { from: 12, to: 28 },
      { from: 51, to: 35 },
      { from: 28, to: 35 },
    );
    manager.syncPosition(afterCapture, false);

    expectBoardMatches(manager, afterCapture);
    expect(doomedPawn.mesh.parent).toBeNull();
    manager.dispose();
  });

  it("promotes in place, so the pawn that set off is the queen that lands", () => {
    const manager = new PieceManager(theme);

    // A white pawn on a7 with a8 empty, ready to promote.
    const p = positionAfter("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", []);
    manager.syncPosition(p, false);

    const pawn = manager.getPieceAt(48)!;
    expect(pawn.role).toBe("pawn");
    const pawnGeometry = pawn.mesh.geometry;

    manager.applyMove({ from: 48, to: 56, promotion: "queen" });

    const promoted = manager.getPieceAt(56)!;
    expect(promoted).toBe(pawn);
    expect(promoted.role).toBe("queen");
    expect(promoted.mesh.geometry).not.toBe(pawnGeometry);
    expect(promoted.mesh.parent).toBe(manager.piecesGroup);
    manager.dispose();
  });

  it("moves the rook too when the king castles", () => {
    const manager = new PieceManager(theme);
    const p = positionAfter("4k3/8/8/8/8/8/8/4K2R w K - 0 1", []);
    manager.syncPosition(p, false);

    const king = manager.getPieceAt(4)!;
    const rook = manager.getPieceAt(7)!;

    const applied = manager.applyMove({
      from: 4,
      to: 6,
      rookFrom: 7,
      rookTo: 5,
    })!;

    expect(applied.moved).toBe(king);
    expect(applied.rook).toBe(rook);
    expect(manager.getPieceAt(6)).toBe(king);
    expect(manager.getPieceAt(5)).toBe(rook);
    expect(manager.getPieceAt(7)).toBeNull();
    manager.dispose();
  });

  it("leaves a held piece alone so a drag is not snapped back", () => {
    const manager = new PieceManager(theme);
    const start = pos();
    manager.syncPosition(start, false);

    const pawn = manager.getPieceAt(12)!;
    manager.holdPiece(12);
    pawn.mesh.position.set(1.5, 0.55, -2.0);

    manager.syncPosition(start, false);
    expect(pawn.mesh.position.y).toBeCloseTo(0.55, 5);

    manager.releasePiece(false);
    expect(pawn.mesh.position.y).toBeCloseTo(0, 5);
    manager.dispose();
  });

  it("gives every contact shadow its own material", () => {
    const manager = new PieceManager(theme);
    manager.syncPosition(pos(), false);

    const a = manager.getPieceAt(12)!;
    const b = manager.getPieceAt(13)!;
    expect(a.shadowQuad.material).not.toBe(b.shadowQuad.material);

    // Fading one piece's shadow must not touch its neighbour's.
    (a.shadowQuad.material as THREE.MeshBasicMaterial).opacity = 0;
    expect(
      (b.shadowQuad.material as THREE.MeshBasicMaterial).opacity,
    ).toBeGreaterThan(0);
    manager.dispose();
  });
});

describe("PieceManager with AnimationEngine", () => {
  it("discards the captured piece when the animation is cancelled", () => {
    const manager = new PieceManager(theme);
    const anim = new AnimationEngine();

    const beforeCapture = pos({ from: 12, to: 28 }, { from: 51, to: 35 });
    manager.syncPosition(beforeCapture, false);

    const applied = manager.applyMove({
      from: 28,
      to: 35,
      capturedSquare: 35,
    })!;
    const captured = applied.captured!;

    anim.animateMove(
      {
        mesh: applied.moved.mesh,
        shadowQuad: applied.moved.shadowQuad,
        fromSquare: 28,
        toSquare: 35,
        durationMs: 220,
        isCapture: true,
        capturedMesh: captured.mesh,
        capturedShadowQuad: captured.shadowQuad,
      },
      false,
      () => manager.discardSettling(captured),
    );

    expect(captured.mesh.parent).toBe(manager.piecesGroup);

    anim.cancelAll();

    expect(captured.mesh.parent).toBeNull();
    expect(applied.moved.mesh.scale.x).toBeCloseTo(1, 5);
    expect(applied.moved.mesh.position.y).toBeCloseTo(0, 5);

    const afterCapture = pos(
      { from: 12, to: 28 },
      { from: 51, to: 35 },
      { from: 28, to: 35 },
    );
    expectBoardMatches(manager, afterCapture);
    manager.dispose();
  });
});
