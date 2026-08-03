import { describe, it, expect } from "vitest";
import { createStockfishEngine } from "../../src/engine/stockfish";
import { parseInfoLine, parseBestMove } from "../../src/engine/uci";

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];
  scriptedResponses: Record<string, string[]> = {
    uci: [
      "id name Stockfish",
      "id author the Stockfish developers",
      "option name Threads type spin default 1 min 1 max 1024",
      "uciok",
    ],
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
        this.emit("info depth 1 nodes 100 nps 50000 score cp 20 pv e2e4");
        this.emit("bestmove e2e4 ponder e7e5");
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

describe("engine module", () => {
  it("parses UCI info and bestmove lines correctly", () => {
    const info = parseInfoLine(
      "info depth 8 nodes 1234 nps 5678 score cp 45 pv e2e4 e7e5",
    );
    expect(info?.depth).toBe(8);
    expect(info?.nodes).toBe(1234);
    expect(info?.scoreCp).toBe(45);

    const best = parseBestMove("bestmove g1f3 ponder e7e5");
    expect(best?.move).toBe("g1f3");
    expect(best?.ponder).toBe("e7e5");

    const nullMove = parseBestMove("bestmove (none)");
    expect(nullMove).toBeNull();
  });

  it("initializes engine and executes search via fake worker", async () => {
    const engine = createStockfishEngine({
      workerFactory: () => new FakeWorker() as unknown as Worker,
      capabilities: { threaded: false, maxThreads: 1, flavor: "lite-single" },
    });

    expect(engine.state).toBe("uninitialised");
    await engine.init();
    expect(engine.state).toBe("ready");

    const res = await engine.search(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      [],
      { depth: 4 },
    );
    expect(res.move).toBe("e2e4");
    expect(engine.state).toBe("ready");

    engine.dispose();
    expect(engine.state).toBe("dead");
  });
});
