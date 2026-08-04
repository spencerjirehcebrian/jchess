# 04 — Game Core

## State model

State is a **move list plus a starting position**. The current board is derived, never stored. This gives takeback, history browsing, replay, and PGN export with no extra machinery.

```typescript
type Square = number                       // 0-63, a1 = 0, h8 = 63
type Color = 'white' | 'black'
type Role = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

interface Move {
  from: Square
  to: Square
  promotion?: Exclude<Role, 'pawn' | 'king'>
}

interface HistoryEntry {
  move: Move
  san: string
  fenAfter: string
  captured?: Role
  isCheck: boolean
  isMate: boolean
}

type GameStatus =
  | { kind: 'setup' }
  | { kind: 'human-turn' }
  | { kind: 'engine-thinking'; startedAt: number }
  | { kind: 'engine-delaying'; move: Move; until: number }
  | { kind: 'over'; result: Result }
  | { kind: 'error'; error: AppError }

interface Result {
  winner: Color | null                     // null = draw
  reason: 'checkmate' | 'stalemate' | 'insufficient-material'
        | 'threefold' | 'fifty-move' | 'resignation' | 'timeout'
}

interface GameState {
  id: string
  initialFen: string
  humanColor: Color
  difficulty: number                       // 1-8
  history: HistoryEntry[]
  cursor: number                           // index into history for browsing; = length when live
  status: GameStatus
  premoves: Move[]
  selectedSquare: Square | null
  boardFlipped: boolean
  clock?: ClockState
  startedAt: number
}
```

**`cursor` versus live play.** When `cursor < history.length` the user is browsing. In that state: the board shows the historical position, input is read-only, and premoves are cleared. Making a move while browsing is not a takeback — it is rejected with a prompt to return to the live position first. Do not silently truncate history.

**`fenAfter` is stored per entry** rather than recomputed. It costs a few hundred bytes per game and makes history scrubbing instant, threefold detection trivial, and debugging vastly easier.

## Rules layer

A thin wrapper over `chessops`. Pure functions, no state, no imports from anywhere else in the app.

```typescript
interface Rules {
  positionFromFen(fen: string): Position
  positionAfter(initialFen: string, moves: Move[]): Position

  legalMoves(pos: Position): Move[]
  legalMovesFrom(pos: Position, from: Square): Move[]
  isLegal(pos: Position, move: Move): boolean

  toSan(pos: Position, move: Move): string
  fromSan(pos: Position, san: string): Move | null
  toUci(move: Move): string
  fromUci(uci: string): Move | null

  toFen(pos: Position): string
  outcome(pos: Position, history: HistoryEntry[]): Result | null

  isCheck(pos: Position): boolean
  kingSquare(pos: Position, color: Color): Square
}
```

Notes:

- **Repetition and the fifty-move rule need history**, not just the position, which is why `outcome` takes both. `chessops` tracks halfmove clock in the position; threefold requires comparing FENs across history (compare the first four FEN fields only — piece placement, side to move, castling rights, en passant — ignoring the clocks).
- **Insufficient material** must cover K vs K, K+B vs K, K+N vs K, and K+B vs K+B with same-coloured bishops.
- **`positionAfter` is called constantly.** Memoise it keyed on `history.length`, or maintain an incrementally updated position alongside the history and rebuild only on takeback or cursor changes. Do not replay from the start position on every frame.

## Relaxed legality for premoves

A premove cannot be validated against the current position because the opponent has not moved. Validate it instead against a **relaxed** generator answering: *could this move conceivably be legal after some opponent reply?*

### Rules for the relaxed generator

```typescript
function premoveDestinations(pos: Position, from: Square): Square[]
```

| Aspect | Rule |
|---|---|
| Opponent pieces | Do not block sliding rays. Every square is treated as potentially occupied by an enemy piece and therefore capturable. |
| Own pieces | **Do block.** They could be captured, opening the ray — but treating them as transparent floods the board with premoves that almost never fire. |
| Pawn pushes | One square forward if currently empty; two from the starting rank if both squares are currently empty. Own pieces block; enemy pieces do not, since they may move away. |
| Pawn captures | Both diagonals always offered, whether or not a piece is there now. |
| En passant | Offered on any file where the opponent has a pawn on its starting rank that could double-step. |
| Promotion | Any pawn move reaching the last rank offers all four pieces. |
| Castling | Offered whenever the castling right exists, regardless of current occupancy, current check, or squares currently attacked. |
| King moves | All eight neighbours, ignoring attacked squares entirely. |
| Knights | All eight jumps that stay on the board. |
| Self-check | **Not checked at all.** The position will be different. |

The result is a strict superset of the legal moves in the resulting position. That is correct and intended: a premove that turns out illegal is cancelled, which is a normal outcome and not an error.

**The own-pieces-block rule is tunable.** Expose it as a constant `PREMOVE_OWN_PIECES_BLOCK = true`. If playtesting shows too many cancelled premoves in tactical positions, flip it and compare.

### Premove queue

```typescript
interface PremoveQueue {
  moves: Move[]
  maxLength: number      // RuntimeConfig.maxPremoves, default 3
}
```

Each premove after the first is validated against the relaxed position produced by applying the previous premoves to a **hypothetical** board — apply your own premoves normally, and leave the opponent's pieces where they are.

Chains fail more often than single premoves. Default the cap to 3; 1 is a valid setting and should be offered.

### Drain algorithm

Executed by the controller when the engine's move arrives. This is the exact sequence.

```
1. apply engine move to history
2. start engine move animation (do not await)
3. if premoves is empty:
     status = 'human-turn'; return
4. candidate = premoves.shift()
5. pos = positionAfter(initialFen, history)
6. if not rules.isLegal(pos, candidate):
     premoves = []          // clear the ENTIRE queue, not just the head
     status = 'human-turn'
     emit 'premove-cancelled' feedback
     return
7. renderer.cancelAllAnimations()   // snaps engine move to final position
8. apply candidate to history
9. start premove animation
10. if outcome(...) is not null: status = 'over'; return
11. status = 'engine-thinking'
12. engine.search(...)
```

Step 6 clears the whole queue deliberately. A broken chain's tail was planned against a position that no longer exists and is almost never what the user intended.

Step 7 is why animation interruptibility is mandatory. Without it, the premove animation starts from a piece position that is still mid-flight and the board visibly desyncs from state.

### Cancellation triggers

Clear the entire queue on any of: right-click anywhere on the board, `Escape`, clicking any square, initiating a drag, takeback, new game, difficulty change, entering history browsing.

## Clocks

Optional, off by default (`RuntimeConfig.enableClocks`).

```typescript
interface ClockState {
  initialMs: number
  incrementMs: number
  remaining: Record<Color, number>
  runningSince: number | null      // performance.now() when the current turn started
  runningFor: Color | null
}
```

- Compute remaining time on read from `performance.now()`. Do not tick with `setInterval` and decrement — that drifts and breaks when the tab is backgrounded.
- Render the clock display on a 100ms interval, but derive the value each time.
- The increment is applied on move completion, not on move start.
- Engine artificial think time counts against the engine's clock. It should, since it is the engine's turn.
- Flag fall while the tab is hidden must be detected on `visibilitychange`.

## Persistence

IndexedDB via `idb`. One store, `games`, keyed by game id.

```typescript
interface StoredGame {
  id: string
  pgn: string
  difficulty: number
  humanColor: Color
  updatedAt: number
  completed: boolean

  // The clock, which a PGN cannot carry. Read as a pair; a record written
  // before they existed resumes untimed.
  timeControlId?: string
  clockRemaining?: { white: number; black: number }
}
```

- **Write debounced at 500ms** after any move. Never on the critical path of applying a move.
- **PGN is the storage format**, not the internal state shape. It survives refactors and is directly exportable.
- Retain the last 50 games; prune oldest-first on write.
- On boot, if the most recent game is incomplete and less than 7 days old, resume it silently. It was asked as a question once; the answer was almost always yes, and the dialog only stood between the player and the game they had left. Anything else — no stored game, a finished one, no storage at all — lands on the setup panel, which is where a player with no game in progress belongs.
- The boot decision is taken once, after **both** the engine handshake and the storage probe have settled. They used to race, which was survivable only while resuming was a question someone answered.
- The clock resumes with the game. `ClockState.runningSince` is a `performance.now()` reading and means nothing to the next page load, so the remaining time is banked into the record on the way out (including on `visibilitychange`, so what is stored is the time spent up to the moment the player left). Time away from the page is never charged.
- A finished game boots to setup rather than to its own analysis: a PGN is rebuilt from notation and carries no evals, so the assessment gauge would have nothing to show.
- If IndexedDB is unavailable, run entirely in memory. Nothing is offered back and nothing is said about it beyond the note in settings. Do not show an error dialog.

### PGN

Standard seven-tag roster plus custom tags:

```
[Event "Voxel Chess"]
[Site "<hostname>"]
[Date "YYYY.MM.DD"]
[Round "-"]
[White "Player" | "Stockfish (Level N)"]
[Black "Stockfish (Level N)" | "Player"]
[Result "1-0" | "0-1" | "1/2-1/2" | "*"]
[Difficulty "N"]
[EngineElo "NNNN"]
[FEN "..."]           only when initialFen is not the standard start
```

Export as a downloadable `.pgn` and as clipboard copy. Import is not required for v1 but the parser should be written to support it.
