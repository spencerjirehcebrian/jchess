# jchess ♟️

**jchess** is a fast, beautifully designed browser-based 3D Voxel Chess game powered by Three.js, React 19, Zustand, and Stockfish 18 WebAssembly.

---

## Key Features

- **3D Voxel Engine**: Custom face-culled voxel geometries rendered with Three.js orthographic lighting, dynamic shadows, and theme palettes (Oxide, Monochrome, Forest).
- **Fast & Beautiful Animations**: Snappy 130ms move animation engine featuring:
  - Parabolic arc hopping over pieces (with high-arc trajectories for Knights).
  - Dynamic pitch and tilt into movement direction vector.
  - Landing squash-and-stretch scale bounce physics.
  - Dynamic shadow scaling and light-softening effects during flight.
  - Tumble, scale-down, and sink impact physics for captured pieces with translucent impact rings.
  - Concurrent dual-mesh movement for Castling (King + Rook), En Passant, and Pawn Promotions.
- **Stockfish 18 WASM**: Integrated web worker running Stockfish 18 (multi-threaded and single-threaded lite WASM) with 8 customizable difficulty levels.
- **Web Audio Sound Effects**: Procedurally synthesized retro audio effects for moves, captures, checks, premoves, victory, and defeat using Web Audio API.
- **Premove Queuing**: Premoves with queue limits and instant draining upon engine responses.
- **State Persistence**: Active game state, move history, FEN/PGN import/export, and user settings saved to IndexedDB (`idb`).
- **Responsive Layout**: Dynamic board scaling (Compact, Normal, Large, Full) and dark mode customization.

---

## Technology Stack

- **Core Framework**: React 19, TypeScript
- **State Management**: Zustand
- **Graphics & 3D**: Three.js
- **Chess Logic**: Chessops
- **Engine**: Stockfish 18 (WebAssembly / Web Worker)
- **Audio**: Web Audio API (Synthesized)
- **Storage**: IndexedDB (`idb`)
- **Testing**: Vitest, Playwright, Happy DOM
- **Build Tool**: Vite

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
# Clone the repository
git clone https://github.com/spencerjirehcebrian/jchess.git
cd jchess

# Install dependencies & copy Stockfish WASM binaries
npm install
```

### Development

```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing & Linting

```bash
# Run unit & integration tests
npm test

# Type-check / Linting
npm run lint

# End-to-end tests
npm run test:e2e
```

### Production Build

```bash
npm run build
npm run preview
```

---

## License

Stockfish is licensed under [GPL-3.0](licenses/GPL-3.0.txt). Application source code is released under the GNU General Public License v3.0 (GPL-3.0).
