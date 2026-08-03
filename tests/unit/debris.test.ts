import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { VoxelDebrisManager } from "../../src/render/animation/debris";
import { THEMES } from "../../src/render/voxel/palette";

describe("VoxelDebrisManager unit tests", () => {
  it("spawns shatter debris and spark particles on explosion", () => {
    const manager = new VoxelDebrisManager();
    expect(manager.group.children.length).toBe(0);

    const pos = new THREE.Vector3(1, 0, 1);
    const palette = THEMES.oxide!.white;

    manager.spawnExplosion(pos, palette, "queen", 25);
    expect(manager.group.children.length).toBeGreaterThanOrEqual(25);
  });

  it("updates particle positions, gravity, decay and removes expired particles", () => {
    const manager = new VoxelDebrisManager();
    const pos = new THREE.Vector3(0, 0, 0);
    const palette = THEMES.oxide!.black;

    manager.spawnExplosion(pos, palette, "pawn", 20);
    const initialCount = manager.group.children.length;

    manager.update(0.1);
    expect(manager.group.children.length).toBe(initialCount);

    // Update past max lifespan (1.0 sec)
    manager.update(1.2);
    expect(manager.group.children.length).toBe(0);
  });

  it("clears all active debris particles when requested", () => {
    const manager = new VoxelDebrisManager();
    manager.spawnExplosion(new THREE.Vector3(0, 0, 0), THEMES.oxide!.white, "knight", 15);
    expect(manager.group.children.length).toBeGreaterThan(0);

    manager.clear();
    expect(manager.group.children.length).toBe(0);
  });
});
