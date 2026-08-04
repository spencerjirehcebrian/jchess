import { openDB, IDBPDatabase } from "idb";
import { Color, GameState } from "../core/types";
import { remainingFor } from "../core/clock";
import { serializePgn } from "../core/pgn";

const DB_NAME = "jchess-db";

/**
 * v2 replaced two stores of serialized `GameState` with one store of PGN.
 * `docs/04-game-core.md` asks for PGN because it survives refactors of the
 * internal shape and is directly exportable; a stored `GameState` breaks
 * silently the first time a field changes. Nothing had ever written to the v1
 * stores — persistence was never wired up — so the upgrade drops them.
 */
const DB_VERSION = 2;
const STORE = "games";

/** Oldest are pruned past this on write (`docs/04-game-core.md`). */
const RETAIN_GAMES = 50;

/** A game older than this is not offered for resume. */
const RESUME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const SAVE_DEBOUNCE_MS = 500;

export interface StoredGame {
  id: string;
  pgn: string;
  difficulty: number;
  humanColor: Color;
  updatedAt: number;
  completed: boolean;

  /*
   * The clock, which a PGN cannot carry. Both are optional and are read as a
   * pair: a record written before they existed resumes without a clock, the
   * way every resumed game used to. No schema version rides on this — the
   * store has one keyPath and no indexes, so a new field is just a new field.
   */
  timeControlId?: string;
  /** Banked at write time. See the note in `toRecord`. */
  clockRemaining?: { white: number; black: number };
}

let dbPromise: Promise<IDBPDatabase | null> | null = null;

function getDB(): Promise<IDBPDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const stale of ["active-game", "game-history"]) {
          if (db.objectStoreNames.contains(stale)) db.deleteObjectStore(stale);
        }
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    }).catch(() => null);
  }
  return dbPromise;
}

/**
 * Whether games can be stored at all. False in private browsing and when the
 * quota is exhausted; the app then runs entirely in memory, with no resume
 * affordance and no error dialog (`docs/04-game-core.md`).
 */
export async function isStorageAvailable(): Promise<boolean> {
  return (await getDB()) !== null;
}

/** Exported for the tests: the whole of what persistence decides is here. */
export function toRecord(state: GameState): StoredGame {
  /*
   * The running side's time is banked here rather than stored as-is, because
   * `ClockState.runningSince` is a `performance.now()` reading — an offset from
   * this page load, which means nothing to the next one. Writing the derived
   * remaining instead makes the record self-contained.
   *
   * The write also happens as the tab goes away (see the visibilitychange and
   * beforeunload listeners below), so what is banked is the time spent up to
   * the moment the player left. Time away from the page is never charged.
   */
  const now = performance.now();

  return {
    id: state.id,
    pgn: serializePgn(state),
    difficulty: state.difficulty,
    humanColor: state.humanColor,
    updatedAt: Date.now(),
    completed: state.status.kind === "over",
    ...(state.timeControlId ? { timeControlId: state.timeControlId } : {}),
    ...(state.clock
      ? {
          clockRemaining: {
            white: remainingFor(state.clock, "white", now),
            black: remainingFor(state.clock, "black", now),
          },
        }
      : {}),
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingStateToSave: GameState | null = null;

/**
 * Writes the pending game immediately. Called on the debounce timer, and
 * directly when the tab is about to go away — a 500ms window is long enough to
 * lose the last move to a closed tab.
 */
export async function flushGame(state?: GameState): Promise<void> {
  const target = state ?? pendingStateToSave;
  if (!target) return;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingStateToSave = null;

  const db = await getDB();
  if (!db) return;

  try {
    await db.put(STORE, toRecord(target));
    await pruneGames(db);
  } catch {
    // Storage unavailable; the game continues in memory.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pendingStateToSave) {
      flushGame();
    }
  });
  window.addEventListener("beforeunload", () => {
    if (pendingStateToSave) flushGame();
  });
}

/** Debounced. Never on the critical path of applying a move. */
export function saveGame(state: GameState): void {
  pendingStateToSave = state;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushGame();
  }, SAVE_DEBOUNCE_MS);
}

async function pruneGames(db: IDBPDatabase): Promise<void> {
  try {
    const all = (await db.getAll(STORE)) as StoredGame[];
    if (all.length <= RETAIN_GAMES) return;
    const doomed = all
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(RETAIN_GAMES);
    for (const record of doomed) {
      await db.delete(STORE, record.id);
    }
  } catch {
    // Pruning is housekeeping; failing it must not fail the write.
  }
}

/**
 * The game to offer resuming, or null. Most recent incomplete game, within a
 * week. Older than that and the offer is noise rather than help.
 */
export async function loadResumableGame(): Promise<StoredGame | null> {
  const db = await getDB();
  if (!db) return null;

  try {
    const all = (await db.getAll(STORE)) as StoredGame[];
    const cutoff = Date.now() - RESUME_MAX_AGE_MS;
    const candidates = all
      .filter((g) => !g.completed && g.updatedAt >= cutoff && g.pgn)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

export async function deleteGame(id: string): Promise<void> {
  if (pendingStateToSave?.id === id) {
    pendingStateToSave = null;
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  const db = await getDB();
  if (!db) return;
  try {
    await db.delete(STORE, id);
  } catch {
    // Storage unavailable.
  }
}

export function downloadPgn(state: GameState): void {
  if (typeof window === "undefined") return;

  const pgnText = serializePgn(state);
  const blob = new Blob([pgnText], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `voxel-chess-${new Date().toISOString().slice(0, 10)}.pgn`;
  a.click();
  URL.revokeObjectURL(url);
}
