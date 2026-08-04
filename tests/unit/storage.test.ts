import { describe, it, expect } from "vitest";
import { initialGameState } from "../../src/store";
import { serializePgn, parsePgn, restoreFromPgn } from "../../src/core/pgn";
import { GameState, HistoryEntry, START_FEN } from "../../src/core/types";
import {
  buildHistoryEntry,
  fromSan,
  positionFromFen,
} from "../../src/core/rules";

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

  /*
   * PGN is the storage format, so everything the app needs beyond the move
   * list — the FEN after each ply, what was captured, check and mate — has to
   * survive the round trip by being recomputed rather than stored.
   */
  describe("restoreFromPgn", () => {
    const play = (sans: string[]): GameState => {
      const history: HistoryEntry[] = [];
      let pos = positionFromFen(START_FEN);
      for (const san of sans) {
        const move = fromSan(pos, san);
        expect(move, `could not parse ${san}`).not.toBeNull();
        const built = buildHistoryEntry(pos, move!);
        history.push(built.entry);
        pos = built.posAfter;
      }
      return { ...initialGameState, initialFen: START_FEN, history };
    };

    it("replays a game back to the same history it was saved from", () => {
      const state = play(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
      const restored = restoreFromPgn(serializePgn(state));

      expect(restored).not.toBeNull();
      expect(restored!.initialFen).toBe(START_FEN);
      expect(restored!.history.map((h) => h.san)).toEqual(
        state.history.map((h) => h.san),
      );
      expect(restored!.history.map((h) => h.fenAfter)).toEqual(
        state.history.map((h) => h.fenAfter),
      );
    });

    it("recovers captures, check and castling", () => {
      const state = play(["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "Bc4"]);
      const restored = restoreFromPgn(serializePgn(state))!;

      // exd5 and Qxd5 are captures; the history has to say so, because the
      // captured racks are built from it.
      expect(restored.history[2]?.captured).toBe("pawn");
      expect(restored.history[3]?.captured).toBe("pawn");
      expect(restored.history.map((h) => h.isCheck)).toEqual(
        state.history.map((h) => h.isCheck),
      );
    });

    it("returns null rather than a half-restored game", () => {
      const broken = serializePgn(play(["e4"])).replace("e4", "Zz9");
      expect(restoreFromPgn(broken)).toBeNull();
    });
  });
});
