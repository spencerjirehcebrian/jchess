import { GameState, HistoryEntry, Result, START_FEN } from "./types";
import { buildHistoryEntry, fromSan, positionFromFen } from "./rules";

export interface ParsedPgn {
  tags: Record<string, string>;
  moves: string[];
}

export interface RestoredGame {
  initialFen: string;
  history: HistoryEntry[];
  startedAt: number;
}

/** `YYYY.MM.DD` back to milliseconds, so a resumed game keeps its own date. */
function parsePgnDate(value: string | undefined): number | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

export function formatResult(result: Result | null): string {
  if (!result) return "*";
  if (result.winner === "white") return "1-0";
  if (result.winner === "black") return "0-1";
  return "1/2-1/2";
}

export function serializePgn(state: GameState): string {
  const dateStr = new Date(state.startedAt)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, ".");
  const resultStr =
    state.status.kind === "over" ? formatResult(state.status.result) : "*";

  const whiteName =
    state.humanColor === "white"
      ? "Player"
      : `Stockfish (Level ${state.difficulty})`;
  const blackName =
    state.humanColor === "black"
      ? "Player"
      : `Stockfish (Level ${state.difficulty})`;

  const tags: [string, string][] = [
    ["Event", "jchess"],
    [
      "Site",
      typeof window !== "undefined" ? window.location.hostname : "localhost",
    ],
    ["Date", dateStr],
    ["Round", "-"],
    ["White", whiteName],
    ["Black", blackName],
    ["Result", resultStr],
    ["Difficulty", String(state.difficulty)],
  ];

  if (state.initialFen !== START_FEN) {
    tags.push(["FEN", state.initialFen]);
    tags.push(["SetUp", "1"]);
  }

  let pgn = tags.map(([k, v]) => `[${k} "${v}"]`).join("\n") + "\n\n";

  const moveLines: string[] = [];
  for (let i = 0; i < state.history.length; i++) {
    const entry = state.history[i]!;
    if (i % 2 === 0) {
      const moveNum = Math.floor(i / 2) + 1;
      moveLines.push(`${moveNum}. ${entry.san}`);
    } else {
      moveLines.push(entry.san);
    }
  }

  if (state.status.kind === "over") {
    moveLines.push(resultStr);
  }

  pgn += moveLines.join(" ");
  return pgn;
}

export function parsePgn(pgnText: string): ParsedPgn {
  const tags: Record<string, string> = {};
  const lines = pgnText.split("\n");
  const moveTextLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const match = trimmed.match(/^\[(\w+)\s+"(.*)"\]$/);
      if (match) {
        tags[match[1]!] = match[2]!;
      }
    } else if (trimmed && !trimmed.startsWith(";")) {
      moveTextLines.push(trimmed);
    }
  }

  const fullMoveText = moveTextLines
    .join(" ")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\([^)]*\)/g, "");
  const tokens = fullMoveText.split(/\s+/).filter(Boolean);
  const moves: string[] = [];

  for (const token of tokens) {
    if (/^\d+\./.test(token)) continue;
    if (["1-0", "0-1", "1/2-1/2", "*"].includes(token)) continue;
    moves.push(token);
  }

  return { tags, moves };
}

/**
 * Replays a stored PGN back into the history the app runs on.
 *
 * PGN is the storage format precisely because it is not the internal shape: it
 * survives refactors of `GameState` and is a file a person can open. The cost
 * is that everything derived — the FEN after each ply, what was captured,
 * check and mate — has to be recomputed, which is what `buildHistoryEntry`
 * does for live moves too.
 *
 * Returns null if any move fails to parse. A half-restored game is worse than
 * an offer to resume that quietly does not appear.
 */
export function restoreFromPgn(pgnText: string): RestoredGame | null {
  const { tags, moves } = parsePgn(pgnText);
  const initialFen = tags["FEN"] ?? START_FEN;

  let pos;
  try {
    pos = positionFromFen(initialFen);
  } catch {
    return null;
  }

  const history: HistoryEntry[] = [];
  for (const sanStr of moves) {
    const move = fromSan(pos, sanStr);
    if (!move) return null;
    const { entry, posAfter } = buildHistoryEntry(pos, move);
    history.push(entry);
    pos = posAfter;
  }

  return {
    initialFen,
    history,
    startedAt: parsePgnDate(tags["Date"]) ?? Date.now(),
  };
}
