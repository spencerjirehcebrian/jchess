import { describe, it, expect } from "vitest";
import "chessops/squareSet";
import "chessops/attacks";
import { Chess, fen } from "chessops";

describe("chessops integration", () => {
  it("initializes starting position and lists legal moves", () => {
    const setup = fen.parseFen(fen.INITIAL_FEN).unwrap();
    const pos = Chess.fromSetup(setup).unwrap();
    const dests = Array.from(pos.dests(12)); // e2
    expect(dests.length).toBeGreaterThan(0);
  });
});
