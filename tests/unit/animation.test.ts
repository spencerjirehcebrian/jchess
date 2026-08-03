import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { AnimationEngine } from '../../src/render/animation/engine'

describe('AnimationEngine unit tests', () => {
  it('updates position over duration and completes animation', () => {
    const engine = new AnimationEngine()
    const mesh = new THREE.Mesh()
    const shadowQuad = new THREE.Mesh()

    engine.animateMove(
      {
        mesh,
        shadowQuad,
        fromSquare: 12, // e2
        toSquare: 28, // e4
        durationMs: 200
      },
      false
    )

    expect(engine.isAnimating()).toBe(true)

    // Midpoint update (t=0.5)
    engine.update(performance.now() + 100)
    expect(mesh.position.y).toBeGreaterThan(0.4) // Lifted parabolic arc

    // Completion update (t=1.0)
    engine.update(performance.now() + 300)
    expect(engine.isAnimating()).toBe(false)
    expect(mesh.position.y).toBe(0)
  })

  it('immediately cancels active animations', () => {
    const engine = new AnimationEngine()
    const mesh = new THREE.Mesh()
    const shadowQuad = new THREE.Mesh()

    engine.animateMove(
      {
        mesh,
        shadowQuad,
        fromSquare: 12,
        toSquare: 28,
        durationMs: 200
      },
      false
    )

    expect(engine.isAnimating()).toBe(true)
    engine.cancelAll()
    expect(engine.isAnimating()).toBe(false)
  })
})
