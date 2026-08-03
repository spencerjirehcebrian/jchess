import { GameState, Result, START_FEN } from "./types";

export interface ParsedPgn {
  tags: Record<string, string>;
  moves: string[];
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
