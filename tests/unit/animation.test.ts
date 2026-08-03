import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { AnimationEngine } from "../../src/render/animation/engine";

describe("AnimationEngine unit tests", () => {
  it("updates position over duration and completes animation", () => {
    const engine = new AnimationEngine();
    const mesh = new THREE.Mesh();
    const shadowQuad = new THREE.Mesh();

    const startT = performance.now();
    engine.animateMove(
      {
        mesh,
        shadowQuad,
        fromSquare: 12, // e2
        toSquare: 28, // e4
        durationMs: 200,
      },
      false,
    );

    expect(engine.isAnimating()).toBe(true);

    // Midpoint update (t=0.5)
    engine.update(startT + 100);
    expect(mesh.position.y).toBeGreaterThan(0.4); // Lifted parabolic arc

    // Completion update (t=1.0)
    engine.update(startT + 250);
    expect(mesh.position.y).toBe(0);

    // Step physics forward until spring recoil settles
    for (let t = startT + 250; t <= startT + 1000; t += 50) {
      engine.update(t);
    }
    expect(engine.isAnimating()).toBe(false);
  });

  it("handles knight high-arc hopping", () => {
    const engine = new AnimationEngine();
    const mesh = new THREE.Mesh();
    const shadowQuad = new THREE.Mesh();

    const startT = performance.now();
    engine.animateMove(
      {
        mesh,
        shadowQuad,
        fromSquare: 1, // b1
        toSquare: 18, // c3
        durationMs: 200,
        isKnight: true,
      },
      false,
    );

    // Midpoint update (t=0.5)
    engine.update(startT + 100);
    expect(mesh.position.y).toBeGreaterThan(0.6); // Knight high arc (~0.65)
  });

  it("handles capture impact tumble, sink, and impact ring", () => {
    const engine = new AnimationEngine();
    const mesh = new THREE.Mesh();
    const shadowQuad = new THREE.Mesh();
    const capturedMesh = new THREE.Mesh();
    const capturedShadowQuad = new THREE.Mesh();
    const impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.45, 16),
      new THREE.MeshBasicMaterial(),
    );

    let onCompleteCalled = false;
    const startT = performance.now();

    engine.animateMove(
      {
        mesh,
        shadowQuad,
        fromSquare: 28, // e4
        toSquare: 35, // d5
        durationMs: 200,
        isCapture: true,
        capturedMesh,
        capturedShadowQuad,
        impactRing,
      },
      false,
      () => {
        onCompleteCalled = true;
      },
    );

    // After impact moment (t=0.5 -> rawT=0.5)
    engine.update(startT + 100);
    expect(capturedMesh.position.y).toBeLessThan(0); // Sinks into board
    expect(impactRing.visible).toBe(true);

    // Complete
    engine.update(startT + 250);
    expect(onCompleteCalled).toBe(true);
    expect(impactRing.visible).toBe(false);
  });

  it("handles castling dual piece animation", () => {
    const engine = new AnimationEngine();
    const kingMesh = new THREE.Mesh();
    const kingShadow = new THREE.Mesh();
    const rookMesh = new THREE.Mesh();
    const rookShadow = new THREE.Mesh();

    const startT = performance.now();
    engine.animateMove(
      {
        mesh: kingMesh,
        shadowQuad: kingShadow,
        fromSquare: 4, // e1
        toSquare: 6, // g1
        durationMs: 200,
        isCastle: true,
        rookMesh,
        rookShadowQuad: rookShadow,
        rookFromSquare: 7, // h1
        rookToSquare: 5, // f1
      },
      false,
    );

    // Midpoint update
    engine.update(startT + 100);
    expect(kingMesh.position.x).not.toBe(0);
    expect(rookMesh.position.x).not.toBe(0);

    // Completion & physics settlement
    for (let t = startT + 250; t <= startT + 1000; t += 50) {
      engine.update(t);
    }
    expect(engine.isAnimating()).toBe(false);
  });

  it("immediately cancels active animations", () => {
    const engine = new AnimationEngine();
    const mesh = new THREE.Mesh();
    const shadowQuad = new THREE.Mesh();

    engine.animateMove(
      {
        mesh,
        shadowQuad,
        fromSquare: 12,
        toSquare: 28,
        durationMs: 200,
      },
      false,
    );

    expect(engine.isAnimating()).toBe(true);
    engine.cancelAll();
    expect(engine.isAnimating()).toBe(false);
  });
});
