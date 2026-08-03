import { describe, it, expect } from "vitest";
import { createStockfishEngine } from "../../src/engine/stockfish";
import { EngineError, isSearchCancelled } from "../../src/engine/types";
import { START_FEN } from "../../src/core/types";

/**
 * A worker whose `stop` does nothing and which emits `bestmove` only when the
 * test asks for it. That is what makes an arbitrarily late or stale reply
 * reproducible with real timers — the project uses no fake timers, and the
 * other fakes auto-reply shortly after every `go`.
 */
class ControllableWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];
  posted: string[] = [];
  terminated = 0;

  addEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  postMessage(msg: string) {
    this.posted.push(msg);
    if (msg === "uci") queueMicrotask(() => this.emit("uciok"));
    else if (msg === "isready") queueMicrotask(() => this.emit("readyok"));
    // "stop" and "go" are deliberately unanswered: the test drives bestmove.
  }

  flushBestmove(move = "e2e4") {
    this.emit(`bestmove ${move}`);
  }

  emit(data: string) {
    const event = { data } as MessageEvent;
    if (this.onmessage) this.onmessage(event);
    for (const listener of [...this.listeners]) listener(event);
  }

  terminate() {
    this.terminated++;
  }

  goCount() {
    return this.posted.filter((m) => m.startsWith("go")).length;
  }
}

const CAPS = { threaded: false, maxThreads: 1, flavor: "lite-single" } as const;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function makeEngine(
  worker: ControllableWorker,
  extra: Record<string, number> = {},
) {
  const engine = createStockfishEngine({
    workerFactory: () => worker as unknown as Worker,
    capabilities: { ...CAPS },
    ...extra,
  });
  await engine.init();
  return engine;
}

describe("stockfish cancellation protocol", () => {
  it("never resolves a new search with a superseded search's bestmove", async () => {
    const w = new ControllableWorker();
    const engine = await makeEngine(w, { drainTimeoutMs: 20 });

    const p1 = engine.search(START_FEN, [], { depth: 1 });
    const rejected = p1.catch((e) => e);
    await tick();

    const p2 = engine.search(START_FEN, ["e2e4"], { depth: 1 });
    await tick(60); // let the drain time out so both go tokens are outstanding

    // The stale reply for search #1 arrives late.
    w.flushBestmove("a2a3");
    await tick();

    const err = await rejected;
    expect(err).toBeInstanceOf(EngineError);
    expect(isSearchCancelled(err)).toBe(true);

    expect(w.goCount()).toBe(2);
    expect(w.posted.some((m) => m.includes("moves e2e4"))).toBe(true);

    w.flushBestmove("b1c3");
    const result = await p2;
    expect(result.move).toBe("b1c3");
  });

  it("stop() rejects with a cancellation error and discards the reply", async () => {
    const w = new ControllableWorker();
    const engine = await makeEngine(w);

    const p1 = engine.search(START_FEN, [], { depth: 1 });
    const rejected = p1.catch((e) => e);
    await tick();

    engine.stop();
    const err = await rejected;
    expect(isSearchCancelled(err)).toBe(true);
    expect(w.posted).toContain("stop");

    w.flushBestmove("e2e4");
    await tick();
    expect(engine.state).toBe("ready");

    // The next search must resolve from its own reply, not the discarded one.
    const p2 = engine.search(START_FEN, [], { depth: 1 });
    await tick();
    w.flushBestmove("d2d4");
    expect((await p2).move).toBe("d2d4");
  });

  it("dispose() rejects the pending search and leaves no live watchdog", async () => {
    const w = new ControllableWorker();
    const engine = await makeEngine(w, { watchdogMs: 30 });

    const p1 = engine.search(START_FEN, [], { depth: 1 });
    const rejected = p1.catch((e) => e);
    await tick();

    engine.dispose();
    const err = await rejected;
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe("DISPOSED");
    expect(engine.state).toBe("dead");
    expect(w.terminated).toBe(1);

    await tick(80);
    expect(w.terminated).toBe(1); // the watchdog did not fire afterwards
    expect(() => w.flushBestmove("e2e4")).not.toThrow();
  });

  it("a superseded search's watchdog never terminates the worker", async () => {
    const w = new ControllableWorker();
    // Search #1 posts its `go` at t=0, so the old leaked watchdog would fire at
    // t=30 and terminate the worker. Search #2 only starts once the drain times
    // out (t=45), putting its own watchdog at t=75 — well clear of the check.
    const engine = await makeEngine(w, { watchdogMs: 30, drainTimeoutMs: 40 });

    const p1 = engine.search(START_FEN, [], { depth: 1 });
    p1.catch(() => {});
    await tick(5);

    const p2 = engine.search(START_FEN, ["e2e4"], { depth: 1 });
    let settled = false;
    p2.then(
      () => (settled = true),
      () => (settled = true),
    );

    await tick(50); // past search #1's watchdog, before search #2's
    expect(w.terminated).toBe(0);
    expect(settled).toBe(false);

    w.flushBestmove("a2a3"); // consumed by the orphaned token
    await tick();
    expect(settled).toBe(false);

    w.flushBestmove("b1c3");
    expect((await p2).move).toBe("b1c3");
  });

  it("does not hang when the previous search's bestmove never arrives", async () => {
    const w = new ControllableWorker();
    const engine = await makeEngine(w, { drainTimeoutMs: 15 });

    engine.search(START_FEN, [], { depth: 1 }).catch(() => {});
    await tick();

    const started = Date.now();
    const p2 = engine.search(START_FEN, ["e2e4"], { depth: 1 });
    p2.catch(() => {});
    await tick(60);

    expect(w.goCount()).toBe(2);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("setOptions cancels and drains the in-flight search before posting", async () => {
    const w = new ControllableWorker();
    const engine = await makeEngine(w, { drainTimeoutMs: 20 });

    const p1 = engine.search(START_FEN, [], { depth: 1 });
    const rejected = p1.catch((e) => e);
    await tick();

    const optionsDone = engine.setOptions({ "Skill Level": 3 });
    await tick();

    expect(isSearchCancelled(await rejected)).toBe(true);
    // The stale bestmove is drained before `setoption` is posted.
    expect(w.posted.some((m) => m.startsWith("setoption name Skill"))).toBe(
      false,
    );

    w.flushBestmove("e2e4");
    await optionsDone;

    const stopIndex = w.posted.lastIndexOf("stop");
    const setoptionIndex = w.posted.findIndex((m) =>
      m.startsWith("setoption name Skill"),
    );
    expect(setoptionIndex).toBeGreaterThan(stopIndex);
  });
});
