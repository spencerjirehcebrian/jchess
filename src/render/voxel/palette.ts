export interface Palette {
  base: string; // '#'
  accent: string; // '+'
  shade: string; // '-'
  detail: string; // 'o'
}

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentBright: string;
  accentDim: string;
  premove: string;
  premoveDim: string;
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
  cssTokens: ThemeTokens;
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
    cssTokens: {
      bg: "#1A1D21",
      surface: "#23272C",
      surfaceRaised: "#2C3138",
      border: "#383E46",
      borderStrong: "#4A525C",
      text: "#E4E7EA",
      textDim: "#9AA3AC",
      textFaint: "#656D76",
      accent: "#8FA89B",
      accentBright: "#A8C4B4",
      accentDim: "#5E7268",
      premove: "#B08D57",
      premoveDim: "#7A6139",
    },
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
    cssTokens: {
      bg: "#121212",
      surface: "#1B1B1B",
      surfaceRaised: "#242424",
      border: "#333333",
      borderStrong: "#444444",
      text: "#F0F0F0",
      textDim: "#A0A0A0",
      textFaint: "#666666",
      accent: "#999999",
      accentBright: "#FFFFFF",
      accentDim: "#666666",
      premove: "#888888",
      premoveDim: "#555555",
    },
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
    cssTokens: {
      bg: "#1A2421",
      surface: "#23312D",
      surfaceRaised: "#2D3E39",
      border: "#3A4E47",
      borderStrong: "#4E685F",
      text: "#E2E8DD",
      textDim: "#9FB197",
      textFaint: "#657963",
      accent: "#87A96B",
      accentBright: "#A3C985",
      accentDim: "#5B7846",
      premove: "#D4A373",
      premoveDim: "#966F4A",
    },
  },
};

export function applyThemeToCss(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const tokens = theme.cssTokens;
  if (!tokens) return;

  root.style.setProperty("--bg", tokens.bg);
  root.style.setProperty("--surface", tokens.surface);
  root.style.setProperty("--surface-raised", tokens.surfaceRaised);
  root.style.setProperty("--border", tokens.border);
  root.style.setProperty("--border-strong", tokens.borderStrong);
  root.style.setProperty("--text", tokens.text);
  root.style.setProperty("--text-dim", tokens.textDim);
  root.style.setProperty("--text-faint", tokens.textFaint);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-bright", tokens.accentBright);
  root.style.setProperty("--accent-dim", tokens.accentDim);
  root.style.setProperty("--premove", tokens.premove);
  root.style.setProperty("--premove-dim", tokens.premoveDim);
}

