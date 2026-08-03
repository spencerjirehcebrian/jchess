# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project

**jchess** — browser voxel chess vs. Stockfish 18 WASM. No backend. Three.js renders the board imperatively (not React); React only draws the surrounding chrome.

## Commands

```bash
npm install              # postinstall copies Stockfish .js/.wasm into public/engine/ — required before dev works
npm run dev              # Vite on :5173
npm run build            # tsc && vite build
npm run preview

npm test                 # vitest run (unit + integration)
npm run test:watch
npm run test:coverage
npx vitest run tests/unit/rules.test.ts          # single file
npx vitest run -t "rejects illegal human move"   # single test by name

npm run test:e2e                                       # playwright; auto-starts `npm run dev`
npx playwright test tests/e2e/app-load.spec.ts         # single spec

npm run lint             # tsc --noEmit && eslint .
npm run format
```

`eslint.config.js` currently ignores `src/**` and `tests/**`, so `npm run lint` is effectively a type-check. Treat `tsc --noEmit` as the real gate.

The dev and preview servers set COOP/COEP headers (`vite.config.ts`). Without them `crossOriginIsolated` is false, the engine silently falls back to the single-threaded WASM flavor, and difficulty 7–8 (`requiresThreads`) are unbacked. Any alternate static server used for testing must send the same headers.

## Architecture

Three execution contexts: main thread (React + Three.js renderer), the Zustand store, and the Stockfish worker. `docs/01-architecture.md` is the authoritative spec; the invariants there are enforced by tests.

Load-bearing rules:

- **`GameController` (`src/store/controller.ts`) is the only writer to the store.** UI and renderer emit intent by calling controller methods; they never call `setState`.
- **Every move is validated through `src/core/rules.ts` before it enters state — including engine moves.** An illegal engine reply transitions `status` to `{ kind: "error" }` rather than being applied. This is an invariant, not defensive padding.
- **`src/core/**` is pure**: no DOM, no Three.js, no store, no engine imports. `src/render/**` must not import from `src/ui/**`.
- **The renderer subscribes to the store outside React** (`Renderer.attach()` in `src/render/index.ts`). `BoardCanvas.tsx` just owns the canvas element and the `Renderer` lifetime.

Flow of a move: input → `controller.makeMove()` → validate → append to `history`, `status = engine-thinking` → store notifies → renderer animates → `engine.search()` → validate reply → apply → drain premove queue.

### Square and move conventions

Squares are `0-63`, `a1 = 0`, index `= rank * 8 + file`. Castling is represented by the **king's destination square** (6/2/62/58), not chessops' king-takes-rook encoding. `rules.ts` translates at every chessops boundary (`legalMovesFrom`, `fromSan`, `fromUci`); `render/index.ts` re-derives the rook's from/to when it detects a two-file king move. Any new code touching castling must follow the same convention.

### Premoves

`src/core/premove.ts` implements *relaxed* generation, deliberately different from legality: rays pass **through** enemy pieces (the position will have changed by execution time) but stop at own pieces; self-check is not evaluated; castling destinations are offered whenever rights exist. Premoves are queued while `status` is `engine-thinking`/`engine-delaying` and drained in `applyEngineMove`: legal head → apply and search again; illegal head → clear the **entire** queue.

### Engine

`src/engine/stockfish.ts` wraps the worker behind the `Engine` interface. At most one search in flight — a new `search()` stops the old one and discards its result. A watchdog (`movetime × 5 + 5s`) terminates the worker and marks it `dead`. `capability.ts` picks `lite-multi` vs `lite-single` from `crossOriginIsolated`.

`src/core/difficulty.ts` holds the whole 8-rung ladder (UCI options, node/depth/movetime budgets, `thinkTimeFloorMs`). The floor is an *artificial* delay: after a fast search the controller parks in `status: engine-delaying` before applying the move, so the state machine has a fifth state most code must handle alongside `engine-thinking`.

### Renderer

Render-on-demand: a `dirty` flag plus rAF, no idle frames. `Renderer.attach()` diffs store updates against `prevCursor` — only a single forward step at the live cursor (`isLiveSingleMove`) animates; history browsing, takeback, and new games snap. Pieces are procedural voxel geometry: `render/voxel/pieces.ts` defines pieces as ASCII layer grids (`#` base, `+` accent, `-` shade, `o` detail → `Palette` fields), `mesher.ts` face-culls them into `BufferGeometry` at `VOXEL_SIZE = 1/13` world units per voxel. Themes live in `voxel/palette.ts` and drive both mesh colors and the CSS custom properties via `applyThemeToCss`.

## TypeScript

`strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`. `exactOptionalPropertyTypes` is why optional interface fields are written `foo?: T | undefined` throughout — keep that pattern or assignments fail. Prefer discriminated unions over optional fields for state (`GameStatus` in `src/core/types.ts` is the model). Tunable numbers belong in one exported place, not at call sites.

## Testing

- Vitest + happy-dom; `tests/setup.ts` stubs a WebGL context so Three.js can boot headless. `chessops` is inlined via `test.server.deps.inline`.
- `GameController` and `Renderer.attach()` duck-type their store argument: they accept either the Zustand hook or a plain object carrying `setState`. Unit tests use the plain-object form; integration tests pass `useGameStore`.
- Engine tests drive a scripted `FakeWorker` through `createStockfishEngine({ workerFactory })` — never a real WASM worker.
- React integration tests must wrap async engine init in `act()`; `App` kicks off `engine.init().then(startNewGame)` on mount.
- `docs/11-testing.md` lists the required fixtures and per-layer coverage targets. Weight tests toward `core/`, `store/controller`, and animation cancellation; the docs explicitly discourage renderer/UI coverage chasing.

## docs/ and DECISIONS.md

`docs/` is the pre-implementation spec, written as instructions to the implementing agent. It remains the reference for intent, but the tree has since diverged: there is no `src/input/` (pointer handling lives in `BoardCanvas.tsx`, SAN entry in `NotationInput.tsx`), persistence is `src/storage/index.ts` rather than `src/persistence/db.ts`, animation is `src/render/animation/{engine,debris,shake}.ts`, and `src/audio/` is undocumented there. Read the docs for rules and invariants, the code for structure.

`src/storage/` and `src/ui/DevConsole.tsx` are implemented and tested but not yet imported by `App.tsx` — persistence and resume are not wired up.

Per `docs/00-overview.md`: record any new dependency or any choice the docs left open in `DECISIONS.md`.
