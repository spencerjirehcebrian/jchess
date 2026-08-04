# 11 — Testing

## Strategy

Weight testing toward the layers where bugs are silent and expensive: rules, premove legality, SAN parsing, and animation cancellation. Do not chase coverage on the renderer or React components — visual correctness is verified by looking at it, and brittle DOM tests slow the build for no benefit.

| Layer | Approach | Coverage target |
|---|---|---|
| `core/` | Unit, exhaustive, fixture-driven | 95% |
| `engine/` | Unit against a scripted fake worker | 85% |
| `store/controller` | Unit, state-machine transitions | 90% |
| `render/animation` | Unit, cancellation invariants | 80% |
| `render/voxel` | Unit, structural validation | 80% |
| `render/` other | Smoke test only (boots, renders, disposes) | — |
| `ui/` | No unit tests | — |
| End-to-end | Playwright, critical paths only | 8 scenarios |

## Fixtures

`tests/fixtures/positions.ts` — a named set of FENs exercising every edge case. Build this first; almost every other test depends on it.

Required positions:

| Name | Purpose |
|---|---|
| `START` | Standard start |
| `EN_PASSANT_AVAILABLE` | EP capture legal |
| `EN_PASSANT_PINNED` | EP capture illegal due to horizontal pin on the rank |
| `CASTLE_ALL_RIGHTS` | All four castles legal |
| `CASTLE_THROUGH_CHECK` | Castling illegal, adjacent square attacked |
| `CASTLE_RIGHTS_LOST` | Rook moved, right revoked |
| `PROMOTION_PUSH` | Pawn on 7th, empty 8th |
| `PROMOTION_CAPTURE` | Promotion by capture, two options |
| `UNDERPROMOTION_MATE` | Only knight promotion mates |
| `DISAMBIGUATION_FILE` | Two knights, needs `Nbd2` |
| `DISAMBIGUATION_RANK` | Two rooks on a file, needs `R1e2` |
| `DISAMBIGUATION_BOTH` | Three queens, needs `Qh4e1` |
| `PINNED_PIECE` | Piece absolutely pinned |
| `DOUBLE_CHECK` | Only king moves legal |
| `STALEMATE` | No legal moves, not in check |
| `INSUFFICIENT_KN_K` | K+N vs K |
| `INSUFFICIENT_KB_KB_SAME` | Same-coloured bishops |
| `SUFFICIENT_KB_KB_OPP` | Opposite-coloured bishops, not a draw |
| `FIFTY_MOVE_PENDING` | Halfmove clock at 99 |
| `THREEFOLD_PENDING` | Two repetitions on the board |
| `MATE_IN_ONE` | For engine sanity checks |
| `BACK_RANK_MATE` | Common tactical shape |

## Unit tests

### `core/rules`

- Every fixture: legal move count matches a hand-verified expected value.
- SAN round-trip: `fromSan(toSan(m)) === m` for every legal move in every fixture.
- UCI round-trip, including all four promotion suffixes.
- FEN round-trip for every fixture.
- `outcome()` returns the correct result and reason for every terminal fixture.
- Threefold detection compares only the first four FEN fields.
- Insufficient material covers all four cases plus the opposite-bishop negative.

### `core/premove`

This is the most bug-prone module. Test it hardest.

- Knight on `d4`: exactly 8 destinations. On `a1`: exactly 2.
- Rook with an own piece at range: ray stops at the own piece.
- Rook with an enemy piece at range: ray continues past it to the board edge.
- Pawn on `e2`: `e3`, `e4`, `d3`, `f3` — four destinations, regardless of current occupancy of the diagonals.
- Pawn on `e2` with an own piece on `e3`: no forward pushes, diagonals still offered.
- Pawn on `e7`: all destinations offered with all four promotion options.
- King: exactly 8 neighbours regardless of attacked squares.
- King with castling rights: castle destinations offered even when currently in check.
- King with castling rights revoked: castle destinations absent.
- Absolutely pinned piece: full relaxed destination set offered (self-check is not evaluated).
- **Superset property:** for every fixture and every legal opponent reply, every move legal in the resulting position appears in the relaxed destination set. Generate this exhaustively over a handful of fixtures — it is the correctness definition of the whole module.

### `core/san-parser`

- Every accepted form from `08-input.md` parses to the expected move.
- Prefix matching narrows correctly: `''` → all, `'N'` → knight moves only, `'Nf'` → knights reaching f-squares, `'Nf3'` → exactly one.
- Lowercase `b` ambiguity flagged when both interpretations match, resolved when only one does.
- Optional `x`: `ed5` matches `exd5`.
- `+` and `#` accepted and ignored.
- Illegal but well-formed input (`Nf9`, `Zz1`) returns zero candidates, does not throw.
- Empty buffer returns all legal moves and `exactMatch: null`.

### `engine/`

Against a scripted fake worker that replays canned UCI transcripts.

- `init()` resolves after `uciok` and `readyok`; rejects on timeout.
- Options are sent before `isready`.
- `search()` while already searching: sends `stop`, awaits the first `bestmove`, discards it, then starts the new search. Assert only one search is in flight at any point.
- `setOptions()` during a search waits for quiescence.
- `AbortSignal` triggers `stop` and rejects the promise.
- Watchdog fires and marks the engine `dead` when `bestmove` never arrives.
- `bestmove (none)` and `bestmove 0000` are rejected.
- `info` line parsing extracts depth, nodes, nps, cp score, mate score, pv.
- Progress callbacks throttled to ≤ 10Hz.
- Capability detection returns `lite-single` when `crossOriginIsolated` is false.

### `store/controller`

- Illegal move from the input layer leaves state untouched.
- Illegal move from the engine transitions to `error`, not to a corrupted position.
- Premove drain, all branches: empty queue, legal head, illegal head clears the whole queue.
- Premove queue cleared on each of the documented cancellation triggers.
- Takeback removes two plies (engine's and human's) and cancels any in-flight search.
- Moving while `cursor < history.length` is rejected and does not truncate history.
- Game-over detection fires before an engine search is requested.

### `render/animation`

- `start()` on a target with an in-flight animation calls the previous animation's `complete()` exactly once.
- `cancelAll()` leaves every piece at its state-derived position. Test with a scripted sequence of five overlapping moves at 30ms intervals.
- `complete()` is idempotent.
- `tick()` allocates nothing — assert via a heap-delta check across 1000 ticks.
- Reduced motion zeroes all durations.
- `tick()` with 32 concurrent animations completes under 2ms.

### `render/voxel`

The seven structural validations listed in `05-voxel-assets.md`.

## End-to-end (Playwright)

Eight scenarios. Run against the **local Vite dev/preview server** (`npm run preview`), ensuring headers configuration is verified locally.

1. **Load and play.** App loads, engine reaches ready, play `e4`, engine replies, board updates.
2. **Full game to mate.** Level 1, scripted human moves reaching a back-rank mate. Result banner shows, game state is `over`.
3. **Notation input.** Type `Nf3`, verify candidate highlighting at each keystroke, press Enter, verify the move applies.
4. **Notation rejection.** Type `Nf9`, press Enter, verify the shake, verify the text remains, verify state is unchanged.
5. **Premove success.** During engine thinking, premove a move that stays legal. Verify it fires immediately on the engine's reply.
6. **Premove cancellation.** Premove a move the engine's reply invalidates. Verify the entire queue clears and the error flash appears.
7. **Persistence.** Play three moves, reload, verify the game is back on the board with no prompt of any kind, and that a timed game comes back with its clocks.
8. **Reduced motion.** With `prefers-reduced-motion: reduce` emulated, play a move and verify no animation frames are scheduled beyond the first.

Additionally, a **headers assertion test** hitting the local server:
- `/` and `/assets/*` both carry COOP and COEP (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`).
- `.wasm` served as `application/wasm`.

## Engine calibration harness

Not a test — a script, `scripts/calibrate.ts`, run manually to tune the difficulty ladder.

- Plays N games (default 40) between adjacent ladder rungs.
- Reports win/draw/loss and an estimated Elo gap.
- Target: 250–350 Elo between adjacent rungs, evenly spaced.
- Adjust **node budgets**, not `UCI_Elo` values, and record the calibrated numbers in `DECISIONS.md`.

Run this once the ladder is implemented and again if the Stockfish version changes.

## Performance assertions

Automated in CI where possible, manually verified otherwise.

| Metric | Target | How |
|---|---|---|
| Voxel geometry generation, all 12 | < 30ms | Unit test with `performance.now()` |
| Scene boot to first render | < 80ms | Playwright performance trace |
| Idle frames scheduled | 0 | Playwright: instrument `requestAnimationFrame`, idle 3s, assert zero calls |
| Animator tick, 32 pieces | < 2ms | Unit test |
| Draw calls | < 15 | Assert `renderer.info.render.calls` after a render |
| Triangles | < 60,000 | Assert `renderer.info.render.triangles` |
| Bundle size, excluding engine | < 300KB gzipped | Local check on build output |

## Local / CI pipeline

```
1. Install, typecheck (tsc --noEmit), lint
2. Unit tests (vitest), coverage gate per the table above
3. Build (`npm run build`); assert bundle size budget
4. Playwright e2e against local dev/preview server
```

Steps 4–6 are the ones that catch deployment bugs. Do not skip them to save CI minutes; a broken header configuration is invisible until it reaches a real browser over HTTPS.
