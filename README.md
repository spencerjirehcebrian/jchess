# jchess

A tabletop chess computer that lives in your browser. jchess renders a voxel chess set in 3D and wraps it in the chrome of a dedicated chess machine — physical-style keys, an engine readout, and Stockfish 18 running behind the panel.

Built with React 19, TypeScript, Three.js, Zustand, and Stockfish 18 WebAssembly.

## Features

- Chess-computer interface with legended keys, a live search indicator, and an engine evaluation readout.
- Custom voxel renderer: face-culled geometries, orthographic lighting, dynamic shadows, and multiple theme palettes.
- Snappy character animation — pieces hop, tilt, squash, and tumble on capture.
- Stockfish 18 in a web worker with eight difficulty levels.
- Premove queuing, FEN/PGN import/export, and game state persisted to IndexedDB.
- Procedurally synthesized retro sound effects via the Web Audio API.

Design and architecture notes live in [`docs/`](docs/).

## Technology Stack

| | |
|---|---|
| Framework | React 19, TypeScript |
| 3D | Three.js |
| State | Zustand |
| Chess logic | Chessops |
| Engine | Stockfish 18 (WASM, web worker) |
| Storage | IndexedDB (`idb`) |
| Testing | Vitest, Playwright, Happy DOM |
| Build | Vite |

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
git clone https://github.com/spencerjirehcebrian/jchess.git
cd jchess

# Installs dependencies and copies the Stockfish WASM binaries
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing & Linting

```bash
# Unit & integration tests
npm test

# Type-check + lint
npm run lint

# End-to-end tests
npm run test:e2e
```

### Production Build

```bash
npm run build
npm run preview
```

## License

jchess is released under the [GNU General Public License v3.0](public/licenses/GPL-3.0.txt). Stockfish is also licensed under GPL-3.0.
