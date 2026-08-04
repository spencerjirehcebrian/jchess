# DECISIONS.md

Running log of architectural choices and pinned dependency versions.

## Pinned Dependencies

- `three`: ^0.185.1
- `chessops`: ^0.15.1
- `stockfish`: ^18.0.8 (using `stockfish-18-lite.js` / `.wasm` and `stockfish-18-lite-single.js` / `.wasm`)
- `zustand`: ^5.0.14
- `react` / `react-dom`: ^19.2.8
- `idb`: ^8.0.3
- `vite`: ^8.2.0
- `typescript`: ^7.0.2
- `vitest`: ^4.1.10
- `@playwright/test`: ^1.62.1
- `vite-plugin-compression`: ^0.5.1

## Stockfish File Strategy

Stockfish 18 artifact filenames:
- Lite multi-threaded: `stockfish-18-lite.js` and `stockfish-18-lite.wasm`
- Lite single-threaded: `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm`

Copied at build/dev setup into `public/engine/`.

## Licence Strategy

Stockfish is GPL-3.0. The licence file is bundled in `/licenses/GPL-3.0.txt` and linked from the UI footer. Application source code is released under GPL-3.0.

## Piece Identity in the Renderer

`PieceManager` keys rendered pieces on the square they occupy, and only two
things move them: `syncPosition`, which reconciles square by square and never
migrates a mesh between squares, and `applyMove`, which is told exactly which
mesh went where by the caller that already derived it.

This replaced matching by `(role, colour)` with an insertion-order fallback.
With no identity to appeal to, that scheme could hand a square the wrong mesh
and then sweep the right one out of the scene, so pieces disappeared from the
board while the position still held them. Anything that needs the board to
change must go through one of those two methods; do not reintroduce a matcher
that guesses which mesh a square wants.

Cancelling a move animation runs the same settle path as finishing one,
including the captured and rook meshes, and fires `onComplete`. A move that is
interrupted has still happened — the position already contains it.

## PGN Is the Storage Format

`src/storage/` stores each game as PGN plus a few columns (id, difficulty,
human colour, updatedAt, completed), not as a serialized `GameState`. That is
what `docs/04-game-core.md` asks for, and the reason holds: a stored
`GameState` breaks silently the first time a field is added, renamed or
retyped, whereas PGN is a format that outlives the program and that a person
can open.

The cost is that everything PGN does not carry has to be recomputed on the way
back in — the FEN after each ply, what was captured, check and mate. That code
already had to exist for live moves, so `buildHistoryEntry` in `core/rules.ts`
is now the single place it lives, shared by the human's move, the engine's
reply, the premove drain, and resume.

Resume is offered, never applied. An unexpected board on load is disorienting,
and the prompt costs one click that a wrong guess would cost far more than.

A resumed game comes back **without a clock**. PGN carries no time, and handing
back a full initial allowance would be a cheat.

Storage is the one part of the app allowed to fail silently. No IndexedDB means
no records, no resume prompt, a note in settings, and an otherwise identical
game — never an error dialog.

## Clocks Are Derived, Never Decremented

`ClockState` stores what each side had banked when the current turn began plus
when that turn began; remaining time is computed from a monotonic clock on
every read (`core/clock.ts`). Nothing counts down. A counter driven by
`setInterval` drifts, and stops when the tab is backgrounded — which is exactly
when a player most needs their flag to have fallen. The 100ms interval in
`Clock.tsx` only decides how often to repaint.

Flag fall is watched on a timer *and* on `visibilitychange`, because a hidden
tab throttles its timers to roughly once a minute, so the check on the way back
is often the one that catches it. Either path reads the same derived value, so
the flag falls at the right moment regardless.

Three choices the docs left open:

- **Presets are `off`, `3+2`, `5+0`, `10+0`**, defaulting to off. Clocks were
  spec'd optional and off by default (`RuntimeConfig.enableClocks`); a settings
  picker goes beyond that, on the grounds that a runtime flag nobody can reach
  is not a feature.
- **A change applies to the next new game, and the panel says so.** Rewriting a
  running clock would either hand back time already spent or take away time
  someone was counting on. Saying it is better than disabling the control and
  leaving the player to guess why.
- **A takeback does not refund time.** It returns the position, not the minutes
  spent choosing the move; the clock simply starts again for whoever is on move.

## Two Typefaces

Archivo names things (wordmark, players, and every control, set condensed and
uppercase); Departure Mono states them (moves, clocks, notation, coordinates).

IBM Plex Sans was dropped. `docs/09-ui-design.md` had assigned it prose,
buttons and settings, but the app has almost no prose, so in practice it only
ever appeared on the controls — the most-looked-at chrome — with no
relationship to the display face or to the board.

## Drag Deviations from docs/08-input.md

The drag implementation follows the spec's state machine, 4px threshold,
`setPointerCapture`, `0.6 * squareSize` lift, and legal-target-only highlight.
Two deliberate departures:

- **The contact shadow shrinks and dims with height rather than enlarging.**
  The spec asks for an enlarged, softened shadow, but the move-arc animation
  already shrinks and dims (`animation/engine.ts`), and a dragged piece and a
  moving piece should read the same way. Consistency won.
- **A drag skips the flight but keeps the landing.** See below.
- **The threshold and the lift are split by pointer type.** See below.

## A Finger Is Not a Cursor

`docs/08-input.md` gives one drag threshold (4px) and one lift
(`0.6 * squareSize`). Both are right for a device that reports a point and
occludes nothing, and both are wrong for a fingertip.

- **Threshold: 4px for mouse and pen, 10px for touch.** A finger reports the
  centroid of a contact patch, and that centroid wanders several pixels during
  an ordinary tap. At 4px half the taps on a piece became one-pixel drags that
  ended where they started.
- **Lift: 0.6 for mouse and pen, 1.4 for touch.** At 0.6 the held piece sits
  entirely underneath the hand holding it. Measured against a 9mm contact patch
  at a mobile viewport: 0.6 clears only the crown, 1.0 the crown and collar, 1.4
  the whole piece. Beyond 1.4 it stops reading as held above its square.

Both live in `render/drag.ts` as `dragThresholdFor` / `dragLiftFor`, so the
split is one decision in one place rather than a scatter of `pointerType`
checks. `tests/e2e/touch-drag.spec.ts` runs on a touch-enabled Playwright
project and is the regression that a finger can move a piece at all.

## Travel and Arrival

The move animation does two jobs, and they are not interchangeable.

**Travel** — the arc, the lean, the lag — is *information*: "a piece went from A
to B." It exists to tell you about a move you did not make. A drag has already
delivered that, so replaying the arc reads as a rewind, and `arrival` mode skips
it.

**Arrival** — the landing squash, the thud, the board shake, and on a capture the
debris, the ring and the victim's tumble — is *consequence*. It happens because a
heavy object met the board, which is equally true when a hand carried it. It
fires either way.

Both run through the same `animateMove` in `render/animation/engine.ts`,
separated only by an `AnimPhases` object saying when the piece touches down.
Travel impacts in mid-flight and settles at the end; an arrival lands and impacts
on the same frame, then stands there while its victim finishes falling apart.
Do not add a second animation path for drops — the shared timeline is what
guarantees a capture you made by hand shatters exactly like one you watched.

An earlier revision suppressed the whole animation on a drag. Dragged captures
were silent, and released pieces teleported from the hand to the square centre.
