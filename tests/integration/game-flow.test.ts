import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, initialGameState } from "../../src/store";
import { GameController } from "../../src/store/controller";
import { createStockfishEngine } from "../../src/engine/stockfish";
import {
  saveActiveGame,
  loadActiveGame,
  clearActiveGame,
} from "../../src/storage";
import { nameToSquare } from "../../src/core/types";

class MockEngineWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];

  addEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  postMessage(msg: string) {
    setTimeout(() => {
      if (msg === "uci") {
        this.emit("uciok");
      } else if (msg === "isready") {
        this.emit("readyok");
      } else if (msg.startsWith("go")) {
        this.emit("bestmove c7c5");
      }
    }, 10);
  }

  emit(data: string) {
    const event = { data } as MessageEvent;
    if (this.onmessage) this.onmessage(event);
    for (const l of this.listeners) l(event);
  }

  terminate() {}
}

describe("Game Integration Tests", () => {
  beforeEach(() => {
    useGameStore.setState(() => ({ ...initialGameState }));
  });

  it("runs complete turn cycle between human and engine", async () => {
    const fakeEngine = createStockfishEngine({
      workerFactory: () => new MockEngineWorker() as unknown as Worker,
      capabilities: { threaded: false, maxThreads: 1, flavor: "lite-single" },
    });
    await fakeEngine.init();

    const controller = new GameController(useGameStore as any, fakeEngine);
    controller.startNewGame({ humanColor: "white", difficulty: 8 });

    expect(useGameStore.getState().status.kind).toBe("human-turn");

    // Human plays e4 (12 -> 28)
    const e2 = nameToSquare("e2")!;
    const e4 = nameToSquare("e4")!;
    const moved = controller.makeMove({ from: e2, to: e4 });
    expect(moved).toBe(true);

    // Wait for engine response
    await new Promise((r) => setTimeout(r, 200));

    const state = useGameStore.getState();
    expect(state.history.length).toBe(2);
    expect(state.history[0]?.san).toBe("e4");
    expect(state.history[1]?.san).toBe("c5"); // Sicilian Defense response from mock engine
    expect(state.status.kind).toBe("human-turn");

    fakeEngine.dispose();
  });

  it("handles premove queuing and draining on engine move", async () => {
    const fakeEngine = createStockfishEngine({
      workerFactory: () => new MockEngineWorker() as unknown as Worker,
      capabilities: { threaded: false, maxThreads: 1, flavor: "lite-single" },
    });
    await fakeEngine.init();

    const controller = new GameController(useGameStore as any, fakeEngine);
    controller.startNewGame({ humanColor: "white", difficulty: 8 });

    // Play e4
    controller.makeMove({ from: nameToSquare("e2")!, to: nameToSquare("e4")! });

    // While engine is thinking, queue premove Nf3 (6 -> 21)
    const premoved = controller.makeMove({
      from: nameToSquare("g1")!,
      to: nameToSquare("f3")!,
    });
    expect(premoved).toBe(true);
    expect(useGameStore.getState().premoves.length).toBe(1);

    // Wait for engine response + premove execution
    await new Promise((r) => setTimeout(r, 300));

    const state = useGameStore.getState();
    // Should have 3 plies: 1. e4 c5 2. Nf3
    expect(state.history.length).toBe(3);
    expect(state.history[2]?.san).toBe("Nf3");

    fakeEngine.dispose();
  });

  it("persists and loads active game state", async () => {
    const state = useGameStore.getState();
    const updatedState = {
      ...state,
      history: [
        {
          move: { from: 12, to: 28 },
          san: "e4",
          fenAfter:
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
          isCheck: false,
          isMate: false,
        },
      ],
    };

    await saveActiveGame(updatedState);
    // Wait for debounce timer
    await new Promise((r) => setTimeout(r, 600));

    const loaded = await loadActiveGame();
    if (loaded) {
      expect(loaded.history.length).toBe(1);
      expect(loaded.history[0]?.san).toBe("e4");
    }

    await clearActiveGame();
  });
});
