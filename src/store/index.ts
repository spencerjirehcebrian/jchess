import { create } from "zustand";
import { GameState, START_FEN } from "../core/types";

export type Store = GameState & {
  setState: (fn: (prev: GameState) => Partial<GameState>) => void;
};

export const initialGameState: GameState = {
  id: "game-1",
  initialFen: START_FEN,
  humanColor: "white",
  difficulty: 2,
  theme: "lacquer",
  maxPremoves: 3,
  boardSize: "full",
  history: [],
  cursor: 0,
  status: { kind: "setup" },
  premoves: [],
  selectedSquare: null,
  boardFlipped: false,
  startedAt: Date.now(),
};

export const useGameStore = create<Store>((set) => ({
  ...initialGameState,
  setState: (fn) => set((prev) => fn(prev)),
}));
