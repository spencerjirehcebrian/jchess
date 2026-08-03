import { SearchBudget } from "../engine/types";

export interface DifficultyLevel {
  id: number; // 1-8
  label: string;
  approxElo: number;
  uciOptions: Record<string, string | number | boolean>;
  budget: SearchBudget;
  thinkTimeFloorMs: [min: number, max: number]; // artificial delay range
  requiresThreads: boolean;
}

export const DIFFICULTY_LEVELS: Record<number, DifficultyLevel> = {
  1: {
    id: 1,
    label: "Beginner",
    approxElo: 800,
    uciOptions: {
      "Skill Level": 0,
      UCI_LimitStrength: true,
      UCI_Elo: 1320,
    },
    budget: { nodes: 8000, depth: 4 },
    thinkTimeFloorMs: [500, 900],
    requiresThreads: false,
  },
  2: {
    id: 2,
    label: "Casual",
    approxElo: 1000,
    uciOptions: {
      "Skill Level": 3,
      UCI_LimitStrength: true,
      UCI_Elo: 1400,
    },
    budget: { nodes: 20000, depth: 6 },
    thinkTimeFloorMs: [450, 800],
    requiresThreads: false,
  },
  3: {
    id: 3,
    label: "Club",
    approxElo: 1400,
    uciOptions: {
      "Skill Level": 6,
      UCI_LimitStrength: true,
      UCI_Elo: 1600,
    },
    budget: { nodes: 50000, depth: 8 },
    thinkTimeFloorMs: [400, 750],
    requiresThreads: false,
  },
  4: {
    id: 4,
    label: "Strong club",
    approxElo: 1700,
    uciOptions: {
      "Skill Level": 10,
      UCI_LimitStrength: true,
      UCI_Elo: 1800,
    },
    budget: { nodes: 150000, depth: 10 },
    thinkTimeFloorMs: [350, 700],
    requiresThreads: false,
  },
  5: {
    id: 5,
    label: "Expert",
    approxElo: 2000,
    uciOptions: {
      "Skill Level": 14,
      UCI_LimitStrength: true,
      UCI_Elo: 2100,
    },
    budget: { nodes: 400000, depth: 14 },
    thinkTimeFloorMs: [300, 650],
    requiresThreads: false,
  },
  6: {
    id: 6,
    label: "Master",
    approxElo: 2300,
    uciOptions: {
      "Skill Level": 18,
      UCI_LimitStrength: true,
      UCI_Elo: 2400,
    },
    budget: { nodes: 1200000, depth: 18 },
    thinkTimeFloorMs: [250, 600],
    requiresThreads: false,
  },
  7: {
    id: 7,
    label: "Grandmaster",
    approxElo: 2600,
    uciOptions: {
      "Skill Level": 20,
      UCI_LimitStrength: false,
    },
    budget: { nodes: 5000000 },
    thinkTimeFloorMs: [200, 500],
    requiresThreads: true,
  },
  8: {
    id: 8,
    label: "Maximum",
    approxElo: 3000,
    uciOptions: {
      "Skill Level": 20,
      UCI_LimitStrength: false,
    },
    budget: { movetime: 2000 },
    thinkTimeFloorMs: [0, 0],
    requiresThreads: true,
  },
};

export function getDifficulty(level: number): DifficultyLevel {
  const diff = DIFFICULTY_LEVELS[level];
  if (!diff) return DIFFICULTY_LEVELS[4]!;
  return diff;
}
