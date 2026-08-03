import * as THREE from "three";
import { Square, Role, Color } from "../../core/types";
import { squareToWorld } from "../picking";
import { Palette, THEMES } from "../voxel/palette";
import { SHADOW_REST_OPACITY } from "../pieces";
import { VoxelDebrisManager } from "./debris";
import { BoardPhysicsEngine } from "./shake";

/**
 * A move the player carried out by hand.
 *
 * Travel is information — "a piece went from A to B" — and a drag has already
 * delivered it, so the arc is skipped. Arrival is consequence: a heavy object
 * met the board, which is just as true when a hand brought it. The piece falls
 * the last stretch from where it was let go and lands normally.
 */
export interface ArrivalParams {
  /** Where the hand released the piece, in world space. */
  startWorld: THREE.Vector3;
  /** The height it was held at. */
  startY: number;
  /** Whatever swing the drag left in it, damped out as it lands. */
  startTilt?: { x: number; z: number } | undefined;
}

/**
 * When each part of a landing happens, as a fraction of the animation.
 *
 * A flown piece impacts in mid-air and squashes as it settles at the end. A
 * dropped one has no flight, so the landing and the impact are the same
 * instant.
 */
interface AnimPhases {
  /** The victim shatters; for an arrival, also when the piece touches down. */
  impactT: number;
  /** The squash-and-stretch window opens. */
  squashT: number;
  /** The shockwave ring has finished expanding. */
  ringEndT: number;
}

const TRAVEL_PHASES: AnimPhases = {
  impactT: 0.35,
  squashT: 0.75,
  ringEndT: 0.95,
};

const ARRIVAL_PHASES: AnimPhases = {
  impactT: 0.3,
  squashT: 0.3,
  ringEndT: 0.9,
};

export interface PieceAnimTarget {
  mesh: THREE.Mesh;
  shadowQuad: THREE.Mesh;
  fromSquare: Square;
  toSquare: Square;
  durationMs: number;
  arrival?: ArrivalParams | undefined;
  isKnight?: boolean | undefined;
  isCapture?: boolean | undefined;
  capturedMesh?: THREE.Mesh | undefined;
  capturedShadowQuad?: THREE.Mesh | undefined;
  capturedRole?: Role | undefined;
  capturedColor?: Color | undefined;
  palette?: Palette | undefined;
  isCastle?: boolean | undefined;
  rookMesh?: THREE.Mesh | undefined;
  rookShadowQuad?: THREE.Mesh | undefined;
  rookFromSquare?: Square | undefined;
  rookToSquare?: Square | undefined;
  isPromotion?: boolean | undefined;
  impactRing?: THREE.Mesh | undefined;
}

interface ActiveAnim {
  target: PieceAnimTarget;
  phases: AnimPhases;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  rookStartPos?: THREE.Vector3 | undefined;
  rookEndPos?: THREE.Vector3 | undefined;
  startTime: number;
  durationMs: number;
  hasExploded?: boolean | undefined;
  hasLanded?: boolean | undefined;
  onComplete?: (() => void) | undefined;
}

export class AnimationEngine {
  private activeAnims: ActiveAnim[] = [];
  public readonly debrisManager = new VoxelDebrisManager();
  public readonly physicsEngine = new BoardPhysicsEngine();
  private lastUpdateTime = performance.now();

  animateMove(
    target: PieceAnimTarget,
    boardFlipped: boolean,
    onComplete?: () => void,
  ) {
    // An arrival starts wherever the hand let go, which is rarely a square
    // centre and never the origin square.
    const startPos =
      target.arrival?.startWorld ??
      squareToWorld(target.fromSquare, boardFlipped);
    const endPos = squareToWorld(target.toSquare, boardFlipped);

    let rookStartPos: THREE.Vector3 | undefined;
    let rookEndPos: THREE.Vector3 | undefined;

    if (
      target.isCastle &&
      target.rookFromSquare !== undefined &&
      target.rookToSquare !== undefined
    ) {
      rookStartPos = squareToWorld(target.rookFromSquare, boardFlipped);
      rookEndPos = squareToWorld(target.rookToSquare, boardFlipped);
    }

    if (target.impactRing) {
      target.impactRing.position.set(endPos.x, 0.025, endPos.z);
      target.impactRing.scale.set(0.1, 0.1, 0.1);
      (target.impactRing.material as THREE.MeshBasicMaterial).opacity = 0;
      target.impactRing.visible = false;
    }

    this.activeAnims.push({
      target,
      phases: target.arrival ? ARRIVAL_PHASES : TRAVEL_PHASES,
      startPos,
      endPos,
      rookStartPos,
      rookEndPos,
      startTime: performance.now(),
      durationMs: target.durationMs,
      onComplete,
    });
  }

  update(now = performance.now()): boolean {
    const dt = Math.max(0.001, Math.min(0.1, (now - this.lastUpdateTime) / 1000));
    this.lastUpdateTime = now;

    // Update particles
    this.debrisManager.update(dt);

    if (this.activeAnims.length === 0) {
      this.physicsEngine.resetTilt();
      const physicsState = this.physicsEngine.update(now, dt * 1000);
      return physicsState.isActive;
    }

    const remaining: ActiveAnim[] = [];

    for (const anim of this.activeAnims) {
      const elapsed = now - anim.startTime;
      const rawT = Math.min(1, Math.max(0, elapsed / anim.durationMs));

      const { impactT, squashT, ringEndT } = anim.phases;
      const arrival = anim.target.arrival;

      // A flown piece eases across the whole duration. A dropped one has only
      // the fall to cover, and must be at rest by the time it touches down —
      // otherwise it keeps sliding after it has landed.
      const glide = arrival ? Math.min(1, rawT / impactT) : rawT;
      // Cubic ease-out: 1 - (1 - t)^3
      const t = 1 - Math.pow(1 - glide, 3);

      // Linear XZ interpolate
      const currentX = anim.startPos.x + (anim.endPos.x - anim.startPos.x) * t;
      const currentZ = anim.startPos.z + (anim.endPos.z - anim.startPos.z) * t;

      // Motion vector calculations for board weight tilt
      const dx = anim.endPos.x - anim.startPos.x;
      const dz = anim.endPos.z - anim.startPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const ux = dist > 0.001 ? dx / dist : 0;
      const uz = dist > 0.001 ? dz / dist : 0;

      // Pass piece move trajectory to dynamic board tilt physics engine
      if (dist > 0.001) {
        this.physicsEngine.setMoveTilt(ux, uz, rawT);
      }

      let heightY: number;
      if (arrival) {
        // Gravity, not a hop: it accelerates downward and reaches the board
        // exactly on the frame the impact fires.
        const fall = Math.min(1, rawT / impactT);
        heightY = arrival.startY * (1 - fall * fall);
      } else {
        // Parabolic arc for Y lift: Knights jump higher (0.65 vs 0.45)
        const maxArc = anim.target.isKnight ? 0.65 : 0.45;
        heightY = Math.sin(Math.PI * rawT) * maxArc;
      }

      anim.target.mesh.position.set(currentX, heightY, currentZ);
      anim.target.mesh.rotation.set(0, 0, 0);

      if (arrival) {
        // Whatever swing the drag left in the piece settles as it lands, rather
        // than snapping upright the instant the hand lets go.
        const tilt = arrival.startTilt;
        if (tilt) {
          const settle = 1 - Math.min(1, rawT / impactT);
          anim.target.mesh.rotation.x = tilt.x * settle;
          anim.target.mesh.rotation.z = tilt.z * settle;
        }
      } else if (dist > 0.001) {
        // Forward lean tilt into move direction
        const tiltFactor = Math.sin(Math.PI * rawT) * 0.22;
        anim.target.mesh.rotation.x = -uz * tiltFactor;
        anim.target.mesh.rotation.z = ux * tiltFactor;
      }

      // Landing squash & stretch (a quarter of the animation from touchdown)
      if (rawT > squashT) {
        const landingT = Math.min(1, (rawT - squashT) / 0.25);
        const bounce = Math.sin(Math.PI * landingT) * 0.12;
        anim.target.mesh.scale.y = Math.max(0.7, 1.0 - bounce);
        const xzExpand = 1.0 + bounce * 0.5;
        anim.target.mesh.scale.x = xzExpand;
        anim.target.mesh.scale.z = xzExpand;
      }

      // Shadow quad dynamics: softens and shrinks as piece lifts
      const shadowScale = Math.max(0.5, 1 - heightY * 0.35);
      const shadowOpacity = Math.max(0.15, SHADOW_REST_OPACITY - heightY * 0.4);
      anim.target.shadowQuad.position.set(currentX, 0.01, currentZ);
      anim.target.shadowQuad.scale.set(shadowScale, shadowScale, shadowScale);
      (anim.target.shadowQuad.material as THREE.MeshBasicMaterial).opacity = shadowOpacity;

      // Handle Rook move in Castling
      if (
        anim.target.isCastle &&
        anim.target.rookMesh &&
        anim.target.rookShadowQuad &&
        anim.rookStartPos &&
        anim.rookEndPos
      ) {
        const rookX = anim.rookStartPos.x + (anim.rookEndPos.x - anim.rookStartPos.x) * t;
        const rookZ = anim.rookStartPos.z + (anim.rookEndPos.z - anim.rookStartPos.z) * t;
        const rookArcY = Math.sin(Math.PI * rawT) * 0.35;
        anim.target.rookMesh.position.set(rookX, rookArcY, rookZ);
        anim.target.rookShadowQuad.position.set(rookX, 0.01, rookZ);
      }

      // Handle Violent Captured Piece physics & explosive voxel breakup
      if (anim.target.isCapture) {
        if (rawT >= impactT && !anim.hasExploded) {
          anim.hasExploded = true;

          // Trigger Violent Board Shake on Capture Impact
          this.physicsEngine.triggerShake(1.3, 380, now);

          // Spawn Explosive Voxel Shatter Debris
          const palette =
            anim.target.palette ??
            (anim.target.capturedColor === "white"
              ? THEMES.oxide!.white
              : THEMES.oxide!.black);

          this.debrisManager.spawnExplosion(
            anim.endPos,
            palette,
            anim.target.capturedRole ?? "pawn",
          );
        }

        if (anim.target.capturedMesh && rawT >= impactT) {
          const tumbleT = (rawT - impactT) / (1 - impactT);
          const capY = -tumbleT * 1.5;
          const capScale = Math.max(0, 1 - tumbleT * 1.2);

          anim.target.capturedMesh.position.y = capY;
          anim.target.capturedMesh.scale.set(capScale, capScale, capScale);
          anim.target.capturedMesh.rotation.x = tumbleT * Math.PI * 1.2;
          anim.target.capturedMesh.rotation.z = tumbleT * Math.PI * 0.8;

          if (anim.target.capturedShadowQuad) {
            anim.target.capturedShadowQuad.position.y = capY;
            (anim.target.capturedShadowQuad.material as THREE.MeshBasicMaterial).opacity = Math.max(
              0,
              SHADOW_REST_OPACITY * capScale,
            );
          }
        }

        // Impact Ring visual shockwave burst effect on target square
        if (anim.target.impactRing) {
          if (rawT >= impactT && rawT <= ringEndT) {
            const ringT = (rawT - impactT) / (ringEndT - impactT);
            const ringScale = 0.2 + ringT * 1.8;
            const ringOpacity = Math.max(0, 1.0 - ringT);

            anim.target.impactRing.visible = true;
            anim.target.impactRing.scale.set(ringScale, ringScale, ringScale);
            (anim.target.impactRing.material as THREE.MeshBasicMaterial).opacity = ringOpacity * 0.85;
          } else {
            anim.target.impactRing.visible = false;
          }
        }
      }

      // Impact recoil & crisp landing thud, at the moment the piece touches
      // down. A flown piece lands as the animation ends; a dropped one lands at
      // impact and then stands there while its victim finishes falling apart,
      // so this cannot simply fire on completion.
      const landT = arrival ? impactT : 1;
      if (!anim.hasLanded && rawT >= landT) {
        anim.hasLanded = true;
        this.physicsEngine.triggerImpactRecoil(ux, uz, 0.07);
        if (!anim.target.isCapture) {
          // A placed piece is set down deliberately, so it reads a shade
          // firmer than one that merely arrived.
          if (arrival) this.physicsEngine.triggerShake(0.45, 180, now);
          else this.physicsEngine.triggerShake(0.35, 160, now);
        }
      }

      if (rawT < 1) {
        remaining.push(anim);
      } else {
        this.settle(anim);
      }
    }

    this.activeAnims = remaining;
    this.physicsEngine.update(now, dt * 1000);
    return true;
  }

  /**
   * Puts every mesh this animation touched into its finished state and reports
   * completion. Cancelling runs the same path as finishing, because a move that
   * is interrupted has still happened — the position already contains it.
   *
   * Leaving the captured mesh out of this was how a piece vanished: cancelling
   * mid-capture left it shrunk to nothing under the board and never told the
   * caller to discard it.
   */
  private settle(anim: ActiveAnim) {
    anim.target.mesh.position.set(anim.endPos.x, 0, anim.endPos.z);
    anim.target.mesh.rotation.set(0, 0, 0);
    anim.target.mesh.scale.set(1, 1, 1);

    anim.target.shadowQuad.position.set(anim.endPos.x, 0.01, anim.endPos.z);
    anim.target.shadowQuad.scale.set(1, 1, 1);
    (anim.target.shadowQuad.material as THREE.MeshBasicMaterial).opacity =
      SHADOW_REST_OPACITY;

    if (anim.target.capturedMesh) {
      // Hidden rather than restored. The mesh is off the board either way, and
      // onComplete is what actually removes it.
      anim.target.capturedMesh.visible = false;
      if (anim.target.capturedShadowQuad) {
        anim.target.capturedShadowQuad.visible = false;
      }
    }

    if (
      anim.target.rookMesh &&
      anim.target.rookShadowQuad &&
      anim.rookEndPos
    ) {
      anim.target.rookMesh.position.set(anim.rookEndPos.x, 0, anim.rookEndPos.z);
      anim.target.rookMesh.rotation.set(0, 0, 0);
      anim.target.rookMesh.scale.set(1, 1, 1);
      anim.target.rookShadowQuad.position.set(
        anim.rookEndPos.x,
        0.01,
        anim.rookEndPos.z,
      );
      anim.target.rookShadowQuad.scale.set(1, 1, 1);
      (
        anim.target.rookShadowQuad.material as THREE.MeshBasicMaterial
      ).opacity = SHADOW_REST_OPACITY;
    }

    if (anim.target.impactRing) {
      anim.target.impactRing.visible = false;
    }

    if (anim.onComplete) {
      anim.onComplete();
    }
  }

  /** Pure read of the transform produced by the last {@link update}. */
  getBoardTransform() {
    return this.physicsEngine.getTransform();
  }

  cancelAll() {
    const cancelled = this.activeAnims;
    this.activeAnims = [];
    for (const anim of cancelled) {
      this.settle(anim);
    }
    this.debrisManager.clear();
    this.physicsEngine.resetTilt();
  }

  isAnimating(): boolean {
    return this.activeAnims.length > 0 || this.physicsEngine.isActive();
  }
}
