export interface Palette {
  base: string; // '#'
  accent: string; // '+'
  shade: string; // '-'
  detail: string; // 'o'
}

export interface Theme {
  id: string;
  label: string;
  white: Palette;
  black: Palette;
  lightSquare: string;
  darkSquare: string;
  frame: string;
  background: string;
}

export const THEMES: Record<string, Theme> = {
  oxide: {
    id: "oxide",
    label: "Oxide",
    white: {
      base: "#E8E2D4",
      accent: "#FFFAF0",
      shade: "#C4BCA8",
      detail: "#8FA89B",
    },
    black: {
      base: "#3A4550",
      accent: "#4E5B68",
      shade: "#252D35",
      detail: "#B08D57",
    },
    lightSquare: "#B8B0A0",
    darkSquare: "#6E6A63",
    frame: "#2A2E33",
    background: "#1A1D21",
  },
  monochrome: {
    id: "monochrome",
    label: "Monochrome",
    white: {
      base: "#F0F0F0",
      accent: "#FFFFFF",
      shade: "#CCCCCC",
      detail: "#999999",
    },
    black: {
      base: "#222222",
      accent: "#444444",
      shade: "#111111",
      detail: "#666666",
    },
    lightSquare: "#A0A0A0",
    darkSquare: "#505050",
    frame: "#1F1F1F",
    background: "#121212",
  },
  forest: {
    id: "forest",
    label: "Forest",
    white: {
      base: "#E2E8DD",
      accent: "#F4F7F2",
      shade: "#C5D1BC",
      detail: "#87A96B",
    },
    black: {
      base: "#2D3E30",
      accent: "#3E5442",
      shade: "#1E2B20",
      detail: "#D4A373",
    },
    lightSquare: "#A3B18A",
    darkSquare: "#588157",
    frame: "#344E41",
    background: "#1A2421",
  },
};
