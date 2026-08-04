import { create } from "zustand";
import { Color } from "../core/types";
import { EngineProgress } from "../engine/types";

/**
 * What the engine is doing right now, as opposed to what the game is.
 *
 * This is a store of its own rather than a few more fields on `useGameStore`,
 * for two reasons that both matter:
 *
 *  - Progress arrives roughly ten times a second (`stockfish.ts` throttles it to
 *    100ms). Every consumer of the game store — both player rows, the system
 *    line, the controls and the app shell — subscribes to the whole of it, so
 *    telemetry landing there would repaint the entire rail, transcript included,
 *    ten times a second.
 *  - `App.tsx` subscribes to the game store and writes the game to storage on
 *    every change. Search telemetry is not game state and has no business
 *    driving the persistence layer at all, let alone at 10Hz.
 *
 * Nothing here is ever persisted, and nothing here survives a reload. It is an
 * instrument reading, not a fact about the game.
 */
export interface Telemetry {
  /** True between the engine starting a search and settling one. */
  searching: boolean;
  /** Plies of the deepest iteration completed so far. */
  depth: number;
  /**
   * Centipawns, always from white's point of view.
   *
   * UCI reports the score from the side to move, and the engine only ever
   * searches on its own turn — so what arrives is engine-relative. It is
   * normalised once, here, on the way in. Every consumer can then treat
   * positive as "good for white" without knowing which colour the engine has,
   * and there is exactly one place to get the sign wrong.
   */
  scoreCp: number | null;
  /** Moves to mate, same convention: positive means white is mating. */
  scoreMate: number | null;
}

export type TelemetryStore = Telemetry & {
  beginSearch: () => void;
  report: (progress: EngineProgress, engineColor: Color) => void;
  endSearch: () => void;
};

const IDLE: Telemetry = {
  searching: false,
  depth: 0,
  scoreCp: null,
  scoreMate: null,
};

export const useTelemetry = create<TelemetryStore>((set) => ({
  ...IDLE,

  // Cleared rather than left standing: a fresh search's first `info` can be
  // several hundred milliseconds away, and until then the last search's depth
  // would read as this one's.
  beginSearch: () => set({ ...IDLE, searching: true }),

  report: (progress, engineColor) => {
    const sign = engineColor === "white" ? 1 : -1;
    set({
      searching: true,
      depth: progress.depth,
      scoreCp: progress.scoreCp === undefined ? null : progress.scoreCp * sign,
      scoreMate:
        progress.scoreMate === undefined ? null : progress.scoreMate * sign,
    });
  },

  endSearch: () => set({ searching: false }),
}));

/**
 * How many of the four cells to light.
 *
 * Exported and used as a selector so the quantising happens *before* zustand's
 * equality check: the component then re-renders when a cell changes rather than
 * on every info line, which is the whole reason a 10Hz feed is affordable here.
 *
 * `ceil`, not `round` — the lower difficulties never search deeper than a few
 * plies, and rounding left them showing an empty indicator for the whole search,
 * which is the exact bug this readout was added to fix.
 */
export function searchCells(t: Telemetry): number {
  if (t.depth <= 0) return 0;
  return Math.min(4, Math.ceil(t.depth / 5));
}
