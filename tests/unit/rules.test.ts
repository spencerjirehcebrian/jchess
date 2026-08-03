import { describe, it, expect } from "vitest";
import { FIXTURE_FENS } from "../fixtures/positions";
import {
  positionFromFen,
  positionAfter,
  legalMoves,
  legalMovesFrom,
  toSan,
  fromSan,
  toUci,
  fromUci,
  toFen,
  outcome,
  isCheck,
  kingSquare,
  isInsufficientMaterial,
} from "../../src/core/rules";
import { nameToSquare, HistoryEntry } from "../../src/core/types";

describe("rules module", () => {
  it("parses START position and generates legal moves", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const moves = legalMoves(pos);
    expect(moves.length).toBe(20);
  });

  it("SAN round-trip for START position moves", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const moves = legalMoves(pos);
    for (const m of moves) {
      const sanStr = toSan(pos, m);
      const parsed = fromSan(pos, sanStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.from).toBe(m.from);
      expect(parsed?.to).toBe(m.to);
    }
  });

  it("UCI round-trip for moves including promotions", () => {
    const pos = positionFromFen(FIXTURE_FENS.PROMOTION_PUSH);
    const e7 = nameToSquare("e7")!;
    const e7Moves = legalMovesFrom(pos, e7);
    expect(e7Moves.length).toBe(4); // 4 promotions
    for (const m of e7Moves) {
      const uciStr = toUci(m);
      const parsed = fromUci(uciStr);
      expect(parsed).toEqual(m);
    }
  });

  it("handles UCI castling variants e1h1, e1g1, e1a1, e1c1", () => {
    const e1g1 = fromUci("e1g1");
    const e1h1 = fromUci("e1h1");
    expect(e1g1).toEqual({ from: 4, to: 6, promotion: undefined });
    expect(e1h1).toEqual({ from: 4, to: 6, promotion: undefined });

    const e1c1 = fromUci("e1c1");
    const e1a1 = fromUci("e1a1");
    expect(e1c1).toEqual({ from: 4, to: 2, promotion: undefined });
    expect(e1a1).toEqual({ from: 4, to: 2, promotion: undefined });
  });

  it("FEN round-trip for all 22 fixtures", () => {
    for (const [_, fenStr] of Object.entries(FIXTURE_FENS)) {
      const pos = positionFromFen(fenStr);
      const roundTripFen = toFen(pos);
      expect(roundTripFen).toBeTruthy();
    }
  });

  it("handles en passant capture availability and pin", () => {
    const epAvailable = positionFromFen(FIXTURE_FENS.EN_PASSANT_AVAILABLE);
    const epMoves = legalMoves(epAvailable);
    expect(epMoves.some((m) => m.from === 36 && m.to === 43)).toBe(true);

    const epPinned = positionFromFen(FIXTURE_FENS.EN_PASSANT_PINNED);
    const epPinnedMoves = legalMoves(epPinned);
    expect(epPinnedMoves.some((m) => m.from === 28 && m.to === 43)).toBe(false);
  });

  it("handles castling rights and through-check restriction", () => {
    const allRights = positionFromFen(FIXTURE_FENS.CASTLE_ALL_RIGHTS);
    const allRightsMoves = legalMoves(allRights);
    expect(allRightsMoves.some((m) => m.from === 4 && m.to === 6)).toBe(true);
    expect(allRightsMoves.some((m) => m.from === 4 && m.to === 2)).toBe(true);

    const throughCheck = positionFromFen(FIXTURE_FENS.CASTLE_THROUGH_CHECK);
    const throughCheckMoves = legalMoves(throughCheck);
    expect(throughCheckMoves.some((m) => m.from === 4 && m.to === 6)).toBe(
      false,
    );
  });

  it("detects terminal position outcomes (checkmate, stalemate, insufficient material)", () => {
    const matePosAfter = positionFromFen(
      "3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1",
    );
    const res = outcome(matePosAfter, []);
    expect(res).toEqual({ winner: "white", reason: "checkmate" });

    const stalePos = positionFromFen(FIXTURE_FENS.STALEMATE);
    const staleRes = outcome(stalePos, []);
    expect(staleRes).toEqual({ winner: null, reason: "stalemate" });

    const insuffPos = positionFromFen(FIXTURE_FENS.INSUFFICIENT_KN_K);
    const insuffRes = outcome(insuffPos, []);
    expect(insuffRes).toEqual({
      winner: null,
      reason: "insufficient-material",
    });
  });

  it("detects threefold repetition correctly on 3rd occurrence only", () => {
    const startFen = FIXTURE_FENS.START;
    let pos = positionFromFen(startFen);

    // Move sequence: 1. Nf3 Nf6 2. Ng1 Ng8 (repetition 2) 3. Nf3 Nf6 4. Ng1 Ng8 (repetition 3)
    const m1 = { from: nameToSquare("g1")!, to: nameToSquare("f3")! };
    const m2 = { from: nameToSquare("g8")!, to: nameToSquare("f6")! };
    const m3 = { from: nameToSquare("f3")!, to: nameToSquare("g1")! };
    const m4 = { from: nameToSquare("f6")!, to: nameToSquare("g8")! };

    const moves = [m1, m2, m3, m4, m1, m2, m3, m4];
    const history: HistoryEntry[] = [];

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]!;
      pos = positionAfter(startFen, moves.slice(0, i + 1));
      history.push({
        move: m,
        san: toSan(pos, m),
        fenAfter: toFen(pos),
        isCheck: false,
        isMate: false,
      });

      const res = outcome(pos, history, startFen);
      if (i < 7) {
        expect(res).toBeNull(); // Not draw yet before 3rd repetition completes!
      } else {
        expect(res).toEqual({ winner: null, reason: "threefold" });
      }
    }
  });

  it("detects 50-move rule draw when halfmoves >= 100", () => {
    const pos = positionFromFen("8/8/8/4k3/8/4K3/4P3/8 w - - 100 50");
    const res = outcome(pos, []);
    expect(res).toEqual({ winner: null, reason: "fifty-move" });
  });

  it("evaluates insufficient material for K vs K and same-color bishops", () => {
    const kvsK = positionFromFen("8/8/8/4k3/8/4K3/8/8 w - - 0 1");
    expect(isInsufficientMaterial(kvsK)).toBe(true);

    const kbvsKb = positionFromFen(FIXTURE_FENS.INSUFFICIENT_KB_KB_SAME);
    expect(isInsufficientMaterial(kbvsKb)).toBe(true);
  });

  it("identifies king square and check state", () => {
    const pos = positionFromFen(FIXTURE_FENS.DOUBLE_CHECK);
    expect(isCheck(pos)).toBe(true);
    expect(kingSquare(pos, "white")).toBe(4); // e1
  });
});
