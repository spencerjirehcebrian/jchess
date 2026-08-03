import * as THREE from "three";

export class BoardPhysicsEngine {
  private shakeIntensity = 0;
  private shakeDurationMs = 0;
  private shakeStartTime = 0;

  private tiltPitch = 0; // Rot X
  private tiltRoll = 0; // Rot Z

  private recoilPitch = 0;
  private recoilRoll = 0;
  private recoilVelPitch = 0;
  private recoilVelRoll = 0;

  // Result of the most recent step, so readers do not have to re-integrate.
  private lastPositionOffset = new THREE.Vector3(0, 0, 0);
  private lastRotationOffset = new THREE.Euler(0, 0, 0, "XYZ");
  private lastIsActive = false;

  triggerShake(intensity: number, durationMs: number, now = performance.now()) {
    this.shakeIntensity = intensity;
    this.shakeDurationMs = durationMs;
    this.shakeStartTime = now;
  }

  triggerImpactRecoil(dirX: number, dirZ: number, magnitude = 0.08) {
    // Punch impulse in direction of motion vector on landing
    this.recoilVelPitch += -dirZ * magnitude;
    this.recoilVelRoll += dirX * magnitude;
  }

  setMoveTilt(dirX: number, dirZ: number, rawT: number) {
    // Dynamic tilt during flight (parabolic envelope)
    const envelope = Math.sin(Math.PI * Math.min(1, Math.max(0, rawT)));
    const maxTiltAngle = 0.06; // ~3.5 degrees max board tilt
    this.tiltPitch = -dirZ * maxTiltAngle * envelope;
    this.tiltRoll = dirX * maxTiltAngle * envelope;
  }

  resetTilt() {
    this.tiltPitch = 0;
    this.tiltRoll = 0;
  }

  /**
   * The transform produced by the last {@link update}. Pure — call this to read
   * the current offsets instead of stepping the simulation again.
   */
  getTransform(): {
    positionOffset: THREE.Vector3;
    rotationOffset: THREE.Euler;
    isActive: boolean;
  } {
    return {
      positionOffset: this.lastPositionOffset,
      rotationOffset: this.lastRotationOffset,
      isActive: this.lastIsActive,
    };
  }

  /** Pure activity query; does not advance the spring or reroll shake noise. */
  isActive(): boolean {
    return this.lastIsActive;
  }

  /** Advances the simulation by `dtMs` and returns the resulting transform. */
  update(
    now = performance.now(),
    dtMs = 16.67,
  ): {
    positionOffset: THREE.Vector3;
    rotationOffset: THREE.Euler;
    isActive: boolean;
  } {
    const posOffset = new THREE.Vector3(0, 0, 0);
    const rotOffset = new THREE.Euler(0, 0, 0, "XYZ");

    let isShaking = false;

    // 1. Calculate Damped Board Shake
    if (this.shakeIntensity > 0 && this.shakeDurationMs > 0) {
      const elapsed = now - this.shakeStartTime;
      if (elapsed < this.shakeDurationMs) {
        isShaking = true;
        const progress = elapsed / this.shakeDurationMs;
        // Exponential decay envelope
        const decay = Math.pow(1 - progress, 2) * this.shakeIntensity;

        // High frequency noise / sine oscillations
        const freq = elapsed * 0.08;
        posOffset.x = (Math.sin(freq * 1.3) + (Math.random() - 0.5) * 0.8) * 0.12 * decay;
        posOffset.y = (Math.cos(freq * 1.7) + (Math.random() - 0.5) * 0.8) * 0.14 * decay;
        posOffset.z = (Math.sin(freq * 1.5) + (Math.random() - 0.5) * 0.8) * 0.12 * decay;

        rotOffset.x = Math.sin(freq * 1.1) * 0.04 * decay;
        rotOffset.z = Math.cos(freq * 1.4) * 0.04 * decay;
      } else {
        this.shakeIntensity = 0;
      }
    }

    // 2. Spring Physics Recoil Update
    const dt = Math.min(0.05, dtMs / 1000);
    const springStiffness = 180.0;
    const damping = 14.0;

    const forcePitch = -springStiffness * this.recoilPitch - damping * this.recoilVelPitch;
    this.recoilVelPitch += forcePitch * dt;
    this.recoilPitch += this.recoilVelPitch * dt;

    const forceRoll = -springStiffness * this.recoilRoll - damping * this.recoilVelRoll;
    this.recoilVelRoll += forceRoll * dt;
    this.recoilRoll += this.recoilVelRoll * dt;

    const hasRecoil =
      Math.abs(this.recoilPitch) > 0.0005 ||
      Math.abs(this.recoilVelPitch) > 0.0005 ||
      Math.abs(this.recoilRoll) > 0.0005 ||
      Math.abs(this.recoilVelRoll) > 0.0005;

    // Combine Rotations (Tilt + Recoil + Shake)
    rotOffset.x += this.tiltPitch + this.recoilPitch;
    rotOffset.z += this.tiltRoll + this.recoilRoll;

    const isActive = isShaking || hasRecoil || Math.abs(this.tiltPitch) > 0.001 || Math.abs(this.tiltRoll) > 0.001;

    this.lastPositionOffset = posOffset;
    this.lastRotationOffset = rotOffset;
    this.lastIsActive = isActive;

    return {
      positionOffset: posOffset,
      rotationOffset: rotOffset,
      isActive,
    };
  }
}
