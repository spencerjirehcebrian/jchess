import { describe, it, expect } from "vitest";
import { FIXTURE_FENS } from "../fixtures/positions";
import {
  positionFromFen,
  legalMoves,
  positionAfter,
} from "../../src/core/rules";
import {
  premoveDestinations,
  generatePremoves,
  hypotheticalPosition,
} from "../../src/core/premove";
import { nameToSquare } from "../../src/core/types";

describe("premove module", () => {
  it("knight on d4 has 8 destinations; on a1 has 2", () => {
    const d4Pos = positionFromFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const d4Dest = premoveDestinations(d4Pos, nameToSquare("d4")!);
    expect(d4Dest.length).toBe(8);

    const a1Pos = positionFromFen("4k3/8/8/8/8/8/8/N3K3 w - - 0 1");
    const a1Dest = premoveDestinations(a1Pos, nameToSquare("a1")!);
    expect(a1Dest.length).toBe(2);
  });

  it("rook ray stops at own piece but continues past enemy piece", () => {
    const ownPos = positionFromFen("4k3/8/3P4/8/3R4/8/8/4K3 w - - 0 1");
    const ownDest = premoveDestinations(ownPos, nameToSquare("d4")!);
    expect(ownDest.includes(nameToSquare("d5")!)).toBe(true);
    expect(ownDest.includes(nameToSquare("d6")!)).toBe(false);
    expect(ownDest.includes(nameToSquare("d7")!)).toBe(false);

    const enemyPos = positionFromFen("4k3/8/3p4/8/3R4/8/8/4K3 w - - 0 1");
    const enemyDest = premoveDestinations(enemyPos, nameToSquare("d4")!);
    expect(enemyDest.includes(nameToSquare("d5")!)).toBe(true);
    expect(enemyDest.includes(nameToSquare("d6")!)).toBe(true);
    expect(enemyDest.includes(nameToSquare("d7")!)).toBe(true);
    expect(enemyDest.includes(nameToSquare("d8")!)).toBe(true);
  });

  it("pawn on e2 offers e3, e4, d3, f3", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const e2 = nameToSquare("e2")!;
    const dests = premoveDestinations(pos, e2);
    expect(dests.length).toBe(4);
    expect(dests).toContain(nameToSquare("e3")!);
    expect(dests).toContain(nameToSquare("e4")!);
    expect(dests).toContain(nameToSquare("d3")!);
    expect(dests).toContain(nameToSquare("f3")!);
  });

  it("pawn on e2 blocked by own piece on e3 still offers diagonals", () => {
    const pos = positionFromFen(
      "rnbqkbnr/pppppppp/8/8/8/4P3/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    const e2 = nameToSquare("e2")!;
    const dests = premoveDestinations(pos, e2);
    expect(dests).not.toContain(nameToSquare("e3")!);
    expect(dests).not.toContain(nameToSquare("e4")!);
    expect(dests).toContain(nameToSquare("d3")!);
    expect(dests).toContain(nameToSquare("f3")!);
  });

  it("pawn reaching last rank offers all four promotion choices per target square", () => {
    const pos = positionFromFen(FIXTURE_FENS.PROMOTION_PUSH);
    const e7 = nameToSquare("e7")!;
    const moves = generatePremoves(pos, e7);
    expect(moves.length).toBe(12); // e8, d8, f8 x 4 promos
  });

  it("king offers castling when castling rights exist even under attack", () => {
    const pos = positionFromFen(FIXTURE_FENS.CASTLE_THROUGH_CHECK);
    const e1 = nameToSquare("e1")!;
    const dests = premoveDestinations(pos, e1);
    expect(dests).toContain(nameToSquare("g1")!);
    expect(dests).toContain(nameToSquare("c1")!);
  });

  it("hypotheticalPosition applies queued premoves without passing the turn", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const e2 = nameToSquare("e2")!;
    const e4 = nameToSquare("e4")!;

    const after = hypotheticalPosition(pos, [{ from: e2, to: e4 }]);
    expect(after.board.get(e2)).toBeUndefined();
    expect(after.board.get(e4)?.role).toBe("pawn");
    expect(after.turn).toBe("white"); // unchanged: it is still the human's chain
    // The original position is untouched.
    expect(pos.board.get(e2)?.role).toBe("pawn");

    // A chained premove sees the vacated square.
    const d1 = nameToSquare("d1")!;
    const h5 = nameToSquare("h5")!;
    expect(premoveDestinations(after, d1)).toContain(h5);
    expect(premoveDestinations(pos, d1)).not.toContain(h5);
  });

  it("hypotheticalPosition moves the rook for a castling premove", () => {
    const pos = positionFromFen(FIXTURE_FENS.CASTLE_ALL_RIGHTS);
    const e1 = nameToSquare("e1")!;
    const g1 = nameToSquare("g1")!;
    const h1 = nameToSquare("h1")!;
    const f1 = nameToSquare("f1")!;

    const after = hypotheticalPosition(pos, [{ from: e1, to: g1 }]);
    expect(after.board.get(g1)?.role).toBe("king");
    expect(after.board.get(f1)?.role).toBe("rook");
    expect(after.board.get(h1)).toBeUndefined();
  });

  it("hypotheticalPosition promotes a queued promotion premove", () => {
    const pos = positionFromFen(FIXTURE_FENS.PROMOTION_PUSH);
    const e7 = nameToSquare("e7")!;
    const e8 = nameToSquare("e8")!;

    const after = hypotheticalPosition(pos, [
      { from: e7, to: e8, promotion: "knight" },
    ]);
    expect(after.board.get(e8)?.role).toBe("knight");
  });

  it("superset property test: legal moves after any legal opponent reply are in relaxed premove set", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const oppMoves = legalMoves(pos);

    for (const oppMove of oppMoves.slice(0, 5)) {
      const posAfterOpp = positionAfter(FIXTURE_FENS.START, [oppMove]);
      const myLegalMoves = legalMoves(posAfterOpp);

      for (const myMove of myLegalMoves) {
        const relaxedDests = premoveDestinations(pos, myMove.from);
        // Note: Castling moves in legalMoves may be normalized to 6 (g1) or 2 (c1)
        if (!relaxedDests.includes(myMove.to)) {
          // If castling, premoveDestinations includes g1 (6) or c1 (2)
          if (myMove.from === 4 && (myMove.to === 6 || myMove.to === 2))
            continue;
          expect(relaxedDests).toContain(myMove.to);
        }
      }
    }
  });
});
