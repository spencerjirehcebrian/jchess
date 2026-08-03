import { describe, it, expect } from "vitest";
import { getConfig } from "../../src/config";

describe("Scaffold", () => {
  it("loads default runtime config", () => {
    const config = getConfig();
    expect(config.defaultDifficulty).toBe(2);
    expect(config.maxPremoves).toBe(3);
    expect(config.enableClocks).toBe(false);
  });
});
