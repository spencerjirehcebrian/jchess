import * as THREE from "three";
import { Square, Role, Color } from "../../core/types";
import { squareToWorld } from "../picking";
import { Palette, THEMES } from "../voxel/palette";
import { SHADOW_REST_OPACITY } from "../pieces";
import { VoxelDebrisManager } from "./debris";
import { BoardPhysicsEngine } from "./shake";

export interface PieceAnimTarget {
  mesh: THREE.Mesh;
  shadowQuad: THREE.Mesh;
  fromSquare: Square;
  toSquare: Square;
  durationMs: number;
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
    const startPos = squareToWorld(target.fromSquare, boardFlipped);
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

      // Cubic ease-out: 1 - (1 - t)^3
      const t = 1 - Math.pow(1 - rawT, 3);

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

      // Parabolic arc for Y lift: Knights jump higher (0.65 vs 0.45)
      const maxArc = anim.target.isKnight ? 0.65 : 0.45;
      const arcY = Math.sin(Math.PI * rawT) * maxArc;

      anim.target.mesh.position.set(currentX, arcY, currentZ);
      anim.target.mesh.rotation.set(0, 0, 0);

      // Forward lean tilt into move direction
      if (dist > 0.001) {
        const tiltFactor = Math.sin(Math.PI * rawT) * 0.22;
        anim.target.mesh.rotation.x = -uz * tiltFactor;
        anim.target.mesh.rotation.z = ux * tiltFactor;
      }

      // Landing squash & stretch (in final 25% of animation)
      if (rawT > 0.75) {
        const landingT = (rawT - 0.75) / 0.25;
        const bounce = Math.sin(Math.PI * landingT) * 0.12;
        anim.target.mesh.scale.y = Math.max(0.7, 1.0 - bounce);
        const xzExpand = 1.0 + bounce * 0.5;
        anim.target.mesh.scale.x = xzExpand;
        anim.target.mesh.scale.z = xzExpand;
      }

      // Shadow quad dynamics: softens and shrinks as piece lifts
      const shadowScale = Math.max(0.5, 1 - arcY * 0.35);
      const shadowOpacity = Math.max(0.15, SHADOW_REST_OPACITY - arcY * 0.4);
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

      // Handle Violent Captured Piece physics & explosive voxel breakup (impact hit around rawT=0.35)
      if (anim.target.isCapture) {
        if (rawT >= 0.35 && !anim.hasExploded) {
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

        if (anim.target.capturedMesh && rawT >= 0.35) {
          const tumbleT = (rawT - 0.35) / 0.65;
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
          if (rawT >= 0.35 && rawT <= 0.95) {
            const ringT = (rawT - 0.35) / 0.6;
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

      if (rawT < 1) {
        remaining.push(anim);
      } else {
        // Apply impact recoil & crisp landing thud shake
        if (!anim.hasLanded) {
          anim.hasLanded = true;
          this.physicsEngine.triggerImpactRecoil(ux, uz, 0.07);
          if (!anim.target.isCapture) {
            this.physicsEngine.triggerShake(0.35, 160, now);
          }
        }

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
