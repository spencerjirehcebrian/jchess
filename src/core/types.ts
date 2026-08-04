export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type Square = number; // 0-63, a1 = 0, h8 = 63
export type Color = "white" | "black";
export type Role = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export interface Move {
  from: Square;
  to: Square;
  promotion?: Exclude<Role, "pawn" | "king"> | undefined;
}

export interface HistoryEntry {
  move: Move;
  san: string;
  fenAfter: string;
  captured?: Role | undefined;
  isCheck: boolean;
  isMate: boolean;

  /*
   * What the engine thought of the position it had just chosen this move from,
   * always from white's point of view. Only engine plies carry it — it is the
   * search that produced the move, not an assessment of the move — and it is
   * lost when a game is restored, because a PGN is rebuilt from notation. It is
   * a recorded instrument reading, not a fact about the game.
   */
  evalCp?: number | undefined;
  evalMate?: number | undefined;
}

export interface Result {
  winner: Color | null; // null = draw
  reason:
    | "checkmate"
    | "stalemate"
    | "insufficient-material"
    | "threefold"
    | "fifty-move"
    | "resignation"
    | "timeout";
}

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

export type GameStatus =
  | { kind: "setup" }
  | { kind: "human-turn" }
  | { kind: "engine-thinking"; startedAt: number }
  | { kind: "engine-delaying"; move: Move; until: number }
  | { kind: "over"; result: Result }
  | { kind: "error"; error: AppError };

export interface ClockState {
  initialMs: number;
  incrementMs: number;
  /** Banked at the start of the running side's turn, not live. */
  remaining: Record<Color, number>;
  /** `performance.now()` when the current turn started. */
  runningSince: number | null;
  runningFor: Color | null;
}

export interface GameState {
  id: string;
  initialFen: string;
  humanColor: Color;
  difficulty: number; // 1-8
  theme: string; // "oxide" | "monochrome" | "forest"
  maxPremoves: number;
  boardSize?: "compact" | "normal" | "large" | "full";
  history: HistoryEntry[];
  cursor: number; // index into history for browsing; = length when live
  status: GameStatus;
  premoves: Move[];
  selectedSquare: Square | null;
  boardFlipped: boolean;
  /**
   * The chosen time control, which outlives any one game — `clock` is
   * undefined whenever it is "off", so the choice cannot live there.
   */
  timeControlId?: string | undefined;
  clock?: ClockState | undefined;
  startedAt: number;
}

export function squareToName(sq: Square): string {
  const file = String.fromCharCode("a".charCodeAt(0) + (sq % 8));
  const rank = Math.floor(sq / 8) + 1;
  return `${file}${rank}`;
}

export function nameToSquare(name: string): Square | null {
  if (name.length !== 2) return null;
  const fileChar = name[0]!;
  const rankChar = name[1]!;
  const file = fileChar.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(rankChar, 10) - 1;
  if (file < 0 || file > 7 || isNaN(rank) || rank < 0 || rank > 7) return null;
  return rank * 8 + file;
}
