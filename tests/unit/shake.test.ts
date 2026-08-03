import { describe, it, expect } from "vitest";
import { BoardPhysicsEngine } from "../../src/render/animation/shake";

describe("BoardPhysicsEngine unit tests", () => {
  it("calculates damped high frequency board shake on violent trigger", () => {
    const physics = new BoardPhysicsEngine();
    const now = 1000;

    physics.triggerShake(1.5, 300, now);

    const activeState = physics.update(now + 50);
    expect(activeState.isActive).toBe(true);
    expect(
      Math.abs(activeState.positionOffset.x) +
        Math.abs(activeState.positionOffset.y) +
        Math.abs(activeState.positionOffset.z),
    ).toBeGreaterThan(0);

    // After duration expires, shake resets
    const expiredState = physics.update(now + 400);
    expect(expiredState.positionOffset.x).toBe(0);
    expect(expiredState.positionOffset.y).toBe(0);
    expect(expiredState.positionOffset.z).toBe(0);
  });

  it("calculates dynamic movement pitch and roll tilt along motion vector", () => {
    const physics = new BoardPhysicsEngine();

    // Moving forward along +Z axis
    physics.setMoveTilt(0, 1, 0.5);

    const tiltState = physics.update(1000);
    expect(tiltState.rotationOffset.x).toBeLessThan(0); // Pitch down
    expect(tiltState.isActive).toBe(true);

    physics.resetTilt();
    const resetState = physics.update(1000);
    expect(resetState.rotationOffset.x).toBe(0);
  });

  it("simulates spring recoil dampening on landing impact", () => {
    const physics = new BoardPhysicsEngine();

    physics.triggerImpactRecoil(1, 0, 0.1);

    const recoil1 = physics.update(1000, 16.67);
    expect(recoil1.rotationOffset.z).not.toBe(0);

    // Step forward multiple frames until spring dampens rest
    for (let i = 0; i < 60; i++) {
      physics.update(1000 + i * 16.67, 16.67);
    }

    const settled = physics.update(2000, 16.67);
    expect(Math.abs(settled.rotationOffset.z)).toBeLessThan(0.001);
  });
});
