import { describe, it, expect } from "vitest";
import { initialGameState } from "../../src/store";
import { serializePgn, parsePgn } from "../../src/core/pgn";

describe("Storage and PGN serialization unit tests", () => {
  it("serializes starting position to valid PGN", () => {
    const pgn = serializePgn(initialGameState);
    expect(pgn).toContain('[Event "jchess"]');
    expect(pgn).toContain('[Result "*"]');
  });

  it("parses exported PGN correctly", () => {
    const pgn = serializePgn(initialGameState);
    const parsed = parsePgn(pgn);
    expect(parsed.tags["Event"]).toBe("jchess");
    expect(parsed.moves.length).toBe(0);
  });
});
