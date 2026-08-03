import { describe, it, expect } from "vitest";
import { initialGameState } from "../../src/store";
import { GameController } from "../../src/store/controller";
import { createStockfishEngine } from "../../src/engine/stockfish";
import { positionAfter } from "../../src/core/rules";

/** Worker whose `bestmove` is emitted only when the test asks for it. */
class ControllableWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];
  posted: string[] = [];
  answerIsReady = true;

  addEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  postMessage(msg: string) {
    this.posted.push(msg);
    if (msg === "uci") queueMicrotask(() => this.emit("uciok"));
    else if (msg === "isready" && this.answerIsReady)
      queueMicrotask(() => this.emit("readyok"));
  }

  flushBestmove(move: string) {
    this.emit(`bestmove ${move}`);
  }

  emit(data: string) {
    const event = { data } as MessageEvent;
    if (this.onmessage) this.onmessage(event);
    for (const listener of [...this.listeners]) listener(event);
  }

  terminate() {}

  goCount() {
    return this.posted.filter((m) => m.startsWith("go")).length;
  }
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function makeStore() {
  const store: any = {
    ...initialGameState,
    setState: (fn: any) => Object.assign(store, fn(store)),
  };
  return store;
}

async function setup(extra: Record<string, number> = {}) {
  const worker = new ControllableWorker();
  const engine = createStockfishEngine({
    workerFactory: () => worker as unknown as Worker,
    capabilities: { threaded: false, maxThreads: 1, flavor: "lite-single" },
    drainTimeoutMs: 20,
    ...extra,
  });
  await engine.init();
  const store = makeStore();
  const controller = new GameController(store as any, engine);
  return { worker, engine, store, controller };
}

describe("GameController concurrency", () => {
  it("discards an in-flight engine reply when a new game starts", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    controller.makeMove({ from: 12, to: 28 }); // e4
    await tick(10);
    expect(store.status.kind).toBe("engine-thinking");

    controller.startNewGame({ difficulty: 8 });
    worker.flushBestmove("c7c5");
    await tick(50);

    expect(store.history.length).toBe(0);
    expect(store.status.kind).toBe("human-turn");
  });

  it("never turns a cancellation into an error status", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    controller.makeMove({ from: 12, to: 28 });
    await tick(10);

    controller.startNewGame({ difficulty: 8 });
    worker.flushBestmove("c7c5");
    await tick(50);

    expect(store.status.kind).not.toBe("error");
  });

  it("does not append a late engine reply after a takeback", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    controller.makeMove({ from: 12, to: 28 }); // e4
    await tick(10);

    controller.takeback();
    worker.flushBestmove("c7c5");
    await tick(50);

    expect(store.history.length).toBe(0);
    expect(store.status.kind).toBe("human-turn");
  });

  it("cancels the search while browsing history and restarts on return", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    controller.makeMove({ from: 12, to: 28 }); // e4
    await tick(10);
    const goesBefore = worker.goCount();

    controller.setCursor(0);
    worker.flushBestmove("c7c5");
    await tick(50);
    expect(store.history.length).toBe(1); // discarded, not applied

    controller.setCursor(1);
    await tick(50);
    expect(store.status.kind).toBe("engine-thinking");
    expect(worker.goCount()).toBeGreaterThan(goesBefore);

    worker.flushBestmove("c7c5");
    await tick(50);
    expect(store.history.length).toBe(2);
    expect(store.status.kind).toBe("human-turn");
  });

  it("surfaces a setOptions failure as an error status", async () => {
    const { worker, store, controller } = await setup({
      handshakeTimeoutMs: 30,
    });
    // Difficulty 2 carries uciOptions, so setOptions runs before the search.
    controller.startNewGame({ difficulty: 2 });
    worker.answerIsReady = false;

    controller.makeMove({ from: 12, to: 28 }); // e4
    await tick(120);

    expect(store.status.kind).toBe("error");
    expect(store.status.error.code).toBe("ENGINE_SEARCH_FAILED");
  });
});

describe("GameController takeback ply rule", () => {
  it("removes only the unanswered ply when the engine is thinking", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });

    controller.makeMove({ from: 12, to: 28 }); // 1. e4
    await tick(10);
    worker.flushBestmove("c7c5"); // 1... c5
    await tick(50);
    controller.makeMove({ from: 6, to: 21 }); // 2. Nf3
    await tick(10);
    expect(store.history.length).toBe(3);
    expect(store.status.kind).toBe("engine-thinking");

    controller.takeback();

    expect(store.history.length).toBe(2);
    expect(store.status.kind).toBe("human-turn");
    const pos = positionAfter(
      store.initialFen,
      store.history.map((h: any) => h.move),
    );
    expect(pos.turn).toBe("white");
  });

  it("removes a full move pair when the engine has already replied", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    controller.makeMove({ from: 12, to: 28 });
    await tick(10);
    worker.flushBestmove("c7c5");
    await tick(50);
    expect(store.history.length).toBe(2);

    controller.takeback();
    expect(store.history.length).toBe(0);
    expect(store.status.kind).toBe("human-turn");
  });

  it("is a no-op when only the engine's opening move exists and human is black", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8, humanColor: "black" });
    await tick(10);
    worker.flushBestmove("e2e4");
    await tick(50);
    expect(store.history.length).toBe(1);
    expect(store.status.kind).toBe("human-turn");

    expect(controller.canTakeback()).toBe(false);
    controller.takeback();

    expect(store.history.length).toBe(1);
    const pos = positionAfter(
      store.initialFen,
      store.history.map((h: any) => h.move),
    );
    expect(pos.turn).toBe("black");
  });

  it("lands on the human's turn when human is black with a full pair", async () => {
    const { worker, store, controller } = await setup();
    controller.startNewGame({ difficulty: 8, humanColor: "black" });
    await tick(10);
    worker.flushBestmove("e2e4"); // 1. e4
    await tick(50);
    controller.makeMove({ from: 50, to: 34 }); // 1... c5
    await tick(10);
    worker.flushBestmove("g1f3"); // 2. Nf3
    await tick(50);
    expect(store.history.length).toBe(3);

    controller.takeback();
    expect(store.history.length).toBe(1);
    const pos = positionAfter(
      store.initialFen,
      store.history.map((h: any) => h.move),
    );
    expect(pos.turn).toBe("black");
  });

  it("reports canTakeback false on a fresh game", async () => {
    const { controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    expect(controller.canTakeback()).toBe(false);
  });
});

describe("GameController premove queue", () => {
  it("replaces the tail instead of rejecting when the queue is full", async () => {
    const { store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    store.maxPremoves = 1;
    store.status = { kind: "engine-thinking", startedAt: Date.now() };

    expect(controller.makeMove({ from: 12, to: 28 })).toBe(true); // e4
    expect(store.premoves).toEqual([{ from: 12, to: 28 }]);

    expect(controller.makeMove({ from: 11, to: 27 })).toBe(true); // d4
    expect(store.premoves.length).toBe(1);
    expect(store.premoves[0]).toEqual({ from: 11, to: 27 });
  });

  it("rejects a premove for the engine's colour", async () => {
    const { store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    store.status = { kind: "engine-thinking", startedAt: Date.now() };

    // e7-e5 is a black move; the human is white.
    expect(controller.makeMove({ from: 52, to: 36 })).toBe(false);
    expect(store.premoves.length).toBe(0);
  });

  it("validates a chained premove against the hypothetical board", async () => {
    const { store, controller } = await setup();
    controller.startNewGame({ difficulty: 8 });
    store.status = { kind: "engine-thinking", startedAt: Date.now() };

    expect(controller.makeMove({ from: 12, to: 28 })).toBe(true); // e2-e4
    // Queen f1-h3 only becomes available once the e-pawn has left e2... but
    // the bishop on f1 is what opens; use Qd1-h5 through the vacated e2.
    expect(controller.makeMove({ from: 3, to: 39 })).toBe(true); // Qd1-h5
    expect(store.premoves.length).toBe(2);

    // A move from a square the first premove emptied is not available.
    expect(controller.makeMove({ from: 12, to: 20 })).toBe(false);
  });
});
