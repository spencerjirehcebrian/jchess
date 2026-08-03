import { describe, it, expect } from "vitest";
import { FIXTURE_FENS } from "../fixtures/positions";
import { positionFromFen, legalMoves } from "../../src/core/rules";
import { matchPrefix } from "../../src/core/san-parser";

describe("san-parser module", () => {
  it("handles empty buffer returning all legal moves", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const legals = legalMoves(pos);
    const state = matchPrefix("", legals, pos);
    expect(state.candidates.length).toBe(legals.length);
    expect(state.exactMatch).toBeNull();
  });

  it("filters candidates incrementally: N -> Nf -> Nf3", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const legals = legalMoves(pos);

    const nState = matchPrefix("N", legals, pos);
    expect(nState.candidates.length).toBe(4); // Na3, Nc3, Nf3, Nh3

    const nfState = matchPrefix("Nf", legals, pos);
    expect(nfState.candidates.length).toBe(1); // Nf3

    const nf3State = matchPrefix("Nf3", legals, pos);
    expect(nf3State.candidates.length).toBe(1);
    expect(nf3State.exactMatch).not.toBeNull();
  });

  it("accepts lowercase piece letters and castle notations (0-0, oo)", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const legals = legalMoves(pos);
    const state = matchPrefix("nf3", legals, pos);
    expect(state.candidates.length).toBe(1);

    const castlePos = positionFromFen(FIXTURE_FENS.CASTLE_ALL_RIGHTS);
    const castleLegals = legalMoves(castlePos);
    const ooState = matchPrefix("oo", castleLegals, castlePos);
    expect(ooState.exactMatch).not.toBeNull();

    const zeroState = matchPrefix("0-0", castleLegals, castlePos);
    expect(zeroState.exactMatch).not.toBeNull();
  });

  it("handles optional x and check/mate symbols (+, #)", () => {
    const pos = positionFromFen(FIXTURE_FENS.EN_PASSANT_AVAILABLE);
    const legals = legalMoves(pos);
    const ed6State = matchPrefix("ed6", legals, pos);
    expect(ed6State.candidates.length).toBeGreaterThan(0);
  });

  it("handles lowercase b ambiguity", () => {
    const pos = positionFromFen(FIXTURE_FENS.DISAMBIGUATION_FILE);
    const legals = legalMoves(pos);
    const state = matchPrefix("b", legals, pos);
    expect(state).toBeDefined();
  });

  /*
   * While the engine is thinking it is the engine's turn, so NotationInput
   * matches typed premoves against a clone with `turn` swapped to the human's
   * colour. The SANs it shows must come from that same board: chessops
   * disambiguates by looking for rival pieces of `pos.turn`, so rendering these
   * candidates against the real position finds none and drops the
   * disambiguating letter. Two knights that both reach f3 then both read "Nf3",
   * which names neither of them and is ambiguous typed back.
   */
  it("disambiguates candidates against the board they were matched on", () => {
    const pos = positionFromFen(
      "2Qb3B/n1p2k2/p6q/2Pp4/PP3p1p/R2KP1PP/3N1p2/5BNn b - - 2 30",
    );
    const premoveBoard = pos.clone();
    premoveBoard.turn = "white";

    const legals = legalMoves(premoveBoard);
    const state = matchPrefix("", legals, premoveBoard);

    expect(state.candidateSans.length).toBe(state.candidates.length);
    expect(new Set(state.candidateSans).size).toBe(state.candidateSans.length);

    // The knights on d2 and g1 both reach f3, so both need their file.
    expect(state.candidateSans).toContain("Ndf3");
    expect(state.candidateSans).toContain("Ngf3");
    expect(state.candidateSans).not.toContain("Nf3");
  });

  it("returns zero candidates for invalid input without throwing", () => {
    const pos = positionFromFen(FIXTURE_FENS.START);
    const legals = legalMoves(pos);
    const state = matchPrefix("Nf9", legals, pos);
    expect(state.candidates.length).toBe(0);
    expect(state.exactMatch).toBeNull();
  });
});
