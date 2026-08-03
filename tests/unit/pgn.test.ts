import { describe, it, expect } from "vitest";
import { serializePgn, parsePgn, formatResult } from "../../src/core/pgn";
import { initialGameState } from "../../src/store";
import { GameState } from "../../src/core/types";

describe("PGN serialization and parsing unit tests", () => {
  it("formats game results correctly", () => {
    expect(formatResult(null)).toBe("*");
    expect(formatResult({ winner: "white", reason: "checkmate" })).toBe("1-0");
    expect(formatResult({ winner: "black", reason: "timeout" })).toBe("0-1");
    expect(formatResult({ winner: null, reason: "stalemate" })).toBe("1/2-1/2");
  });

  it("serializes standard initial position state into PGN", () => {
    const pgn = serializePgn(initialGameState);
    expect(pgn).toContain('[Event "jchess"]');
    expect(pgn).toContain('[White "Player"]');
    expect(pgn).toContain('[Black "Stockfish (Level 2)"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).not.toContain("[FEN");
  });

  it("serializes game with non-standard FEN and moves", () => {
    const customFen =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const state: GameState = {
      ...initialGameState,
      initialFen: customFen,
      history: [
        {
          move: { from: 52, to: 36 },
          san: "e5",
          fenAfter:
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
          isCheck: false,
          isMate: false,
        },
      ],
      status: {
        kind: "over",
        result: { winner: "white", reason: "checkmate" },
      },
    };

    const pgn = serializePgn(state);
    expect(pgn).toContain(`[FEN "${customFen}"]`);
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain("1. e5 1-0");
  });

  it("parses PGN text into tags and moves", () => {
    const pgnText = `
[Event "FIDE World Championship"]
[Site "London ENG"]
[Date "2018.11.09"]
[White "Carlsen, Magnus"]
[Black "Caruana, Fabiano"]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1/2-1/2
`;
    const parsed = parsePgn(pgnText);
    expect(parsed.tags["Event"]).toBe("FIDE World Championship");
    expect(parsed.tags["White"]).toBe("Carlsen, Magnus");
    expect(parsed.moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });
});
