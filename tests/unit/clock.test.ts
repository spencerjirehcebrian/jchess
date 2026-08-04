import { describe, it, expect } from "vitest";
import {
  createClock,
  flaggedColor,
  remainingFor,
  stopClock,
  switchTurn,
  timeControlById,
} from "../../src/core/clock";

const THREE_PLUS_TWO = timeControlById("3+2");
const FIVE_FLAT = timeControlById("5+0");

describe("clock", () => {
  it("has no clock at all when the time control is off", () => {
    expect(createClock(timeControlById("off"), "white", 0)).toBeUndefined();
  });

  it("derives remaining time from elapsed rather than decrementing", () => {
    const clock = createClock(FIVE_FLAT, "white", 1000)!;

    // Ten seconds later, only the side to move has spent anything.
    expect(remainingFor(clock, "white", 11_000)).toBe(290_000);
    expect(remainingFor(clock, "black", 11_000)).toBe(300_000);

    // Reading again at the same instant gives the same answer — nothing was
    // consumed by the act of looking.
    expect(remainingFor(clock, "white", 11_000)).toBe(290_000);
  });

  it("applies the increment on move completion, not move start", () => {
    const clock = createClock(THREE_PLUS_TWO, "white", 0)!;

    // White thinks for 10s, then moves: 180 - 10 + 2.
    const afterWhite = switchTurn(clock, 10_000);
    expect(afterWhite.remaining.white).toBe(172_000);
    expect(afterWhite.runningFor).toBe("black");

    // Black is now on the clock and has not been credited anything yet.
    expect(afterWhite.remaining.black).toBe(180_000);
    expect(remainingFor(afterWhite, "black", 15_000)).toBe(175_000);

    const afterBlack = switchTurn(afterWhite, 20_000);
    expect(afterBlack.remaining.black).toBe(172_000);
    expect(afterBlack.runningFor).toBe("white");

    // White's banked time is untouched while it is not their turn.
    expect(afterBlack.remaining.white).toBe(172_000);
  });

  it("flags only the side to move, and only once they are out", () => {
    const clock = createClock(FIVE_FLAT, "white", 0)!;

    expect(flaggedColor(clock, 299_999)).toBeNull();
    expect(flaggedColor(clock, 300_000)).toBe("white");

    // Black sitting on a full clock never flags, however long white takes.
    expect(remainingFor(clock, "black", 999_999)).toBe(300_000);
  });

  it("does not credit an increment to a player who already ran out", () => {
    const clock = createClock(THREE_PLUS_TWO, "white", 0)!;
    const afterFlag = switchTurn(clock, 400_000);
    expect(afterFlag.remaining.white).toBe(0);
  });

  it("freezes where it stands when the game ends", () => {
    const clock = createClock(FIVE_FLAT, "white", 0)!;
    const stopped = stopClock(clock, 30_000);

    expect(stopped.runningFor).toBeNull();
    expect(stopped.remaining.white).toBe(270_000);
    // And it stays there however much later it is read.
    expect(remainingFor(stopped, "white", 999_999)).toBe(270_000);
  });
});
