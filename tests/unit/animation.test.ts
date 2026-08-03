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

  /*
   * A move the player made by hand does not fly — the drag already showed the
   * travel. It falls the last stretch from where it was let go and lands
   * normally, because the landing is a consequence of hitting the board rather
   * than information about the move.
   */
  describe("arrival mode", () => {
    it("falls from the held height and is down by the impact moment", () => {
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
          arrival: {
            startWorld: new THREE.Vector3(0.2, 0, -0.3),
            startY: 0.6,
          },
        },
        false,
      );

      // Early in the fall it is still clearly in the air, and below where it
      // was held — it descends rather than arcing up like a flown piece.
      engine.update(startT + 20);
      expect(mesh.position.y).toBeGreaterThan(0);
      expect(mesh.position.y).toBeLessThan(0.6);

      // impactT is 0.3 of the duration, so it is on the board by 60ms.
      engine.update(startT + 62);
      expect(mesh.position.y).toBeCloseTo(0, 2);

      // And it stays down while the rest of the animation plays out.
      engine.update(startT + 120);
      expect(mesh.position.y).toBeCloseTo(0, 2);
    });

    it("settles the drag's swing out instead of snapping upright", () => {
      const engine = new AnimationEngine();
      const mesh = new THREE.Mesh();
      const shadowQuad = new THREE.Mesh();

      const startT = performance.now();
      engine.animateMove(
        {
          mesh,
          shadowQuad,
          fromSquare: 12,
          toSquare: 28,
          durationMs: 200,
          arrival: {
            startWorld: new THREE.Vector3(0, 0, 0),
            startY: 0.6,
            startTilt: { x: 0.2, z: -0.3 },
          },
        },
        false,
      );

      engine.update(startT + 20);
      expect(Math.abs(mesh.rotation.z)).toBeGreaterThan(0);

      engine.update(startT + 62);
      expect(mesh.rotation.x).toBeCloseTo(0, 2);
      expect(mesh.rotation.z).toBeCloseTo(0, 2);
    });

    it("still shatters the piece it landed on", () => {
      const engine = new AnimationEngine();
      const mesh = new THREE.Mesh();
      const shadowQuad = new THREE.Mesh();
      const capturedMesh = new THREE.Mesh();
      const capturedShadowQuad = new THREE.Mesh();

      let onCompleteCalled = false;
      const startT = performance.now();

      engine.animateMove(
        {
          mesh,
          shadowQuad,
          fromSquare: 28,
          toSquare: 35,
          durationMs: 300,
          isCapture: true,
          capturedMesh,
          capturedShadowQuad,
          arrival: {
            startWorld: new THREE.Vector3(0.1, 0, 0.1),
            startY: 0.6,
          },
        },
        false,
        () => {
          onCompleteCalled = true;
        },
      );

      // Nothing has been hit yet on the way down.
      engine.update(startT + 20);
      expect(capturedMesh.position.y).toBe(0);

      // Past impact (0.3 x 300ms = 90ms) the victim is falling apart and the
      // board has been shaken — a dragged capture is not a silent one.
      engine.update(startT + 120);
      expect(capturedMesh.position.y).toBeLessThan(0);
      expect(engine.physicsEngine.isActive()).toBe(true);

      engine.update(startT + 320);
      expect(onCompleteCalled).toBe(true);
    });

    /*
     * A refused drop is the hand putting a piece back. It falls and squashes
     * like anything else with weight, but the board must not react — a shake
     * says "a move was made", and declining one is not making one. The shake is
     * the only thing that displaces the board, so its absence is visible as a
     * zero position offset.
     */
    it("does not shake the board when the piece is only being put back", () => {
      const shakeAfterLanding = (isReturn: boolean) => {
        const engine = new AnimationEngine();
        const startT = performance.now();

        engine.animateMove(
          {
            mesh: new THREE.Mesh(),
            shadowQuad: new THREE.Mesh(),
            fromSquare: 12, // e2
            toSquare: 12, // back where it came from
            durationMs: 200,
            isReturn,
            arrival: {
              startWorld: new THREE.Vector3(0.2, 0, -0.3),
              startY: 0.6,
            },
          },
          false,
        );

        // Past impactT (0.3 x 200ms = 60ms), so the landing has fired.
        engine.update(startT + 80);
        return engine.physicsEngine.getTransform().positionOffset.length();
      };

      expect(shakeAfterLanding(true)).toBe(0);
      expect(shakeAfterLanding(false)).toBeGreaterThan(0);
    });
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
