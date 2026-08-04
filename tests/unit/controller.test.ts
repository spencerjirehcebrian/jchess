import { describe, it, expect, vi, afterEach } from "vitest";
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
    await new Promise((r) => setTimeout(r, 500));
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

  describe("time control", () => {
    const makeStore = () => {
      const store = {
        ...initialGameState,
        setState: (fn: any) => Object.assign(store, fn(store)),
      };
      return store;
    };

    it("starts no clock by default", () => {
      const store = makeStore();
      const controller = new GameController(store as any);
      controller.startNewGame();

      expect(store.clock).toBeUndefined();
      controller.dispose();
    });

    it("charges the mover, and keeps the choice across new games", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.setTimeControl("3+2");
      controller.startNewGame();
      expect(store.clock?.runningFor).toBe("white");

      controller.makeMove({ from: 12, to: 28 }); // e4
      expect(store.clock?.runningFor).toBe("black");
      // Increment credited on completion, so white is up on the initial 180s
      // minus the handful of milliseconds the move actually took.
      expect(store.clock!.remaining.white).toBeGreaterThan(181_000);
      expect(store.clock!.remaining.black).toBe(180_000);

      controller.startNewGame();
      expect(store.timeControlId).toBe("3+2");
      expect(store.clock?.remaining.white).toBe(180_000);
      controller.dispose();
    });

    it("ends the game on time when a flag falls", async () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.setTimeControl("3+2");
      controller.startNewGame();

      // Wind white's clock down to nothing without waiting three minutes.
      store.clock = { ...store.clock!, remaining: { white: 20, black: 180_000 } };

      await new Promise((r) => setTimeout(r, 350));

      expect(store.status.kind).toBe("over");
      expect((store.status as any).result).toEqual({
        winner: "black",
        reason: "timeout",
      });
      // The clock is frozen, not left ticking behind the result banner.
      expect(store.clock?.runningFor).toBeNull();
      controller.dispose();
    });
  });

  describe("setup phase", () => {
    const makeStore = () => {
      const store = {
        ...initialGameState,
        setState: (fn: any) => Object.assign(store, fn(store)),
      };
      return store;
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("orients the board preview when a side is chosen", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.setColorChoice("black");
      expect(store.colorChoice).toBe("black");
      expect(store.humanColor).toBe("black");
      expect(store.boardFlipped).toBe(true);

      // Random keeps its secret: the preview stays white-side-down.
      controller.setColorChoice("random");
      expect(store.colorChoice).toBe("random");
      expect(store.humanColor).toBe("white");
      expect(store.boardFlipped).toBe(false);
    });

    it("ignores colour and difficulty changes outside setup", () => {
      const store = makeStore();
      const controller = new GameController(store as any);
      controller.startNewGame();

      controller.setColorChoice("black");
      controller.setDifficulty(7);
      expect(store.humanColor).toBe("white");
      expect(store.difficulty).toBe(initialGameState.difficulty);
    });

    it("resolves random at start, not before", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.setColorChoice("random");
      vi.spyOn(Math, "random").mockReturnValue(0.9); // → black
      controller.startGame();

      expect(store.humanColor).toBe("black");
      expect(store.boardFlipped).toBe(true);
      expect(store.colorChoice).toBe("random");
      expect(store.status.kind).toBe("engine-thinking");
      controller.dispose();
    });

    it("starts the game implicitly on white's first move", () => {
      const store = makeStore();
      const controller = new GameController(store as any);
      controller.setTimeControl("3+2");

      expect(store.status.kind).toBe("setup");
      const ok = controller.makeMove({ from: 12, to: 28 }); // e4

      expect(ok).toBe(true);
      expect(store.history.length).toBe(1);
      expect(store.history[0]?.san).toBe("e4");
      expect(store.status.kind).toBe("engine-thinking");
      // The game the move started has a running clock, charged to black now.
      expect(store.clock?.runningFor).toBe("black");
      controller.dispose();
    });

    it("keeps the board inert in setup for black and random", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.setColorChoice("random");
      expect(controller.makeMove({ from: 12, to: 28 })).toBe(false);
      expect(store.status.kind).toBe("setup");
      expect(store.history.length).toBe(0);
    });

    it("treats resign as a no-op in setup", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.resign();
      expect(store.status.kind).toBe("setup");
    });

    it("flips the board when starting as black", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.startNewGame({ humanColor: "black" });
      expect(store.boardFlipped).toBe(true);
      controller.dispose();
    });

    it("returns to setup keeping the panel choices", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.setTimeControl("3+2");
      controller.setColorChoice("black");
      controller.setDifficulty(4);
      controller.startGame();
      controller.resign();
      expect(store.status.kind).toBe("over");

      controller.returnToSetup();
      expect(store.status.kind).toBe("setup");
      expect(store.history.length).toBe(0);
      expect(store.clock).toBeUndefined();
      // Every choice survives for the pre-filled panel.
      expect(store.difficulty).toBe(4);
      expect(store.timeControlId).toBe("3+2");
      expect(store.colorChoice).toBe("black");
      expect(store.boardFlipped).toBe(true);
      controller.dispose();
    });
  });

  /*
   * A game put back after a reload. The moves come from the PGN; the clock
   * comes from the record beside it, because a PGN carries no time.
   */
  describe("resuming a stored game", () => {
    const makeStore = () => {
      const store = {
        ...initialGameState,
        setState: (fn: any) => Object.assign(store, fn(store)),
      };
      return store;
    };

    const restored = () => ({
      initialFen: initialGameState.initialFen,
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
      startedAt: Date.now(),
    });

    it("puts the clock back where it was left, running for the side to move", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.resumeGame(restored() as any, {
        id: "game-stored",
        humanColor: "white",
        difficulty: 3,
        timeControlId: "3+2",
        clockRemaining: { white: 120_000, black: 90_000 },
      });

      expect(store.clock?.remaining).toEqual({ white: 120_000, black: 90_000 });
      // Black is to move after 1. e4, so black's clock is the one running.
      expect(store.clock?.runningFor).toBe("black");
      expect(store.clock?.initialMs).toBe(180_000);
      expect(store.timeControlId).toBe("3+2");
      expect(store.status.kind).toBe("engine-thinking");
      controller.dispose();
    });

    it("resumes untimed when the record predates stored clocks", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.resumeGame(restored() as any, {
        id: "game-legacy",
        humanColor: "white",
        difficulty: 3,
      });

      expect(store.clock).toBeUndefined();
      expect(store.history.length).toBe(1);
      controller.dispose();
    });

    it("comes back facing the side being played", () => {
      const store = makeStore();
      const controller = new GameController(store as any);

      controller.resumeGame(restored() as any, {
        id: "game-black",
        humanColor: "black",
        difficulty: 3,
      });

      expect(store.boardFlipped).toBe(true);
      // And the panel, when it next appears, offers the side just played.
      expect(store.colorChoice).toBe("black");
      expect(store.status.kind).toBe("human-turn");
      controller.dispose();
    });
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
