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
