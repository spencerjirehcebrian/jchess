import { openDB, IDBPDatabase } from "idb";
import { GameState } from "../core/types";
import { serializePgn } from "../core/pgn";

const DB_NAME = "jchess-db";
const DB_VERSION = 1;

interface SavedGameRecord {
  id: string;
  state: GameState;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase | null> | null = null;

function getDB(): Promise<IDBPDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("active-game")) {
          db.createObjectStore("active-game", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("game-history")) {
          db.createObjectStore("game-history", { keyPath: "id" });
        }
      },
    }).catch(() => null);
  }
  return dbPromise;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingStateToSave: GameState | null = null;

export async function flushActiveGame(state?: GameState): Promise<void> {
  const targetState = state ?? pendingStateToSave;
  if (!targetState) return;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingStateToSave = null;
  const db = await getDB();
  if (!db) return;

  try {
    const record: SavedGameRecord = {
      id: "active",
      state: targetState,
      updatedAt: Date.now(),
    };
    await db.put("active-game", record);
  } catch {
    // Storage unavailable
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pendingStateToSave) {
      flushActiveGame();
    }
  });
  window.addEventListener("beforeunload", () => {
    if (pendingStateToSave) {
      flushActiveGame();
    }
  });
}

export async function saveActiveGame(state: GameState): Promise<void> {
  pendingStateToSave = state;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    flushActiveGame();
  }, 500);
}

export async function loadActiveGame(): Promise<GameState | null> {
  const db = await getDB();
  if (!db) return null;

  try {
    const record = (await db.get("active-game", "active")) as
      SavedGameRecord | undefined;
    return record ? record.state : null;
  } catch {
    return null;
  }
}

export async function clearActiveGame(): Promise<void> {
  const db = await getDB();
  if (!db) return;

  try {
    await db.delete("active-game", "active");
  } catch {
    // Storage unavailable
  }
}

export async function archiveGame(state: GameState): Promise<void> {
  const db = await getDB();
  if (!db) return;

  try {
    const record: SavedGameRecord = {
      id: state.id || `game-${Date.now()}`,
      state,
      updatedAt: Date.now(),
    };
    await db.put("game-history", record);
    await clearActiveGame();
  } catch {
    // Storage unavailable
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
