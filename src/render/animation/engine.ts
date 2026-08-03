import * as THREE from "three";
import { Square } from "../../core/types";
import { squareToWorld } from "../picking";

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
  onComplete?: (() => void) | undefined;
}

export class AnimationEngine {
  private activeAnims: ActiveAnim[] = [];

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
    if (this.activeAnims.length === 0) return false;

    const remaining: ActiveAnim[] = [];

    for (const anim of this.activeAnims) {
      const elapsed = now - anim.startTime;
      const rawT = Math.min(1, Math.max(0, elapsed / anim.durationMs));

      // Cubic ease-out: 1 - (1 - t)^3
      const t = 1 - Math.pow(1 - rawT, 3);

      // Linear XZ interpolate
      const currentX = anim.startPos.x + (anim.endPos.x - anim.startPos.x) * t;
      const currentZ = anim.startPos.z + (anim.endPos.z - anim.startPos.z) * t;

      // Parabolic arc for Y lift: Knights jump higher (0.65 vs 0.45)
      const maxArc = anim.target.isKnight ? 0.65 : 0.45;
      const arcY = Math.sin(Math.PI * rawT) * maxArc;

      anim.target.mesh.position.set(currentX, arcY, currentZ);

      // Dynamic forward tilt into motion vector
      const dx = anim.endPos.x - anim.startPos.x;
      const dz = anim.endPos.z - anim.startPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      anim.target.mesh.rotation.set(0, 0, 0);

      if (dist > 0.001) {
        const ux = dx / dist;
        const uz = dz / dist;
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
      const shadowOpacity = Math.max(0.15, 0.45 - arcY * 0.4);
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

      // Handle Captured Piece physics (impact hit around rawT=0.35, tumble, scale down, sink)
      if (anim.target.isCapture && anim.target.capturedMesh) {
        if (rawT >= 0.35) {
          const tumbleT = (rawT - 0.35) / 0.65;
          const capY = -tumbleT * 1.5;
          const capScale = Math.max(0, 1 - tumbleT);

          anim.target.capturedMesh.position.y = capY;
          anim.target.capturedMesh.scale.set(capScale, capScale, capScale);
          anim.target.capturedMesh.rotation.x = tumbleT * Math.PI * 0.6;
          anim.target.capturedMesh.rotation.z = tumbleT * Math.PI * 0.4;

          if (anim.target.capturedShadowQuad) {
            anim.target.capturedShadowQuad.position.y = capY;
            (anim.target.capturedShadowQuad.material as THREE.MeshBasicMaterial).opacity = Math.max(
              0,
              0.45 * capScale,
            );
          }
        }

        // Impact Ring visual burst effect on target square
        if (anim.target.impactRing) {
          if (rawT >= 0.35 && rawT <= 0.9) {
            const ringT = (rawT - 0.35) / 0.55;
            const ringScale = 0.2 + ringT * 1.2;
            const ringOpacity = Math.max(0, 1.0 - ringT);

            anim.target.impactRing.visible = true;
            anim.target.impactRing.scale.set(ringScale, ringScale, ringScale);
            (anim.target.impactRing.material as THREE.MeshBasicMaterial).opacity = ringOpacity * 0.65;
          } else {
            anim.target.impactRing.visible = false;
          }
        }
      }

      if (rawT < 1) {
        remaining.push(anim);
      } else {
        // Snap to final destination position & reset transformations
        anim.target.mesh.position.set(anim.endPos.x, 0, anim.endPos.z);
        anim.target.mesh.rotation.set(0, 0, 0);
        anim.target.mesh.scale.set(1, 1, 1);

        anim.target.shadowQuad.position.set(anim.endPos.x, 0.01, anim.endPos.z);
        anim.target.shadowQuad.scale.set(1, 1, 1);
        (anim.target.shadowQuad.material as THREE.MeshBasicMaterial).opacity = 0.45;

        if (
          anim.target.isCastle &&
          anim.target.rookMesh &&
          anim.target.rookShadowQuad &&
          anim.rookEndPos
        ) {
          anim.target.rookMesh.position.set(anim.rookEndPos.x, 0, anim.rookEndPos.z);
          anim.target.rookMesh.rotation.set(0, 0, 0);
          anim.target.rookShadowQuad.position.set(anim.rookEndPos.x, 0.01, anim.rookEndPos.z);
        }

        if (anim.target.impactRing) {
          anim.target.impactRing.visible = false;
        }

        if (anim.onComplete) {
          anim.onComplete();
        }
      }
    }

    this.activeAnims = remaining;
    return this.activeAnims.length > 0;
  }

  cancelAll() {
    for (const anim of this.activeAnims) {
      anim.target.mesh.position.set(anim.endPos.x, 0, anim.endPos.z);
      anim.target.mesh.rotation.set(0, 0, 0);
      anim.target.mesh.scale.set(1, 1, 1);

      anim.target.shadowQuad.position.set(anim.endPos.x, 0.01, anim.endPos.z);
      anim.target.shadowQuad.scale.set(1, 1, 1);
      (anim.target.shadowQuad.material as THREE.MeshBasicMaterial).opacity = 0.45;

      if (
        anim.target.isCastle &&
        anim.target.rookMesh &&
        anim.target.rookShadowQuad &&
        anim.rookEndPos
      ) {
        anim.target.rookMesh.position.set(anim.rookEndPos.x, 0, anim.rookEndPos.z);
        anim.target.rookMesh.rotation.set(0, 0, 0);
        anim.target.rookShadowQuad.position.set(anim.rookEndPos.x, 0.01, anim.rookEndPos.z);
      }

      if (anim.target.impactRing) {
        anim.target.impactRing.visible = false;
      }
    }
    this.activeAnims = [];
  }

  isAnimating(): boolean {
    return this.activeAnims.length > 0;
  }
}

