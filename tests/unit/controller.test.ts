import { describe, it, expect } from "vitest";
import { initialGameState } from "../../src/store";
import { GameController } from "../../src/store/controller";
import { createStockfishEngine } from "../../src/engine/stockfish";

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];
  scriptedResponses: Record<string, string[]> = {
    uci: ["uciok"],
    isready: ["readyok"],
  };

  addEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  postMessage(msg: string) {
    setTimeout(() => {
      if (this.scriptedResponses[msg]) {
        for (const resp of this.scriptedResponses[msg]!) {
          this.emit(resp);
        }
      } else if (msg.startsWith("go")) {
        this.emit("bestmove e7e5");
      }
    }, 10);
  }

  emit(data: string) {
    const event = { data } as MessageEvent;
    if (this.onmessage) this.onmessage(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  terminate() {}
}

describe("GameController", () => {
  it("rejects illegal human move leaving state untouched", () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const controller = new GameController(store as any);
    controller.startNewGame();

    // e2 (12) to e5 (36) is illegal for white
    const success = controller.makeMove({ from: 12, to: 36 });
    expect(success).toBe(false);
    expect(store.history.length).toBe(0);
    expect(store.status.kind).toBe("human-turn");
  });

  it("applies legal human move and transitions turn", async () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const fakeEngine = createStockfishEngine({
      workerFactory: () => new FakeWorker() as unknown as Worker,
      capabilities: { threaded: false, maxThreads: 1, flavor: "lite-single" },
    });
    await fakeEngine.init();

    const controller = new GameController(store as any, fakeEngine);
    controller.startNewGame({ difficulty: 8 });

    // e2 to e4 (12 to 28)
    const success = controller.makeMove({ from: 12, to: 28 });
    expect(success).toBe(true);
    expect(store.history.length).toBe(1);
    expect(store.history[0]?.san).toBe("e4");

    // Wait for fake engine reply
    await new Promise((r) => setTimeout(r, 200));
    expect(store.history.length).toBe(2);
    expect(store.history[1]?.san).toBe("e5");
    expect(store.status.kind).toBe("human-turn");
  });

  it("rejects moving while browsing history without truncating history", () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const controller = new GameController(store as any);
    controller.startNewGame();
    controller.makeMove({ from: 12, to: 28 }); // e4

    controller.setCursor(0); // browse history at 0
    const success = controller.makeMove({ from: 11, to: 27 }); // d4
    expect(success).toBe(false);
    expect(store.history.length).toBe(1); // not truncated!
  });

  it("queues premoves when engine is thinking and clears premoves on request", () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const controller = new GameController(store as any);
    controller.startNewGame();

    store.status = { kind: "engine-thinking", startedAt: Date.now() };
    const premoveOk = controller.makeMove({ from: 6, to: 21 }); // Nf3 premove
    expect(premoveOk).toBe(true);
    expect(store.premoves.length).toBe(1);

    controller.clearPremoves();
    expect(store.premoves.length).toBe(0);
  });

  it("toggles board orientation and square selection", () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const controller = new GameController(store as any);

    expect(store.boardFlipped).toBe(false);
    controller.flipBoard();
    expect(store.boardFlipped).toBe(true);

    controller.setSelectedSquare(12);
    expect(store.selectedSquare).toBe(12);
  });

  it("handles takeback removing plies", () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const controller = new GameController(store as any);
    controller.startNewGame();
    controller.makeMove({ from: 12, to: 28 }); // e4

    controller.takeback();
    expect(store.history.length).toBe(0);
    expect(store.status.kind).toBe("human-turn");
  });

  it("updates boardSize via setBoardSize", () => {
    const store = {
      ...initialGameState,
      setState: (fn: any) => Object.assign(store, fn(store)),
    };
    const controller = new GameController(store as any);

    controller.setBoardSize("large");
    expect(store.boardSize).toBe("large");

    controller.setBoardSize("full");
    expect(store.boardSize).toBe("full");

    controller.setBoardSize("compact");
    expect(store.boardSize).toBe("compact");
  });
});
