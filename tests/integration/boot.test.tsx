import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { StoredGame } from "../../src/storage";

/*
 * What the machine does when it is switched on.
 *
 * There used to be a question here — a dialog offering to put the last game
 * back — and the answer was almost always yes, so it is not asked any more.
 * An unfinished game simply resumes; anything else lands on the setup panel.
 *
 * The storage layer is mocked because the test environment has no IndexedDB
 * at all, which would make every one of these cases indistinguishable from
 * "nothing stored".
 */

let stored: StoredGame | null = null;

vi.mock("../../src/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/storage")>();
  return {
    ...actual,
    loadResumableGame: () => Promise.resolve(stored),
    saveGame: () => {},
  };
});

// A stand-in engine that comes up cleanly and then thinks forever. The real
// one wants a worker, and what matters here is only that the handshake
// resolves — that is one of the two answers the boot decision waits for.
vi.mock("../../src/engine/stockfish", () => ({
  createStockfishEngine: () => ({
    init: () => Promise.resolve(),
    search: () => new Promise(() => {}),
    setOptions: () => Promise.resolve(),
    stop: () => {},
    dispose: () => {},
  }),
}));

const { useGameStore, initialGameState } = await import("../../src/store");
const { App } = await import("../../src/ui/App");

const PGN_ONE_MOVE = [
  '[Event "jchess"]',
  '[Site "test"]',
  '[Date "2026.08.04"]',
  '[Round "-"]',
  '[White "Player"]',
  '[Black "Stockfish (Level 3)"]',
  '[Result "*"]',
  '[Difficulty "3"]',
  "",
  "1. e4 *",
].join("\n");

function record(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: "game-stored",
    pgn: PGN_ONE_MOVE,
    difficulty: 3,
    humanColor: "white",
    updatedAt: Date.now(),
    completed: false,
    ...overrides,
  };
}

describe("switching the machine on", () => {
  beforeEach(() => {
    stored = null;
    useGameStore.setState(() => ({ ...initialGameState }));
  });

  it("lands on the setup panel when there is nothing to come back to", async () => {
    render(<App />);

    // Long enough for the boot decision to have settled either way.
    await new Promise((r) => setTimeout(r, 50));
    expect(useGameStore.getState().status.kind).toBe("setup");
    expect(useGameStore.getState().history.length).toBe(0);
  });

  it("puts an unfinished game straight back, without asking", async () => {
    stored = record();
    render(<App />);

    await waitFor(() =>
      expect(useGameStore.getState().history.length).toBe(1),
    );
    expect(useGameStore.getState().history[0]?.san).toBe("e4");
    expect(useGameStore.getState().status.kind).toBe("engine-thinking");
    expect(useGameStore.getState().id).toBe("game-stored");
    // The question that used to be asked here is gone.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("brings the clock back with it", async () => {
    stored = record({
      timeControlId: "3+2",
      clockRemaining: { white: 100_000, black: 150_000 },
    });
    render(<App />);

    await waitFor(() => expect(useGameStore.getState().clock).toBeTruthy());
    const clock = useGameStore.getState().clock!;
    expect(clock.remaining).toEqual({ white: 100_000, black: 150_000 });
    expect(clock.runningFor).toBe("black");
  });
});
