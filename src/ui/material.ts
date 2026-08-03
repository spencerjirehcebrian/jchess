import { useMemo } from "react";
import { useGameStore } from "../store";
import { positionAfter } from "../core/rules";
import { Role, Color } from "../core/types";

const START_COUNTS: Record<Role, number> = {
  pawn: 8,
  knight: 2,
  bishop: 2,
  rook: 2,
  queen: 1,
  king: 1,
};

const VALUES: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/** Heaviest first, so a trophy row reads as a ranking rather than a pile. */
export const ORDER: Role[] = ["queen", "rook", "bishop", "knight", "pawn"];

export type RoleCounts = Record<Role, number>;

export function opposite(color: Color): Color {
  return color === "white" ? "black" : "white";
}

function emptyCounts(): RoleCounts {
  return { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 };
}

/** Pieces missing from the board, per colour. */
function missingByColour(board: {
  get: (sq: number) => { role: Role; color: Color } | undefined;
}): Record<Color, RoleCounts> {
  const remaining: Record<Color, RoleCounts> = {
    white: emptyCounts(),
    black: emptyCounts(),
  };

  for (let sq = 0; sq < 64; sq++) {
    const piece = board.get(sq);
    if (piece) remaining[piece.color][piece.role] += 1;
  }

  const missing: Record<Color, RoleCounts> = {
    white: emptyCounts(),
    black: emptyCounts(),
  };

  for (const color of ["white", "black"] as Color[]) {
    for (const role of ORDER) {
      // Promotion can leave more of a role on the board than the game began
      // with, so a negative difference means nothing was captured.
      missing[color][role] = Math.max(
        0,
        START_COUNTS[role] - remaining[color][role],
      );
    }
  }

  return missing;
}

function score(counts: RoleCounts): number {
  return ORDER.reduce((sum, role) => sum + counts[role] * VALUES[role], 0);
}

export interface MaterialBalance {
  /** What each colour has taken from the other, keyed by the captor. */
  trophies: Record<Color, RoleCounts>;
  /** Points ahead, keyed by the captor. Zero for the side that is not ahead. */
  advantage: Record<Color, number>;
}

/**
 * Material as seen from each player's side: what they took, and by how much
 * they lead. Keyed by captor rather than by victim, so a player row can ask
 * for its own trophies without inverting anything at the usage site.
 */
export function useMaterialBalance(): MaterialBalance {
  const initialFen = useGameStore((s) => s.initialFen);
  const history = useGameStore((s) => s.history);
  const cursor = useGameStore((s) => s.cursor);

  return useMemo(() => {
    const pos = positionAfter(
      initialFen,
      history.slice(0, cursor).map((h) => h.move),
    );
    const missing = missingByColour(pos.board);

    // White's trophies are the black pieces that have left the board.
    const trophies: Record<Color, RoleCounts> = {
      white: missing.black,
      black: missing.white,
    };

    const diff = score(trophies.white) - score(trophies.black);
    return {
      trophies,
      advantage: {
        white: Math.max(0, diff),
        black: Math.max(0, -diff),
      },
    };
  }, [initialFen, history, cursor]);
}
