import { create } from 'zustand'
import { GameState } from '../core/types'
import { FIXTURE_FENS } from '../../tests/fixtures/positions'

export type Store = GameState & {
  setState: (fn: (prev: GameState) => Partial<GameState>) => void
}

export const initialGameState: GameState = {
  id: 'game-1',
  initialFen: FIXTURE_FENS.START,
  humanColor: 'white',
  difficulty: 4,
  history: [],
  cursor: 0,
  status: { kind: 'setup' },
  premoves: [],
  selectedSquare: null,
  boardFlipped: false,
  startedAt: Date.now()
}

export const useGameStore = create<Store>((set) => ({
  ...initialGameState,
  setState: (fn) => set((prev) => fn(prev))
}))
