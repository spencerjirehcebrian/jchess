import * as THREE from 'three'
import { Square } from '../../core/types'
import { squareToWorld } from '../picking'

export interface PieceAnimTarget {
  mesh: THREE.Mesh
  shadowQuad: THREE.Mesh
  fromSquare: Square
  toSquare: Square
  durationMs: number
  isCapture?: boolean
  capturedMesh?: THREE.Mesh
  capturedShadowQuad?: THREE.Mesh
}

export class AnimationEngine {
  private activeAnims: {
    target: PieceAnimTarget
    startPos: THREE.Vector3
    endPos: THREE.Vector3
    startTime: number
    durationMs: number
    onComplete?: (() => void) | undefined
  }[] = []

  animateMove(
    target: PieceAnimTarget,
    boardFlipped: boolean,
    onComplete?: () => void
  ) {
    const startPos = squareToWorld(target.fromSquare, boardFlipped)
    const endPos = squareToWorld(target.toSquare, boardFlipped)

    this.activeAnims.push({
      target,
      startPos,
      endPos,
      startTime: performance.now(),
      durationMs: target.durationMs,
      onComplete
    })
  }

  update(now = performance.now()): boolean {
    if (this.activeAnims.length === 0) return false

    const remaining: typeof this.activeAnims = []

    for (const anim of this.activeAnims) {
      const elapsed = now - anim.startTime
      const rawT = Math.min(1, Math.max(0, elapsed / anim.durationMs))

      // Cubic ease-out: 1 - (1 - t)^3
      const t = 1 - Math.pow(1 - rawT, 3)

      // Linear XZ interpolate
      const currentX = anim.startPos.x + (anim.endPos.x - anim.startPos.x) * t
      const currentZ = anim.startPos.z + (anim.endPos.z - anim.startPos.z) * t

      // Parabolic arc for Y lift: peak lift = 0.5 world units at mid-flight
      const arcY = Math.sin(Math.PI * rawT) * 0.5

      anim.target.mesh.position.set(currentX, arcY, currentZ)
      anim.target.shadowQuad.position.set(currentX, 0.01, currentZ)

      // Handle captured piece drop through floor
      if (anim.target.isCapture && anim.target.capturedMesh) {
        const capY = -rawT * 1.5
        anim.target.capturedMesh.position.y = capY
        if (anim.target.capturedShadowQuad) {
          anim.target.capturedShadowQuad.position.y = capY
        }
      }

      if (rawT < 1) {
        remaining.push(anim)
      } else {
        // Snap to final destination position
        anim.target.mesh.position.set(anim.endPos.x, 0, anim.endPos.z)
        anim.target.shadowQuad.position.set(anim.endPos.x, 0.01, anim.endPos.z)
        if (anim.onComplete) {
          anim.onComplete()
        }
      }
    }

    this.activeAnims = remaining
    return this.activeAnims.length > 0
  }

  cancelAll() {
    for (const anim of this.activeAnims) {
      anim.target.mesh.position.set(anim.endPos.x, 0, anim.endPos.z)
      anim.target.shadowQuad.position.set(anim.endPos.x, 0.01, anim.endPos.z)
    }
    this.activeAnims = []
  }

  isAnimating(): boolean {
    return this.activeAnims.length > 0
  }
}
