import * as THREE from "three";
import { Square } from "../core/types";
import { RenderedPiece, SHADOW_REST_OPACITY } from "./pieces";

/**
 * How far above the board a held piece rides — `0.6 * squareSize`, per
 * docs/08-input.md. Under the board's 62° camera the lift is what sells the
 * grip: the piece separates from its own shadow and hangs above the square the
 * cursor is over.
 */
export const DRAG_LIFT = 0.6;

/**
 * How high a held piece rides under a finger.
 *
 * At 0.6 the piece sits about 34 CSS pixels up-screen from the contact point,
 * and a fingertip covers roughly 25 pixels in every direction from it — so the
 * thing you are dragging is entirely underneath your own hand. A mouse cursor
 * has no such problem, which is why the spec's single number works everywhere
 * else.
 *
 * Measured against a 9mm contact patch on a Pixel 7: at 0.6 only the crown
 * clears the finger, at 1.0 the crown and collar, and at 1.4 the whole piece.
 * Past that it stops reading as held above its square.
 */
export const DRAG_LIFT_TOUCH = 1.4;

export function dragLiftFor(pointerType: string): number {
  return pointerType === "touch" ? DRAG_LIFT_TOUCH : DRAG_LIFT;
}

/**
 * Pointer travel, in CSS pixels, before a press becomes a drag.
 *
 * `docs/08-input.md` gives 4px flat, which is right for a device that reports a
 * point. A fingertip reports the centroid of a contact patch, and that centroid
 * wanders several pixels during an ordinary tap, so 4px turns half the taps on
 * a piece into one-pixel drags that end where they started.
 */
export const DRAG_THRESHOLD_PX = 4;
export const DRAG_THRESHOLD_TOUCH_PX = 10;

export function dragThresholdFor(pointerType: string): number {
  return pointerType === "touch" ? DRAG_THRESHOLD_TOUCH_PX : DRAG_THRESHOLD_PX;
}

/**
 * How long a released piece takes to land. Both give roughly a 90ms fall — the
 * capture case runs longer only so the shattered piece has room to finish
 * falling apart after the mover has already come to rest.
 */
export const DROP_QUIET_MS = 200;
export const DROP_CAPTURE_MS = 300;

const LIFT_RATE = 18; // how fast the piece rises into the grip, per second
const SWING_STIFFNESS = 150;
const SWING_DAMPING = 11; // under critical, so it swings once and settles
const SWING_PER_UNIT_SPEED = 0.09; // radians of lean per world-unit/sec
const MAX_SWING = 0.34; // ~19°, past which it reads as falling rather than hanging
const VELOCITY_SMOOTHING = 0.35;
const HELD_SCALE = 1.06;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A piece held by the pointer.
 *
 * It hangs rather than sticks: the tilt is a damped spring driven by pointer
 * speed, so the piece trails the cursor, overshoots when you stop, and settles.
 * The direction of lean matches the one the move animation already uses, so a
 * dragged piece and a played one lean the same way.
 */
export class PieceDragController {
  private piece: RenderedPiece | null = null;
  private fromSquare: Square | null = null;

  private worldX = 0;
  private worldZ = 0;
  private lift = 0;
  private liftTarget = DRAG_LIFT;

  private velX = 0;
  private velZ = 0;

  private swingPitch = 0; // rotation.x, from motion along z
  private swingRoll = 0; // rotation.z, from motion along x
  private swingVelPitch = 0;
  private swingVelRoll = 0;

  private reducedMotion = prefersReducedMotion();

  isDragging(): boolean {
    return this.piece !== null;
  }

  getPiece(): RenderedPiece | null {
    return this.piece;
  }

  getFromSquare(): Square | null {
    return this.fromSquare;
  }

  /**
   * The pose the hand let go at. The landing animation starts from here, so a
   * released piece falls from where it actually was rather than teleporting to
   * the square centre.
   */
  getPose(): { world: THREE.Vector3; y: number; tilt: { x: number; z: number } } {
    return {
      world: new THREE.Vector3(this.worldX, 0, this.worldZ),
      y: this.lift,
      tilt: { x: this.swingPitch, z: this.swingRoll },
    };
  }

  begin(
    piece: RenderedPiece,
    from: Square,
    world: THREE.Vector3,
    pointerType = "mouse",
  ) {
    this.piece = piece;
    this.fromSquare = from;
    this.worldX = world.x;
    this.worldZ = world.z;
    this.lift = piece.mesh.position.y;
    this.liftTarget = dragLiftFor(pointerType);
    this.velX = 0;
    this.velZ = 0;
    this.swingPitch = 0;
    this.swingRoll = 0;
    this.swingVelPitch = 0;
    this.swingVelRoll = 0;
    this.reducedMotion = prefersReducedMotion();
  }

  /** Follows the pointer. `dt` is seconds since the previous move event. */
  moveTo(world: THREE.Vector3, dt: number) {
    if (!this.piece) return;

    if (dt > 0) {
      const instantX = (world.x - this.worldX) / dt;
      const instantZ = (world.z - this.worldZ) / dt;
      this.velX += (instantX - this.velX) * VELOCITY_SMOOTHING;
      this.velZ += (instantZ - this.velZ) * VELOCITY_SMOOTHING;
    }

    this.worldX = world.x;
    this.worldZ = world.z;
  }

  /**
   * Integrates the grip and writes the piece's transform.
   * Returns true while the piece is still settling and needs more frames.
   */
  update(dt: number): boolean {
    const piece = this.piece;
    if (!piece) return false;

    const step = Math.min(0.05, Math.max(0.001, dt));

    this.lift += (this.liftTarget - this.lift) * Math.min(1, LIFT_RATE * step);

    if (this.reducedMotion) {
      this.swingPitch = 0;
      this.swingRoll = 0;
    } else {
      // The bob trails the pivot: the faster the cursor travels, the further
      // behind the piece leans.
      const targetRoll = clamp(
        this.velX * SWING_PER_UNIT_SPEED,
        -MAX_SWING,
        MAX_SWING,
      );
      const targetPitch = clamp(
        -this.velZ * SWING_PER_UNIT_SPEED,
        -MAX_SWING,
        MAX_SWING,
      );

      this.swingVelRoll +=
        (SWING_STIFFNESS * (targetRoll - this.swingRoll) -
          SWING_DAMPING * this.swingVelRoll) *
        step;
      this.swingRoll += this.swingVelRoll * step;

      this.swingVelPitch +=
        (SWING_STIFFNESS * (targetPitch - this.swingPitch) -
          SWING_DAMPING * this.swingVelPitch) *
        step;
      this.swingPitch += this.swingVelPitch * step;

      // Pointer velocity decays on its own, so a cursor that stops moving
      // stops driving the spring even without further move events.
      this.velX *= Math.max(0, 1 - step * 8);
      this.velZ *= Math.max(0, 1 - step * 8);
    }

    piece.mesh.position.set(this.worldX, this.lift, this.worldZ);
    piece.mesh.rotation.set(this.swingPitch, 0, this.swingRoll);
    piece.mesh.scale.set(HELD_SCALE, HELD_SCALE, HELD_SCALE);

    // The shadow stays on the board directly under the cursor, shrunk and
    // softened by the height — the same relationship the move arc uses.
    const shadowScale = Math.max(0.55, 1 - this.lift * 0.4);
    piece.shadowQuad.position.set(this.worldX, 0.01, this.worldZ);
    piece.shadowQuad.scale.set(shadowScale, shadowScale, shadowScale);
    (piece.shadowQuad.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0.12,
      SHADOW_REST_OPACITY - this.lift * 0.35,
    );

    const settled =
      Math.abs(this.lift - this.liftTarget) < 0.002 &&
      Math.abs(this.swingVelRoll) < 0.002 &&
      Math.abs(this.swingVelPitch) < 0.002 &&
      Math.abs(this.swingRoll) < 0.002 &&
      Math.abs(this.swingPitch) < 0.002;

    return !settled;
  }

  /** Releases the piece. The caller decides where it belongs now. */
  end(): { piece: RenderedPiece; from: Square } | null {
    const piece = this.piece;
    const from = this.fromSquare;
    this.piece = null;
    this.fromSquare = null;
    if (!piece || from === null) return null;
    return { piece, from };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
