# 12 — Build Plan

Nine milestones. Each ends in a **working, runnable, committed state**. No milestone leaves the app broken.

Local execution is verified via Vite dev server (`npm run dev`) and static preview (`npm run preview`). Docker and remote deployment are out of scope.

---

## M0 — Scaffold

**Goal:** an empty app that builds, tests, lints, and runs locally.

- Vite + React + TypeScript, strict mode, per `02-tech-stack.md`.
- Directory structure exactly as specified.
- ESLint boundary rules enforcing the import restrictions.
- Vitest and Playwright configured.
- Design tokens in `src/styles/tokens.css`. Fonts self-hosted as woff2 subsets.
- `DECISIONS.md` created with the pinned dependency versions.
- Local Vite dev server configured with cross-origin isolation headers (`COOP`/`COEP`).

**Done when:**
- `npm run build && npm run preview` (or `npm run dev`) serves the app locally.
- Unit tests run cleanly (`npm test`).
- `crossOriginIsolated` is `true` on `http://localhost:5173` (or local port) in the browser console.

---

## M1 — Rules and headless game loop

**Goal:** a complete, playable game with no rendering. Prove the engine and the ladder in a console.

- `core/types.ts`, `core/rules.ts`, `core/pgn.ts`.
- Test fixtures — all 22 positions from `11-testing.md`. Build these before the code that uses them.
- `engine/` — capability detection, adapter, UCI parsing, state machine, watchdog.
- `core/difficulty.ts` — the eight rungs.
- `store/` and `store/controller.ts` — turn flow, engine invocation, game-over detection.
- Copy Stockfish lite artifacts into `public/engine/`. **Confirm the actual filenames in the installed package.**
- A temporary dev console UI: a FEN display, a text input for moves, a move list.

**Done when:**
- A full game can be played to completion in the browser through the console UI.
- Both engine flavors load and play; forcing single-threaded produces a working, weaker game.
- All `core/` and `engine/` unit tests pass at the coverage targets.
- Engine returning an illegal move halts the game with an error state (test by injecting one via the fake worker).
- The app builds and runs cleanly via `npm run build && npm run preview`.

**Risk:** the Stockfish filenames and the exact `UCI_Elo` accepted range. Log the engine's `option` lines during handshake and read them.

---

## M2 — Voxel geometry and static render

**Goal:** the board and pieces on screen, correct and legible. No interaction.

- `render/voxel/pieces.ts` — **author the knight first.** If it does not read at 18 voxels with an 11×11 footprint, revisit the budget before authoring anything else.
- `render/voxel/mesher.ts` — face-culled cubes, baked directional shading into vertex colours.
- `render/voxel/palette.ts` — the Oxide theme plus two more.
- Board and frame geometry from the same mesher.
- `render/scene.ts` — orthographic camera at 57 degrees, lights, shadows.
- `render/pieces.ts` — stable piece identities, position from state.
- Render-on-demand loop.
- The seven structural validation tests.

**Done when:**
- The starting position renders correctly.
- All six pieces are distinguishable in a flat-black silhouette test at 64px.
- Draw calls < 15, triangles < 60,000, geometry generation < 30ms.
- Idle CPU is zero — no frames scheduled when nothing changes.
- Resizing from 320px to 2560px keeps the board correctly framed.
- All three themes render.

**Risk:** the knight silhouette. This is the single highest-risk item in the visual layer. Do not proceed to M3 until it reads.

---

## M3 — UI shell

**Goal:** the real interface around the board, replacing the dev console.

- Layout at all three breakpoints.
- `MoveList`, `StatusBar`, `DifficultyPicker`, `GameControls`.
- Result banner, new game flow, settings panel.
- The full accessibility floor from `09-ui-design.md`.
- All copy from the strings table.

**Done when:**
- A game is playable through the real UI at 320px, 768px, and 1440px.
- Every control is keyboard reachable with a visible focus ring.
- Contrast ratios verified.
- No emoji anywhere in the product.

---

## M4 — Animation

**Goal:** pieces move rather than teleport, and the system is interruptible from day one.

- `render/animation.ts` — the `Animator`, cancel-by-completion semantics, zero allocation in `tick()`.
- Move arcs, including the higher knight arc.
- Capture, castle, promotion, check, checkmate, game-start choreography.
- Contact shadow scaling.
- Ambient thinking pulse driven by search depth.
- `prefers-reduced-motion` throughout.
- `AnimationEvent` hooks (no audio yet).

**Done when:**
- The cancellation invariant test passes: five overlapping moves at 30ms intervals, `cancelAll()`, every piece at its state-derived position.
- Animator tick < 2ms with 32 concurrent animations.
- Heap-delta test confirms no allocation in `tick()`.
- Reduced motion produces zero scheduled frames beyond the first.

**This milestone must not be deferred or simplified.** Premoves in M6 depend on cancel-to-completion working correctly. Retrofitting it is the most expensive mistake available in this project.

---

## M5 — Pointer and keyboard input

**Goal:** play with mouse, touch, or keyboard, interchangeably.

- `render/picking.ts` — ground-plane raycast, tilt compensation, hover throttling.
- `render/overlay.ts` — pooled highlight quads.
- `input/pointer.ts` — the full state machine, 4px drag threshold, pointer capture.
- In-scene promotion picker.
- `core/san-parser.ts` — incremental prefix matching, lowercase `b` handling.
- `input/notation.ts` and the `NotationInput` component.
- `input/keyboard.ts` — global shortcuts.
- History browsing and takeback.
- Board flip.

**Done when:**
- Click-to-move and drag-to-move both work on mouse and touch.
- A full game is playable with the keyboard alone.
- Candidate highlighting updates correctly at every keystroke.
- Rejected input shakes and preserves the text.
- Back-rank taps are reliable on a real touch device.
- E2E scenarios 1, 3, and 4 pass.

---

## M6 — Premoves

**Goal:** fast play feels fast.

- `core/premove.ts` — the relaxed generator.
- Premove queue in state, entry through both input paths.
- The drain algorithm, exactly as specified in `04-game-core.md`.
- Premove presentation: opacity, ordinals, distinct hue, breathing.
- All cancellation triggers.
- Error flash on drain failure.

**Done when:**
- The superset property test passes exhaustively over several fixtures.
- A three-move chain executes correctly against a level 1 engine.
- An invalidated premove clears the entire queue and flashes.
- E2E scenarios 5 and 6 pass.
- No visible desync between rendered and state position during rapid premove chains.

---

## M7 — Persistence and polish

**Goal:** games survive reloads; loose ends closed.

- `persistence/db.ts` — IndexedDB via `idb`, debounced writes, 50-game retention.
- Resume prompt on boot.
- PGN export: download and clipboard.
- Optional clocks.
- Graceful degradation when IndexedDB is unavailable.
- WebGL context loss recovery.
- Licence page at `/licenses/`, linked from the footer.
- The engine calibration harness; run it and record results.

**Done when:**
- E2E scenario 7 passes.
- Private browsing mode runs without errors and without a resume affordance.
- Killing and restoring the WebGL context preserves the position.
- Adjacent difficulty rungs measure 250–350 Elo apart.

---

## M8 — Local build & verification

**Goal:** local production bundle verification and full test suite pass.

- Final build validation: `npm run build && npm run preview`.
- All Vitest unit tests pass with target coverage.
- All 8 Playwright E2E scenarios pass against local preview server.
- Verify `crossOriginIsolated === true` on `http://localhost`.
- README created with local dev setup instructions.

**Done when:**
- The application runs cleanly on `localhost` with all features active.
- `crossOriginIsolated` is `true`.
- Bundle size < 300KB gzipped (excluding Stockfish engine assets).
- All eight E2E scenarios pass locally.

---

## Sequencing notes

**Do not reorder these:**

- M1 before M2. Proving the engine and rules headlessly is far faster than debugging them through a renderer.
- M4 before M6. Premoves depend on animation cancellation.
- M2's knight before anything else visual. It gates the entire voxel resolution decision.
- M0's Scaffold before feature milestones. Setting up Vite headers early avoids discovering isolation issues late.

**Safe to parallelise:** M3 (UI shell) can proceed alongside M2 if you have capacity, since they touch disjoint code. Everything else is sequential.

**Where to expect trouble, in order of likelihood:**

1. Stockfish filenames and option ranges differing from expectation (M1).
2. The knight silhouette not reading at the chosen resolution (M2).
3. Missing headers in Vite dev server config (M0).
4. Animation desync during premove chains, if M4's cancellation was cut short (M6).
5. Touch reliability on the back rank without tilt compensation (M5).
