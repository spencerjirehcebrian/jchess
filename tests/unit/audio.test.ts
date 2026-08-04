import { describe, it, expect } from "vitest";
import { AudioEngine } from "../../src/audio";

describe("AudioEngine unit tests", () => {
  it("instantiates and toggles volume/mute without error", () => {
    const audio = new AudioEngine();
    expect(audio).toBeDefined();

    audio.setMuted(true);
    audio.setVolume(0.5);
    audio.setMuted(false);
  });

  it("handles sound play requests safely in head-less environment", () => {
    const audio = new AudioEngine();
    expect(() => {
      audio.playSound("move");
      audio.playSound("capture");
      audio.playSound("check");
      audio.playSound("premove");
      audio.playSound("illegal");
      audio.playSound("tenseconds");
      audio.playSound("victory");
      audio.playSound("defeat");
      audio.playSound("draw");
    }).not.toThrow();
  });
});
