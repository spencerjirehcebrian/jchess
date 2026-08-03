# 01 — Architecture

## Threading model

Three execution contexts. Everything else is a module inside one of them.

```
┌──────────────────────────────────────────────────────────────┐
│ MAIN THREAD                                                  │
│                                                              │
│   ┌──────────────┐         ┌──────────────────┐              │
│   │  React DOM   │         │    Renderer      │              │
│   │  (chrome)    │         │  (Three.js,      │              │
│   │              │         │   imperative)    │              │
│   └──────┬───────┘         └────────┬─────────┘              │
│          │ subscribe                │ subscribe              │
│          │                          │ emit square events     │
│   ┌──────▼──────────────────────────▼─────────┐              │
│   │           Store (Zustand)                 │              │
│   │  the single source of truth               │              │
│   └──────┬────────────────────────────────────┘              │
│          │ mutated only by                                   │
│   ┌──────▼────────────┐                                      │
│   │  Game Controller  │──────► Rules (chessops, pure)        │
│   └──────┬────────────┘                                      │
│          │ Engine adapter (Promise API)                      │
└──────────┼───────────────────────────────────────────────────┘
           │ postMessage — UCI text lines
    ┌──────▼──────────────────────────────┐
    │ ENGINE WORKER                       │
    │  Stockfish WASM                     │
    │  (spawns its own threads when       │
    │   cross-origin isolated)            │
    └─────────────────────────────────────┘
```

The multi-threaded Stockfish build spawns additional workers internally. Those are invisible above the adapter and must never be managed by application code.

## Component responsibilities

| Component | Owns | Must not |
|---|---|---|
| **Game controller** | All state transitions. Turn flow. Premove queue lifecycle. Clock. | Touch Three.js or the DOM. |
| **Rules** | Legality, SAN parse/serialize, FEN, relaxed premove generation. Pure, no state. | Know about the engine, the store, or rendering. |
| **Engine adapter** | Worker lifecycle, UCI serialization, search cancellation, strength config. | Read the store or know about game history. |
| **Store** | Current state. Subscriptions. | Contain logic beyond trivial selectors. |
| **Renderer** | Scene graph, camera, materials, animation, hit testing. | Mutate state. Call the engine. Compute legality. |
| **React chrome** | Move list, controls, dialogs, status, notation field. | Own game state. Render the board. |
| **Persistence** | PGN serialization, IndexedDB reads and writes. | Be on the critical path of a move. |

## Invariants

These hold at all times. Violating any of them is a bug, and each should have a test.

1. **The store is the only mutable state.** The renderer and DOM are pure functions of it.
2. **Only the game controller writes to the store.** Everything else emits intent.
3. **Every move applied to state has been validated by the rules layer** — including moves returned by the engine. The engine is treated as an untrusted external service.
4. **The rendered position may lag the state position during animation, but never diverges.** Cancelling an animation always snaps to the state position.
5. **At most one engine search is in flight.** Starting a new one cancels the previous and discards its result.
6. **The premove queue is empty whenever `status !== 'engine-thinking'`,** except in the single frame between the engine's reply arriving and the queue being drained.
7. **The board renders before the engine finishes loading.** First paint never blocks on WASM.

## Data flow: a normal move

```
1. User acts (click / drag / Enter in notation field)
2. → Input layer emits a candidate Move
3. → Controller validates against Rules
4.   ├─ illegal → reject, emit feedback, state unchanged
5.   └─ legal   → append to state.moves, status = 'engine-thinking'
6. → Store notifies subscribers
7. → Renderer diffs, starts move animation
8. → Controller calls engine.bestMove(position, budget)
9. → [engine searches on worker thread; UI stays interactive]
10. → Engine resolves with a UCI move
11. → Controller parses and validates against Rules
12.   ├─ illegal → log loudly, abort game with error state
13.   └─ legal   → append to state.moves, status = 'human-turn'
14. → Renderer animates engine move
15. → Controller drains premove queue (see 08-input.md)
16. → Persistence writes PGN (debounced, off critical path)
```

Step 12 is not defensive theatre. A mismatched position or a stale search result will produce an illegal move, and silently rendering it corrupts the game invisibly.

## Data flow: premove execution

```
Engine move arrives
  → apply engine move to state
  → start engine move animation
  → premove queue non-empty?
      no  → done, status = 'human-turn'
      yes → pop head
            → validate strictly against new position
                illegal → clear ENTIRE queue, done
                legal   → cancel engine animation to completion
                        → apply premove
                        → animate premove
                        → status = 'engine-thinking'
                        → engine.bestMove(...)
```

The cancel-to-completion in the legal branch is why animation interruptibility (`07-animation.md`) is a hard requirement and not polish.

## Loading sequence

Ordered to get pixels on screen fast and never block on the engine.

```
t=0    HTML + CSS parse. Static shell paints (board frame, empty panels).
t≈1    JS bundle executes. Store initialises. Rules layer ready.
t≈2    Renderer boots. Voxel geometry generated procedurally (~15ms).
       Board and pieces render in the starting position. INTERACTIVE.
t≈3    Engine worker spawned in the background.
       Capability detection runs. Correct flavor selected and fetched.
t≈4    Engine reports `uciok` / `readyok`. Difficulty options applied.
       Engine-dependent controls enable.
```

Between t≈2 and t≈4 the user can move pieces, browse, and change settings. Only "start game" is disabled, with a visible loading state. Do not show a full-page spinner at any point.

## Failure modes

| Failure | Behaviour |
|---|---|
| WASM unsupported | Show a blocking, explanatory message. Board still renders. No fallback to asm.js in v1. |
| Not cross-origin isolated | Silently load the single-threaded flavor. Cap the difficulty ladder at level 6. Show a one-line note in settings explaining why the top rungs are unavailable. |
| Engine fetch fails | Retry twice with backoff. Then offer a manual retry. Board and history browsing remain usable. |
| Engine returns illegal move | Log the full position, the move, and the last 20 UCI lines. Halt the game with an error state and offer to restart. Do not attempt recovery. |
| Engine times out (no `bestmove` within budget × 5 + 5s) | Cancel, restart the worker, retry once. On second failure, halt with error state. |
| IndexedDB unavailable (private mode, quota) | Run fully in memory. Disable resume. No error dialog; note it in settings. |
| WebGL context lost | Listen for `webglcontextlost`, prevent default, rebuild the scene on `webglcontextrestored`. State is untouched, so the position survives. |

## Configuration

The app is configured at **runtime**, not build time, so one image serves every deployment. A `/config.js` file is generated by the container entrypoint from environment variables and loaded before the bundle.

```typescript
interface RuntimeConfig {
  defaultDifficulty: number      // 1-8
  maxPremoves: number            // default 3
  enableClocks: boolean          // default false
  analyticsUrl?: string          // optional, none by default
}
```

Access it through a single typed accessor with defaults for every field. The app must run correctly if `/config.js` is missing entirely.
