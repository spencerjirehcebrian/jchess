import {
  Engine,
  EngineCapabilities,
  EngineError,
  EngineErrorCode,
  EngineProgress,
  EngineState,
  SearchBudget,
  SearchResult,
} from "./types";
import { detectCapabilities } from "./capability";
import { parseBestMove, parseInfoLine } from "./uci";

export interface StockfishEngineOptions {
  workerFactory?: () => Worker;
  capabilities?: EngineCapabilities;
  /** How long to wait for a stopped search's `bestmove` before giving up. */
  drainTimeoutMs?: number;
  /** Overrides the budget-derived watchdog timeout. */
  watchdogMs?: number;
  /** Overrides the `uci`/`isready` handshake timeouts. */
  handshakeTimeoutMs?: number;
}

const DEFAULT_DRAIN_TIMEOUT_MS = 1000;
const DEFAULT_UCI_TIMEOUT_MS = 15000;
const DEFAULT_ISREADY_TIMEOUT_MS = 10000;
/** How many unanswered `go` commands we tolerate before declaring the worker dead. */
const MAX_ORPHANED_GO = 3;

interface ActiveSearch {
  id: number;
  resolve: (res: SearchResult) => void;
  reject: (err: Error) => void;
  onProgress: ((p: EngineProgress) => void) | null;
  watchdog: ReturnType<typeof setTimeout> | null;
  settled: boolean;
  progressData: Partial<EngineProgress>;
  lastProgressTime: number;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/**
 * One entry per `go` we have posted and not yet seen a `bestmove` for. UCI
 * guarantees exactly one `bestmove` per `go`, so `bestmove` #k belongs to `go`
 * #k. Routing by queue position — rather than by "whatever promise happens to
 * be pending" — is what keeps a stale reply from resolving a newer search.
 */
interface GoToken {
  id: number;
  search: ActiveSearch | null;
}

export function createStockfishEngine(opts?: StockfishEngineOptions): Engine {
  const caps = opts?.capabilities ?? detectCapabilities();
  const drainTimeoutMs = opts?.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;
  let currentState: EngineState = "uninitialised";

  let worker: Worker | null = null;
  let activeSearch: ActiveSearch | null = null;
  let goQueue: GoToken[] = [];
  let drainWaiters: Array<() => void> = [];
  let handshakeCancellers = new Set<(err: Error) => void>();
  let searchSeq = 0;
  let latestGeneration = 0;

  /**
   * Reads the state through a call so control-flow narrowing from an earlier
   * check is not carried across an await — `quiesce()` can kill the engine.
   */
  function isDead(): boolean {
    return currentState === "dead";
  }

  function post(cmd: string) {
    if (worker) {
      worker.postMessage(cmd);
    }
  }

  function notifyDrainWaiters() {
    for (const waiter of [...drainWaiters]) waiter();
  }

  /**
   * The only terminal path for a search. All bookkeeping happens before the
   * user callback runs, so a continuation that synchronously starts another
   * search always observes consistent state.
   */
  function settleSearch(
    s: ActiveSearch,
    outcome:
      | { ok: true; value: SearchResult }
      | { ok: false; error: Error },
  ): void {
    if (s.settled) return;
    s.settled = true;

    if (s.watchdog !== null) {
      clearTimeout(s.watchdog);
      s.watchdog = null;
    }
    if (s.signal && s.onAbort) {
      s.signal.removeEventListener("abort", s.onAbort);
    }
    s.onProgress = null;
    if (activeSearch === s) activeSearch = null;

    if (outcome.ok) s.resolve(outcome.value);
    else s.reject(outcome.error);
  }

  /**
   * Rejects the in-flight search (if any) and orphans its go token so the
   * `bestmove` it eventually produces is discarded. Synchronous.
   */
  function cancelActiveSearch(code: EngineErrorCode, message: string): boolean {
    const s = activeSearch;
    if (!s) return false;

    // Orphan before settling: a `bestmove` delivered in the same task must not
    // be mis-attributed to whatever search runs next.
    const token = goQueue.find((t) => t.search === s);
    if (token) token.search = null;

    if (currentState === "searching") {
      currentState = "stopping";
      post("stop");
    }

    settleSearch(s, { ok: false, error: new EngineError(code, message) });
    return true;
  }

  /**
   * Resolves once no `go` is outstanding, or after `timeoutMs`. Never rejects:
   * an unresponsive worker must not hang `search()` forever. Correctness does
   * not depend on this succeeding — the orphaned token stays ahead of the new
   * one in the FIFO, so a late `bestmove` is still discarded.
   */
  function drainOutstanding(timeoutMs: number): Promise<void> {
    if (goQueue.length === 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        drainWaiters = drainWaiters.filter((w) => w !== waiter);
        resolve();
      };
      const waiter = () => {
        if (goQueue.length === 0) finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      drainWaiters.push(waiter);
    });
  }

  /** Shared prologue for `search()` and `setOptions()`: cancel, then drain. */
  async function quiesce(reason: string): Promise<void> {
    cancelActiveSearch("CANCELLED", reason);
    await drainOutstanding(drainTimeoutMs);
  }

  function rejectPendingHandshakes(err: Error) {
    const cancellers = [...handshakeCancellers];
    handshakeCancellers = new Set();
    for (const cancel of cancellers) cancel(err);
  }

  /** Unrecoverable worker failure: tear everything down and wake all waiters. */
  function hardFail(message: string) {
    currentState = "dead";
    goQueue = [];
    if (worker) {
      worker.onmessage = null;
      worker.terminate();
      worker = null;
    }
    rejectPendingHandshakes(new EngineError("ENGINE_DEAD", message));
    notifyDrainWaiters();
  }

  function handleInfo(msgText: string) {
    const s = activeSearch;
    if (!s) return;
    // Orphaned searches are still ahead of us in the queue, so this `info`
    // belongs to a superseded search and must not pollute our score/depth.
    if (goQueue[0]?.search !== s) return;

    const parsed = parseInfoLine(msgText);
    if (!parsed) return;

    s.progressData = { ...s.progressData, ...parsed };
    const now = performance.now();
    if (s.onProgress && now - s.lastProgressTime >= 100) {
      s.lastProgressTime = now;
      s.onProgress({
        depth: s.progressData.depth ?? 0,
        nodes: s.progressData.nodes ?? 0,
        nps: s.progressData.nps ?? 0,
        scoreCp: s.progressData.scoreCp,
        scoreMate: s.progressData.scoreMate,
        pv: s.progressData.pv,
      });
    }
  }

  function handleBestMove(msgText: string) {
    const token = goQueue.shift();
    if (!token) {
      // Unsolicited bestmove: never touch activeSearch on its behalf.
      return;
    }

    const s = token.search;
    if (s && !s.settled) {
      const res = parseBestMove(msgText);
      if (!res) {
        settleSearch(s, {
          ok: false,
          error: new EngineError(
            "ILLEGAL_OUTPUT",
            `Illegal engine output: ${msgText}`,
          ),
        });
      } else {
        res.depth = s.progressData.depth ?? 0;
        res.scoreCp = s.progressData.scoreCp;
        res.scoreMate = s.progressData.scoreMate;
        settleSearch(s, { ok: true, value: res });
      }
    }

    // Only return to `ready` when nothing is outstanding and no newer search
    // is running — a stale bestmove must not clear a live search's state.
    if (
      goQueue.length === 0 &&
      activeSearch === null &&
      (currentState === "stopping" || currentState === "searching")
    ) {
      currentState = "ready";
    }

    notifyDrainWaiters();
  }

  function handleMessage(msgText: string) {
    if (currentState === "dead") return;

    if (msgText.startsWith("info")) {
      handleInfo(msgText);
      return;
    }

    if (msgText.startsWith("bestmove")) {
      handleBestMove(msgText);
    }
  }

  function sendCommandWaitResponse(
    cmd: string,
    expectedResponsePrefix: string,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer !== null) clearTimeout(timer);
        if (worker) worker.removeEventListener("message", handler);
        handshakeCancellers.delete(cancel);
      };

      const handler = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : String(e.data);
        if (line.startsWith(expectedResponsePrefix)) {
          cleanup();
          resolve(line);
        }
      };

      const cancel = (err: Error) => {
        cleanup();
        reject(err);
      };

      if (worker) {
        worker.addEventListener("message", handler);
      }
      handshakeCancellers.add(cancel);

      timer = setTimeout(() => {
        cleanup();
        reject(
          new EngineError(
            "HANDSHAKE_TIMEOUT",
            `Engine handshake timeout waiting for ${expectedResponsePrefix}`,
          ),
        );
      }, timeoutMs);

      post(cmd);
    });
  }

  const engine: Engine = {
    get capabilities() {
      return caps;
    },
    get state() {
      return currentState;
    },

    async init(): Promise<void> {
      if (currentState !== "uninitialised") return;

      if (opts?.workerFactory) {
        worker = opts.workerFactory();
      } else if (typeof Worker !== "undefined") {
        const workerPath =
          caps.flavor === "lite-multi"
            ? "/engine/stockfish-18-lite.js"
            : "/engine/stockfish-18-lite-single.js";
        worker = new Worker(workerPath);
      } else {
        currentState = "dead";
        return;
      }

      worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : String(e.data);
        handleMessage(line);
      };

      try {
        await sendCommandWaitResponse(
          "uci",
          "uciok",
          opts?.handshakeTimeoutMs ?? DEFAULT_UCI_TIMEOUT_MS,
        );
        post(`setoption name Threads value ${caps.maxThreads}`);
        post("setoption name Hash value 64");
        post("setoption name UCI_ShowWDL value false");
        await sendCommandWaitResponse(
          "isready",
          "readyok",
          opts?.handshakeTimeoutMs ?? DEFAULT_ISREADY_TIMEOUT_MS,
        );
        currentState = "ready";
      } catch (err) {
        currentState = "dead";
        if (worker) {
          worker.terminate();
          worker = null;
        }
        throw err;
      }
    },

    async setOptions(
      options: Record<string, string | number | boolean>,
    ): Promise<void> {
      if (currentState === "dead")
        throw new EngineError("ENGINE_DEAD", "Engine is dead");

      // Posting `setoption` mid-search is illegal UCI, so cancel and drain
      // through the same primitive `search()` uses.
      await quiesce("Search cancelled by setOptions");
      if (isDead()) throw new EngineError("ENGINE_DEAD", "Engine is dead");

      for (const [key, val] of Object.entries(options)) {
        post(`setoption name ${key} value ${val}`);
      }
      await sendCommandWaitResponse(
        "isready",
        "readyok",
        opts?.handshakeTimeoutMs ?? DEFAULT_ISREADY_TIMEOUT_MS,
      );
    },

    async search(
      fen: string,
      moves: string[],
      budget: SearchBudget,
      searchOpts?: {
        signal?: AbortSignal;
        onProgress?: (p: EngineProgress) => void;
      },
    ): Promise<SearchResult> {
      if (currentState === "dead")
        throw new EngineError("ENGINE_DEAD", "Engine is dead");
      if (searchOpts?.signal?.aborted)
        throw new EngineError("CANCELLED", "Search aborted before start");

      // Claim the generation synchronously, before any await, so two
      // overlapping search() calls can never both post a `go`.
      const generation = ++latestGeneration;
      await quiesce("Search cancelled by new search");

      if (latestGeneration !== generation)
        throw new EngineError("CANCELLED", "Search superseded before start");
      if (isDead())
        throw new EngineError("ENGINE_DEAD", "Engine died during cancellation");
      if (goQueue.length >= MAX_ORPHANED_GO) {
        const message = "Engine unresponsive: stale searches never completed";
        hardFail(message);
        throw new EngineError("ENGINE_DEAD", message);
      }

      currentState = "searching";

      return new Promise<SearchResult>((resolve, reject) => {
        const s: ActiveSearch = {
          id: ++searchSeq,
          resolve,
          reject,
          onProgress: searchOpts?.onProgress ?? null,
          watchdog: null,
          settled: false,
          progressData: {},
          lastProgressTime: 0,
        };
        activeSearch = s;
        // Token pushed before `go` is posted, in the same synchronous block, so
        // a bestmove can never arrive before its token exists.
        goQueue.push({ id: s.id, search: s });

        if (searchOpts?.signal) {
          s.signal = searchOpts.signal;
          s.onAbort = () => {
            if (activeSearch === s) {
              cancelActiveSearch("CANCELLED", "Search aborted");
            }
          };
          s.signal.addEventListener("abort", s.onAbort, { once: true });
        }

        const moveStr = moves.length > 0 ? ` moves ${moves.join(" ")}` : "";
        post(`position fen ${fen}${moveStr}`);

        let goCmd = "go";
        if (budget.depth !== undefined) goCmd += ` depth ${budget.depth}`;
        if (budget.nodes !== undefined) goCmd += ` nodes ${budget.nodes}`;
        if (budget.movetime !== undefined)
          goCmd += ` movetime ${budget.movetime}`;
        post(goCmd);

        const timeoutMs =
          opts?.watchdogMs ?? Math.max(budget.movetime ?? 0, 5000) * 5 + 5000;
        s.watchdog = setTimeout(() => {
          // A watchdog belonging to a superseded search is inert.
          if (s.settled || activeSearch !== s) return;
          const message = "Watchdog: Stockfish engine timed out";
          hardFail(message);
          settleSearch(s, {
            ok: false,
            error: new EngineError("WATCHDOG_TIMEOUT", message),
          });
        }, timeoutMs);
      });
    },

    stop(): void {
      cancelActiveSearch("CANCELLED", "Search cancelled by stop()");
    },

    dispose(): void {
      currentState = "dead";
      const s = activeSearch;
      goQueue = [];
      if (s) {
        settleSearch(s, {
          ok: false,
          error: new EngineError("DISPOSED", "Engine disposed"),
        });
      }
      rejectPendingHandshakes(new EngineError("DISPOSED", "Engine disposed"));
      notifyDrainWaiters();
      if (worker) {
        worker.onmessage = null;
        worker.terminate();
        worker = null;
      }
    },
  };

  return engine;
}
