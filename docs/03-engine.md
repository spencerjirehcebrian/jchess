# 03 — Engine

## Adapter interface

Everything above `src/engine/` talks only to this. It is the seam that keeps a future server-side engine from being a rewrite.

```typescript
interface SearchBudget {
  nodes?: number
  movetime?: number      // ms
  depth?: number
}

interface SearchResult {
  move: string           // UCI format, e.g. "g1f3", "e7e8q"
  ponder?: string
  depth: number
  scoreCp?: number       // centipawns, from side-to-move POV
  scoreMate?: number     // mate in N, signed
}

interface EngineProgress {
  depth: number
  nodes: number
  nps: number
  scoreCp?: number
  scoreMate?: number
  pv?: string[]
}

interface Engine {
  readonly capabilities: EngineCapabilities

  init(): Promise<void>
  setOptions(options: Record<string, string | number | boolean>): Promise<void>

  search(
    fen: string,
    moves: string[],           // moves from `fen` to the current position
    budget: SearchBudget,
    opts?: {
      signal?: AbortSignal
      onProgress?: (p: EngineProgress) => void
    }
  ): Promise<SearchResult>

  stop(): void
  dispose(): void
}

interface EngineCapabilities {
  threaded: boolean
  maxThreads: number
  flavor: 'lite-multi' | 'lite-single'
}
```

**Why `fen` plus `moves` rather than just a FEN:** sending the move history lets Stockfish keep its transposition table warm and detect repetitions correctly. Use `position fen <fen> moves <m1> <m2> ...` where `fen` is the game's starting position.

## Capability detection

Run once at boot, before spawning the worker.

```typescript
function detectCapabilities(): EngineCapabilities {
  const threaded =
    typeof SharedArrayBuffer !== 'undefined' &&
    self.crossOriginIsolated === true

  const maxThreads = threaded
    ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))
    : 1

  return {
    threaded,
    maxThreads,
    flavor: threaded ? 'lite-multi' : 'lite-single'
  }
}
```

Notes:

- **Check `crossOriginIsolated`, not just `SharedArrayBuffer`.** The constructor can exist while remaining unusable.
- **Cross-origin isolation requires a secure context.** Over plain HTTP on an IP address it will be false even with the headers set. This is the single most common deployment surprise; see `10-deployment.md`.
- **Cap threads at 4.** Beyond that the lite build's returns fall off sharply and you are just draining battery. Always leave one core for the main thread.
- Feature-detect and fall back silently. Never show an error for the single-threaded path.

## Lifecycle

```
init()
  ├─ detectCapabilities()
  ├─ new Worker(<flavor path>)
  ├─ send "uci"        → wait for "uciok"      (timeout 15s)
  ├─ send "setoption name Threads value <n>"
  ├─ send "setoption name Hash value 64"
  ├─ send "setoption name UCI_ShowWDL value false"
  ├─ send "isready"    → wait for "readyok"    (timeout 10s)
  └─ resolve
```

`Hash value 64` (MB) is a deliberate compromise: enough to matter, small enough not to be a problem on a phone. Do not scale it with `deviceMemory`; the variance is not worth the complexity.

**Warning from the package authors: the engine can hang if the UCI protocol is misused.** Specifically, do not change options while a search is running, and do not start a second search before the first has returned `bestmove`. Enforce this in the adapter with an explicit state machine rather than trusting callers:

```
State: 'uninitialised' | 'ready' | 'searching' | 'stopping' | 'dead'
```

- `search()` while `searching` → call `stop()`, await the in-flight `bestmove`, discard it, then start the new search. Do not fire both.
- `setOptions()` while `searching` → await quiescence first.
- Any transition from `dead` → throw.

## Search and cancellation

```
search(fen, moves, budget, { signal })
  ├─ assert state === 'ready'
  ├─ state = 'searching'
  ├─ send "position fen <fen> moves <moves...>"
  ├─ send "go" + budget flags
  ├─ if signal.aborted at any point → send "stop"
  ├─ parse "info" lines → onProgress
  └─ on "bestmove <move> [ponder <move>]"
       ├─ state = 'ready'
       └─ resolve (or reject if aborted)
```

Budget flags, in the order they are appended:

| Budget field | UCI |
|---|---|
| `nodes` | `go nodes <n>` |
| `movetime` | `go movetime <ms>` |
| `depth` | `go depth <d>` |

If more than one is set, combine them (`go depth 8 nodes 100000`) — Stockfish honours whichever limit is hit first.

**Prefer `nodes` over `movetime` for strength control.** Node counts are device-independent, so level 4 plays identically on a phone and a desktop. Use `movetime` only as a safety ceiling.

**Watchdog.** Arm a timer at `max(budget.movetime ?? 0, 5000) * 5 + 5000` ms. If `bestmove` has not arrived, terminate the worker, set state to `dead`, and surface a recoverable error. A hung Stockfish worker will otherwise sit at 100% CPU indefinitely.

## Difficulty ladder

Difficulty is a config object, never a bare number. Depth-capping alone produces an opponent that plays perfectly then blunders in ways no human would, which reads as broken rather than beatable.

```typescript
interface DifficultyLevel {
  id: number                                    // 1-8
  label: string
  approxElo: number
  uciOptions: Record<string, string | number>
  budget: SearchBudget
  thinkTimeFloorMs: [min: number, max: number]  // artificial delay range
  requiresThreads: boolean
}
```

### The eight levels

| # | Label | ~Elo | `Skill Level` | `UCI_LimitStrength` | `UCI_Elo` | Nodes | Depth cap | Think floor (ms) |
|---|---|---|---|---|---|---|---|---|
| 1 | Beginner | 800 | 0 | true | 1320 | 8,000 | 4 | 500–900 |
| 2 | Casual | 1100 | 3 | true | 1400 | 20,000 | 6 | 450–800 |
| 3 | Club | 1400 | 6 | true | 1600 | 50,000 | 8 | 400–750 |
| 4 | Strong club | 1700 | 10 | true | 1800 | 150,000 | 10 | 350–700 |
| 5 | Expert | 2000 | 14 | true | 2100 | 400,000 | 14 | 300–650 |
| 6 | Master | 2300 | 18 | true | 2400 | 1,200,000 | 18 | 250–600 |
| 7 | Grandmaster | 2600 | 20 | false | — | 5,000,000 | — | 200–500 |
| 8 | Maximum | max | 20 | false | — | — | — | 0–0 |

Level 8 uses `movetime: 2000` instead of a node budget, since it is bounded by wall clock rather than a strength target.

Levels 7 and 8 set `requiresThreads: true`. Without cross-origin isolation, hide them and show a one-line explanation in settings.

**`UCI_Elo` has a floor of roughly 1320** in modern Stockfish. Below that, `Skill Level 0` combined with a very small node budget is what actually produces beginner play. Verify the accepted range by reading the engine's `option` lines during `uci` handshake rather than assuming; log them at startup in dev.

### Calibration

The Elo figures above are estimates. After the ladder is implemented, run the self-play harness in `11-testing.md` and adjust the node budgets — not the `UCI_Elo` values — until the gaps between adjacent rungs feel even. Record the calibrated numbers in `DECISIONS.md`.

### Artificial think time

An engine that answers in 30ms feels like a lookup table, not an opponent. After the search resolves, delay the move by a uniform random value in `thinkTimeFloorMs` **minus** the time the search actually took, floored at zero.

```typescript
const elapsed = performance.now() - searchStart
const target = randBetween(...level.thinkTimeFloorMs)
const delay = Math.max(0, target - elapsed)
```

Two rules:

1. The delay is cancellable. A takeback or a new game during the delay must abort it.
2. Do not apply it at level 8. At maximum strength, thinking time is real and should be shown honestly.

## Progress reporting

Parse `info` lines and throttle `onProgress` to at most 10Hz. The renderer maps reported depth to the ambient "thinking" intensity described in `07-animation.md`.

Relevant `info` fields: `depth`, `nodes`, `nps`, `score cp <n>`, `score mate <n>`, `pv <moves...>`.

Two rules the throttle has to keep, both learned by getting them wrong:

- **Never report a line with no depth.** Stockfish opens a search with `info string NNUE evaluation using ...`, which carries none. Reporting it arms the throttle with a reading of zero and swallows every real depth that arrives inside the window — and levels 1–3 finish an entire search inside 100ms, so the caller sees one zero and nothing else.
- **Flush once before settling.** The deepest iteration always lands closest to `bestmove`. Without a final unthrottled emit, the reading a caller is left looking at is whatever happened to fall on a throttle boundary.

`SearchResult` also carries the settled search's own `depth`, `scoreCp` and `scoreMate`. Prefer it over the last progress callback when recording anything against the move: it is the reading the move was actually chosen on.

### The telemetry store

Progress lands in `src/store/telemetry.ts`, a zustand store separate from the game store. Two reasons, and both are load-bearing:

- Every component in the rail subscribes to the whole game store, so telemetry there would repaint the transcript at 10Hz.
- `App` subscribes to the game store and writes the game to storage on every change. Telemetry is an instrument reading, not game state, and has no business in the persistence path.

Consumers **quantise in the selector** (`useTelemetry(searchCells)`), so zustand's identity check absorbs the feed and a component re-renders only when the value it draws actually changes.

**Scores are normalised to white-positive on the way in.** UCI reports relative to the side to move and the engine only searches on its own turn, so what arrives is engine-relative. The controller knows the engine's colour and negates once, at the single write site. Get this backwards and every readout in the app is confidently, precisely wrong in the opposite direction — so both colours are asserted in `tests/unit/telemetry.test.ts`.

Do not display raw evaluation to the user during play at any difficulty. It is recorded onto the ply the search produced (`HistoryEntry.evalCp` / `evalMate`, white-positive) and revealed only once `status.kind === "over"`. Evals do not survive a resume: a PGN is rebuilt from notation and carries no instrument readings, so the readout renders nothing rather than a fabricated zero.

## Validation of engine output

Every move returned by the engine passes through the rules layer before touching state. Reject and halt on failure — see `01-architecture.md`, failure modes.

Specific cases to handle:

- `bestmove (none)` — returned in terminal positions. Should never occur, since the controller checks for game end before searching. If it does, halt with an error; it means the position sent was stale.
- `bestmove 0000` — null move. Same treatment.
- Promotion suffix — UCI uses lowercase (`e7e8q`). Ensure your parser handles all four pieces.
- Castling — the lite builds report standard castling as king-to-castling-square (`e1g1`). Confirm during integration and normalise in the adapter, since `chessops` internally uses king-takes-rook for Chess960 compatibility.

## Testing hooks

The adapter must accept an injected worker factory so tests can substitute a scripted fake:

```typescript
function createStockfishEngine(opts?: {
  workerFactory?: () => Worker
  capabilities?: EngineCapabilities
}): Engine
```

Every test above `src/engine/` uses the fake. Only `tests/e2e` exercises real Stockfish.
