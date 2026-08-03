export interface SearchBudget {
  nodes?: number | undefined;
  movetime?: number | undefined; // ms
  depth?: number | undefined;
}

export interface SearchResult {
  move: string; // UCI format, e.g. "g1f3", "e7e8q"
  ponder?: string | undefined;
  depth: number;
  scoreCp?: number | undefined; // centipawns
  scoreMate?: number | undefined; // mate in N
}

export interface EngineProgress {
  depth: number;
  nodes: number;
  nps: number;
  scoreCp?: number | undefined;
  scoreMate?: number | undefined;
  pv?: string[] | undefined;
}

export interface EngineCapabilities {
  threaded: boolean;
  maxThreads: number;
  flavor: "lite-multi" | "lite-single";
}

export type EngineState =
  "uninitialised" | "ready" | "searching" | "stopping" | "dead";

export type EngineErrorCode =
  | "CANCELLED" // superseded by a newer search, stop(), or an abort signal
  | "DISPOSED" // dispose() while a search was in flight
  | "ENGINE_DEAD"
  | "WATCHDOG_TIMEOUT"
  | "ILLEGAL_OUTPUT"
  | "HANDSHAKE_TIMEOUT";

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

/**
 * True for errors that mean "this result is no longer wanted", as opposed to
 * "something broke". Callers must not surface these as user-visible errors.
 */
export function isSearchCancelled(err: unknown): boolean {
  return (
    err instanceof EngineError &&
    (err.code === "CANCELLED" || err.code === "DISPOSED")
  );
}

export interface Engine {
  readonly capabilities: EngineCapabilities;
  readonly state: EngineState;

  init(): Promise<void>;
  setOptions(options: Record<string, string | number | boolean>): Promise<void>;

  search(
    fen: string,
    moves: string[],
    budget: SearchBudget,
    opts?: {
      signal?: AbortSignal;
      onProgress?: (p: EngineProgress) => void;
    },
  ): Promise<SearchResult>;

  stop(): void;
  dispose(): void;
}
