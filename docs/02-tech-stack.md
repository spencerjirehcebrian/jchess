# 02 — Tech Stack and Project Structure

## Dependencies

Install these first, confirm the actual versions and exported filenames, then record what you pinned in `DECISIONS.md`.

### Runtime

| Package | Purpose | Notes |
|---|---|---|
| `three` | Rendering | Imperative use only. Do not add react-three-fiber. |
| `chessops` | Rules, SAN, FEN, move generation | By niklasf. Immutable position API. |
| `stockfish` | Engine | nmrugg's distribution. See below. |
| `zustand` | Store | Used from both React and the imperative renderer. |
| `react`, `react-dom` | DOM chrome only | The board is not React. |
| `idb` | IndexedDB wrapper | Thin promise wrapper. |

### Build and dev

| Package | Purpose |
|---|---|
| `vite` | Bundler and dev server |
| `typescript` | Strict mode, no exceptions |
| `@vitejs/plugin-react` | React support |
| `vitest` | Unit tests |
| `@playwright/test` | End-to-end tests |
| `eslint`, `prettier` | Lint and format |
| `vite-plugin-compression` | Pre-compress assets for `gzip_static` |

### The Stockfish package specifically

The `stockfish` npm package (v18.x, Stockfish 18) ships **five flavors**. Filenames follow the pattern below but **must be confirmed against the installed package** — they carry the major version and change between releases.

| Flavor | Approx. size | Threads | Needs isolation | Use |
|---|---|---|---|---|
| Large multi-threaded | >100MB | Yes | Yes | **Do not use.** Wrecks image size for no benefit here. |
| Large single-threaded | >100MB | No | No | **Do not use.** |
| Lite multi-threaded | ~7MB | Yes | Yes | **Primary.** |
| Lite single-threaded | ~7MB | No | No | **Fallback.** |
| asm.js | ~10MB | No | No | Not used in v1. |

Both lite builds ship with an embedded NNUE network — there is no separate `.nnue` file to fetch or lazy-load. This simplifies asset handling considerably.

The lite builds are "quite a bit weaker" than the large ones. At full strength that still means roughly 3000+ Elo on modest hardware, which is far beyond any human user and entirely sufficient for the top of an eight-rung ladder.

**Copy both lite flavors into the build output** and select between them at runtime. Combined they add roughly 14MB to the image, which is acceptable.

### Deliberately excluded

| Not using | Why |
|---|---|
| `react-three-fiber` | Reconciler overhead fights render-on-demand. The scene is small and static; imperative Three.js is more predictable. |
| `chess.js` | `chessops` has a better immutable API, real TypeScript types, and correct handling of edge cases like castling in Chess960 notation. Do not use both. |
| `@react-three/drei` | Depends on R3F. |
| Any CSS framework | The design system is small and specified in `09-ui-design.md`. CSS custom properties plus plain CSS modules. |
| Any state library other than Zustand | The renderer must subscribe outside React. |
| Any glTF/`.vox` loader | Pieces are generated procedurally. See `05-voxel-assets.md`. |

## Project structure

```
.
├── docs/                       these documents
├── DECISIONS.md                running log of choices made by the agent
├── Dockerfile                  (Optional/Out of Scope for local dev)
├── docker/                     (Optional/Out of Scope for local dev)
├── docker-compose.yml          (Optional/Out of Scope for local dev)
├── index.html
├── vite.config.ts
├── public/
│   └── engine/                 Stockfish artifacts, copied at build
├── src/
│   ├── main.tsx                entry: boots store, renderer, React
│   ├── config.ts               RuntimeConfig accessor with defaults
│   │
│   ├── core/                   pure logic, zero DOM, zero Three.js
│   │   ├── types.ts            Square, Move, Piece, GameState, ...
│   │   ├── rules.ts            chessops wrapper: legality, SAN, FEN
│   │   ├── premove.ts          relaxed move generation
│   │   ├── san-parser.ts       incremental SAN prefix matching
│   │   ├── pgn.ts              serialize / parse
│   │   └── difficulty.ts       the eight-level ladder
│   │
│   ├── engine/
│   │   ├── types.ts            Engine interface, SearchBudget
│   │   ├── stockfish.ts        adapter implementation
│   │   ├── uci.ts              UCI line parsing
│   │   └── capability.ts       isolation + WASM detection
│   │
│   ├── store/
│   │   ├── index.ts            Zustand store definition
│   │   └── controller.ts       the ONLY writer to the store
│   │
│   ├── render/
│   │   ├── index.ts            Renderer class: mount, dispose, subscribe
│   │   ├── scene.ts            camera, lights, board
│   │   ├── voxel/
│   │   │   ├── pieces.ts       voxel grid definitions
│   │   │   ├── mesher.ts       grid -> BufferGeometry
│   │   │   └── palette.ts      colour ramps
│   │   ├── pieces.ts           instanced piece management
│   │   ├── overlay.ts          highlights, dots, premove marks
│   │   ├── animation.ts        tween engine with cancellation
│   │   └── picking.ts          ground-plane raycast -> square
│   │
│   ├── input/
│   │   ├── pointer.ts          click and drag
│   │   ├── keyboard.ts         global shortcuts
│   │   └── notation.ts         SAN field state machine
│   │
│   ├── ui/                     React components, DOM only
│   │   ├── App.tsx
│   │   ├── MoveList.tsx
│   │   ├── NotationInput.tsx
│   │   ├── DifficultyPicker.tsx
│   │   ├── GameControls.tsx
│   │   ├── StatusBar.tsx
│   │   └── Clock.tsx
│   │
│   ├── persistence/
│   │   └── db.ts               IndexedDB via idb
│   │
│   └── styles/
│       ├── tokens.css          design tokens
│       └── global.css
│
└── tests/
    ├── unit/
    ├── fixtures/               FEN and PGN test positions
    └── e2e/
```

## Conventions

**TypeScript**

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any`. Use `unknown` and narrow. The only permitted exception is at the Stockfish module boundary, which is untyped; wrap it immediately in a typed adapter and never let `any` escape `src/engine/`.
- Prefer discriminated unions over optional fields for state. `status` drives what other fields are present.

**Imports**

- `src/core/**` must not import from `render`, `ui`, `engine`, or `store`. Enforce with an ESLint boundary rule.
- `src/render/**` must not import from `ui`.
- Everything may import from `core`.

**Constants**

Every tunable number lives in exactly one file and is exported by name. No magic numbers at usage sites.

- Animation durations → `src/render/animation.ts`
- Difficulty ladder → `src/core/difficulty.ts`
- Voxel dimensions and palettes → `src/render/voxel/`
- Colours and spacing → `src/styles/tokens.css`

**Async**

- All engine calls are cancellable. Use `AbortSignal`, not ad-hoc flags.
- Never `await` inside a render or animation frame callback.

**Errors**

- User-facing failures go through one `AppError` type with a `code` and a human-readable message. See `09-ui-design.md` for copy rules.
- Programmer errors throw. Do not swallow.

## Vite configuration requirements

1. **Engine assets are copied, not bundled.** The Stockfish `.js` files load their `.wasm` siblings by relative path and must sit together in `public/engine/`. Do not let Vite hash or rewrite them.
2. **Pre-compress the output** with `vite-plugin-compression` (gzip). nginx serves the `.gz` files via `gzip_static`, which avoids compressing multi-megabyte WASM on every request.
3. **Target `es2022`.** SharedArrayBuffer-capable browsers all support it.
4. **Dev server must set the isolation headers** or you will not be able to test the multi-threaded path locally:
   ```
   server.headers: {
     'Cross-Origin-Opener-Policy': 'same-origin',
     'Cross-Origin-Embedder-Policy': 'require-corp'
   }
   ```
5. **Do not inline assets.** `build.assetsInlineLimit: 0` keeps the cache story simple.

## Browser support

Chromium 92+, Firefox 95+, Safari 16.4+. These are the floors for `SharedArrayBuffer` under cross-origin isolation plus WebGL2. Below them, the single-threaded path still works. Do not add polyfills.

## Licensing

Stockfish is **GPL-3.0**. Bundling it into your distributed image has licensing consequences for the whole distributed work. Include the Stockfish licence text in the image at `/usr/share/nginx/html/licenses/`, link to it from the UI footer, and record the licence choice for your own source in `DECISIONS.md`. This is not optional and not something to leave until the end.
