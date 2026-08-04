import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchCells, useTelemetry } from "../../src/store/telemetry";
import { initialGameState, useGameStore } from "../../src/store";
import { GameController } from "../../src/store/controller";
import { createStockfishEngine } from "../../src/engine/stockfish";
import { EngineProgress } from "../../src/engine/types";

function progress(p: Partial<EngineProgress>): EngineProgress {
  return { depth: 0, nodes: 0, nps: 0, ...p };
}

describe("engine telemetry", () => {
  beforeEach(() => {
    useTelemetry.getState().beginSearch();
  });

  it("starts a search from nothing rather than the last one's reading", () => {
    useTelemetry.getState().report(progress({ depth: 18 }), "white");
    useTelemetry.getState().beginSearch();

    const s = useTelemetry.getState();
    expect(s.depth).toBe(0);
    expect(s.scoreCp).toBeNull();
    expect(s.searching).toBe(true);
  });

  /*
   * The sign is the one thing here that fails silently: get it backwards and
   * every readout is confidently, precisely wrong in the opposite direction.
   * Both colours are asserted because testing only the white case passes just as
   * happily with no normalisation at all.
   */
  it("keeps an engine playing white as-is", () => {
    useTelemetry.getState().report(progress({ scoreCp: 150 }), "white");
    expect(useTelemetry.getState().scoreCp).toBe(150);
  });

  it("flips an engine playing black, so positive still means white", () => {
    // The engine is black and likes its position by 1.5 pawns, which is white
    // being a pawn and a half *down*.
    useTelemetry.getState().report(progress({ scoreCp: 150 }), "black");
    expect(useTelemetry.getState().scoreCp).toBe(-150);
  });

  it("normalises mate scores the same way", () => {
    useTelemetry.getState().report(progress({ scoreMate: 3 }), "black");
    expect(useTelemetry.getState().scoreMate).toBe(-3);

    useTelemetry.getState().report(progress({ scoreMate: 3 }), "white");
    expect(useTelemetry.getState().scoreMate).toBe(3);
  });

  it("reports a missing score as absent, not as level", () => {
    // A search that has not scored anything yet must not read as 0.00, which is
    // a real and very different claim about the position.
    useTelemetry.getState().report(progress({ depth: 4 }), "white");
    const s = useTelemetry.getState();
    expect(s.scoreCp).toBeNull();
    expect(s.scoreMate).toBeNull();
  });

  it("stops searching without discarding the last reading", () => {
    useTelemetry.getState().report(progress({ depth: 12, scoreCp: 40 }), "white");
    useTelemetry.getState().endSearch();

    const s = useTelemetry.getState();
    expect(s.searching).toBe(false);
    expect(s.depth).toBe(12);
    expect(s.scoreCp).toBe(40);
  });

  /*
   * The whole reason telemetry is a store of its own. `App` subscribes to the
   * game store and writes the game to storage on every notification, and the
   * rail's components subscribe to all of it — so a reading that reached the
   * game store would repaint the transcript and hit the persistence layer ten
   * times a second. This asserts the separation rather than trusting it.
   */
  it("never notifies the game store", () => {
    let notifications = 0;
    const unsubscribe = useGameStore.subscribe(() => {
      notifications += 1;
    });

    try {
      useTelemetry.getState().beginSearch();
      for (let depth = 1; depth <= 20; depth += 1) {
        useTelemetry.getState().report(progress({ depth, scoreCp: depth }), "white");
      }
      useTelemetry.getState().endSearch();
    } finally {
      unsubscribe();
    }

    expect(notifications).toBe(0);
  });

  /*
   * End to end from a UCI line to the store, through the real engine wrapper and
   * the real controller. The unit tests above would all pass with `onProgress`
   * never wired up at all, which is exactly the state this pass exists to fix —
   * so one test drives an actual search.
   */
  it("carries a real search's info lines into the store", async () => {
    class ProgressWorker {
      listeners: ((e: MessageEvent) => void)[] = [];
      onmessage: ((e: MessageEvent) => void) | null = null;

      addEventListener(_t: string, l: (e: MessageEvent) => void) {
        this.listeners.push(l);
      }
      removeEventListener(_t: string, l: (e: MessageEvent) => void) {
        this.listeners = this.listeners.filter((x) => x !== l);
      }

      postMessage(msg: string) {
        setTimeout(() => {
          if (msg === "uci") this.emit("uciok");
          else if (msg === "isready") this.emit("readyok");
          else if (msg.startsWith("go")) {
            this.emit("info depth 4 nodes 900 nps 9000 score cp 31");
            this.emit("info depth 11 nodes 8000 nps 9000 score cp 64");
            this.emit("bestmove e7e5");
          }
        }, 10);
      }

      emit(data: string) {
        const event = { data } as MessageEvent;
        this.onmessage?.(event);
        for (const l of this.listeners) l(event);
      }

      terminate() {}
    }

    const store: any = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const engine = createStockfishEngine({
      workerFactory: () => new ProgressWorker() as unknown as Worker,
    });
    await engine.init();

    const controller = new GameController(store, engine);
    controller.startNewGame();
    // The human is white, so the engine is black — its +64 is white being 64
    // centipawns down.
    controller.makeMove({ from: 12, to: 28 }); // e2e4

    await vi.waitFor(() => {
      expect(useTelemetry.getState().depth).toBe(11);
    });
    expect(useTelemetry.getState().scoreCp).toBe(-64);

    engine.dispose();
  });

  describe("the four cells", () => {
    const cells = (depth: number) =>
      searchCells({ searching: true, depth, scoreCp: null, scoreMate: null });

    it("shows nothing before the first iteration completes", () => {
      expect(cells(0)).toBe(0);
    });

    /*
     * The low difficulties search only a few plies. Rounding put them at zero
     * cells for the whole search, which is the dead indicator this readout was
     * built to replace — so any depth at all has to light one.
     */
    it("lights a cell for any depth at all", () => {
      expect(cells(1)).toBe(1);
      expect(cells(4)).toBe(1);
      expect(cells(5)).toBe(1);
    });

    it("fills across the useful range", () => {
      expect(cells(6)).toBe(2);
      expect(cells(11)).toBe(3);
      expect(cells(16)).toBe(4);
    });

    it("clamps rather than overflowing at high depth", () => {
      expect(cells(40)).toBe(4);
    });
  });
});
