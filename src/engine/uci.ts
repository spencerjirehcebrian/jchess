import { EngineProgress, SearchResult } from "./types";

export function parseBestMove(line: string): SearchResult | null {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== "bestmove") return null;

  const move = parts[1];
  if (!move || move === "(none)" || move === "0000") {
    return null;
  }

  let ponder: string | undefined = undefined;
  if (parts[2] === "ponder" && parts[3]) {
    ponder = parts[3];
  }

  return {
    move,
    ponder,
    depth: 0,
  };
}

export function parseInfoLine(line: string): Partial<EngineProgress> | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") return null;

  const result: Partial<EngineProgress> = {};

  for (let i = 1; i < tokens.length; i++) {
    const key = tokens[i];
    if (key === "depth" && tokens[i + 1]) {
      result.depth = parseInt(tokens[i + 1]!, 10);
      i++;
    } else if (key === "nodes" && tokens[i + 1]) {
      result.nodes = parseInt(tokens[i + 1]!, 10);
      i++;
    } else if (key === "nps" && tokens[i + 1]) {
      result.nps = parseInt(tokens[i + 1]!, 10);
      i++;
    } else if (key === "score" && tokens[i + 1] && tokens[i + 2]) {
      const scoreType = tokens[i + 1];
      const scoreVal = parseInt(tokens[i + 2]!, 10);
      if (scoreType === "cp") {
        result.scoreCp = scoreVal;
      } else if (scoreType === "mate") {
        result.scoreMate = scoreVal;
      }
      i += 2;
    } else if (key === "pv") {
      result.pv = tokens.slice(i + 1);
      break;
    }
  }

  return result;
}
