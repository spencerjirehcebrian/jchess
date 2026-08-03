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
