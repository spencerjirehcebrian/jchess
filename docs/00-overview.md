# 00 — Overview

## What is being built

**Voxel Chess.** A browser chess game against a Stockfish engine at configurable strength. Voxel-rendered board and pieces under a fixed orthographic camera. Full keyboard play via algebraic notation. Premoves.

The engine runs entirely in the browser. There is no application backend. The target is a **locally runnable application** served via Vite dev server (`npm run dev`) or local static build (`npm run preview`).

## For the implementing agent

Read `00` through `02` before writing any code. Then work through `12-build-plan.md`, which sequences the work into milestones with explicit definitions of done. The other documents are references to consult when you reach the milestone that needs them.

**Rules of engagement:**

1. **Decisions in these docs are decisions, not suggestions.** Where a document specifies a library, a value, or a structure, use it. Where a document explicitly marks something as tunable or open, choose and record your choice in `DECISIONS.md` at the repo root.
2. **Verify package versions before pinning.** Package contents and filenames change. Every dependency in `02-tech-stack.md` must be installed and its actual exported filenames confirmed before you write code against it. This especially applies to the Stockfish distribution.
3. **Do not add dependencies not listed in `02-tech-stack.md`** without recording the reason in `DECISIONS.md`.
4. **Every milestone ends in a working, runnable state.** No milestone leaves the app broken.
5. **Focus strictly on local development.** Docker image builds and external deployments are explicitly out of scope. Ensure the local Vite dev server handles cross-origin isolation headers correctly.

## Document index

| Doc | Contents | Needed at |
|---|---|---|
| `00-overview.md` | This file. Scope, conventions, glossary. | Start |
| `01-architecture.md` | Components, threading model, data flow, invariants. | Start |
| `02-tech-stack.md` | Dependencies, project structure, tooling, conventions. | Start |
| `03-engine.md` | Stockfish integration, adapter API, difficulty ladder. | M1 |
| `04-game-core.md` | State model, rules layer, premove legality, persistence. | M1 |
| `05-voxel-assets.md` | Procedural voxel piece definitions and meshing. | M2 |
| `06-renderer.md` | Three.js scene, camera, materials, picking, overlays. | M2 |
| `07-animation.md` | Timing, interruptibility, choreography. | M4 |
| `08-input.md` | Pointer input, keyboard SAN input, premoves. | M5, M6 |
| `09-ui-design.md` | Design tokens, layout, copy, accessibility. | M3 |
| `10-deployment.md` | Reference Nginx & Docker configs (Out of Scope for build). | Reference |
| `11-testing.md` | Test strategy, fixtures, acceptance criteria. | M1 |
| `12-build-plan.md` | Milestone sequence with definitions of done. | Start |

## Scope

**In scope for v1**

- Human vs engine, one game at a time.
- Eight difficulty levels, beginner through full strength.
- Voxel rendering, orthographic camera, board flip.
- Click-to-move, drag-to-move, keyboard SAN input.
- Premoves with chaining.
- Move list, takeback, history browsing, PGN export.
- Local persistence and game resume.
- Optional clocks.
- Local execution via Vite (`npm run dev` / `npm run preview`).

**Out of scope for v1**

- Docker image creation, containerization, and remote server deployment.
- Accounts, ratings, matchmaking, human vs human.
- Server-side engine, anti-cheat, any backend.
- Opening books, endgame tablebases, deep post-game analysis.
- Chess variants.
- Internationalisation beyond English.

**Explicitly accepted tradeoffs**

- The client is untrusted and unverifiable. Everything runs locally, so a determined user can cheat freely. This is irrelevant for a single-player game against a bot and must not drive any design decision.
- Engine strength at the top of the ladder is bounded by the user's device. This is acceptable; the top rung is far stronger than any human user.

## Glossary

| Term | Meaning |
|---|---|
| **SAN** | Standard Algebraic Notation. `Nf3`, `exd5`, `O-O`. |
| **UCI (protocol)** | Universal Chess Interface. The text protocol for talking to the engine. |
| **UCI (move format)** | Long algebraic move format used by the protocol. `g1f3`, `e7e8q`. |
| **FEN** | Forsyth-Edwards Notation. A complete position as one string. |
| **PGN** | Portable Game Notation. A game as a move list plus metadata. |
| **Ply** | One move by one side. A full move is two plies. |
| **Premove** | A move entered while it is not your turn, executed when your turn arrives. |
| **Relaxed legality** | The permissive move generation used to validate premoves. See `04-game-core.md`. |
| **Cross-origin isolation** | The browser state enabling `SharedArrayBuffer`, required for the multi-threaded engine. |
| **Voxel grid** | The code-defined 3D array describing a piece's shape. See `05-voxel-assets.md`. |

## Conventions used in these docs

- Code blocks marked `typescript` are **interface contracts**. Implement them as written; extend freely.
- Code blocks marked `text` or `ascii` are illustrative.
- Tables of numeric values (durations, budgets) are **defaults to implement**, exposed as constants in one place so they can be tuned without hunting.
- "Must" is a requirement. "Should" is a strong default you may override with a recorded reason. "May" is genuinely optional.
