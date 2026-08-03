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
  warning: string;
  error: string;
  success: string;
}

export interface Theme {
  id: string;
  label: string;
  white: Palette;
  black: Palette;
  lightSquare: string;
  darkSquare: string;
  frame: string;
  /** One-voxel inlay line separating the frame from the playing surface. */
  frameInlay: string;
  background: string;
  /** Upper wall of the room, lit; `background` is the floor it falls to. */
  backgroundTop: string;
  cssTokens: ThemeTokens;
}

export const THEMES: Record<string, Theme> = {
  lacquer: {
    id: "lacquer",
    label: "Lacquer",
    // Shade sits close to base on purpose. A recessed course is a groove, not
    // a gap: pushed any darker it reads as a break and the piece stops being
    // one object.
    white: {
      base: "#EDE0C8", // boxwood
      accent: "#FBF3E0",
      shade: "#D8CAAC",
      detail: "#D1462F", // vermilion
    },
    black: {
      base: "#2E231C", // urushi
      accent: "#4A3828",
      shade: "#241B15",
      detail: "#C9A227", // maki-e gold
    },
    // The squares sit between the two piece colours in value so neither set
    // dissolves into the board. Pushing them further apart makes the board
    // shout over the pieces, which is the wrong way round.
    lightSquare: "#9C7F5C",
    darkSquare: "#4A3324",
    frame: "#241813",
    frameInlay: "#8A6B2E",
    background: "#0A0705",
    backgroundTop: "#1F1610",
    cssTokens: {
      bg: "#090605",
      surface: "#17120F",
      surfaceRaised: "#302722",
      border: "#33291F",
      borderStrong: "#4A3B2A",
      text: "#EDE0C8",
      textDim: "#B5A489",
      textFaint: "#93836C",
      accent: "#C9A227",
      accentBright: "#E8C558",
      accentDim: "#8A6B2E",
      premove: "#D1462F",
      premoveDim: "#8E2E1F",
      warning: "#D98E2B",
      error: "#C4402B",
      success: "#8A9A5B",
    },
  },
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
    frameInlay: "#5E7268",
    background: "#14171A",
    backgroundTop: "#2A3138",
    cssTokens: {
      bg: "#0E1013",
      surface: "#191C20",
      surfaceRaised: "#3A4049",
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
      warning: "#C87F4A",
      error: "#C25B54",
      success: "#7A9E6B",
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
    frameInlay: "#6E6E6E",
    background: "#0D0D0D",
    backgroundTop: "#242424",
    cssTokens: {
      bg: "#080808",
      surface: "#151515",
      surfaceRaised: "#313131",
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
      warning: "#BBBBBB",
      error: "#DDDDDD",
      success: "#AAAAAA",
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
    frameInlay: "#8FA96B",
    background: "#131C1A",
    backgroundTop: "#2A3B35",
    cssTokens: {
      bg: "#0D1412",
      surface: "#18211E",
      surfaceRaised: "#3C534C",
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
      warning: "#D9A05B",
      error: "#C25B54",
      success: "#87A96B",
    },
  },
};

/**
 * The mesher bakes a fixed multiplier into each cube face. The DOM reuses the
 * same four numbers so a panel and a piece are lit by the same imaginary sun.
 * Kept in sync with FACE_SHADING in ./mesher.ts.
 */
export const FACE_SHADING = {
  top: 1.0,
  bottom: 0.55,
  sideX: 0.82,
  sideZ: 0.72,
} as const;

/**
 * Deeper than any face the mesher produces, because it is not a face — it is
 * the floor of a hole cut into the material. The notation field is the one
 * surface in the app you push into rather than press on, and it needs a value
 * below the shadowed bottom edge for that reading to hold.
 */
export const WELL_SHADING = 0.45;

/** Multiplies a hex colour by a scalar, the way the mesher shades a face. */
export function shadeHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const g = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

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
  root.style.setProperty("--warning", tokens.warning);
  root.style.setProperty("--error", tokens.error);
  root.style.setProperty("--success", tokens.success);

  // Extrusion set: a DOM panel is a voxel seen head-on, so its front is a Z
  // face, its top edge catches the sun, its right edge is an X face, and its
  // bottom edge is in shadow.
  const material = tokens.surfaceRaised;
  root.style.setProperty(
    "--voxel-face",
    shadeHex(material, FACE_SHADING.sideZ),
  );
  root.style.setProperty("--voxel-top", shadeHex(material, FACE_SHADING.top));
  root.style.setProperty(
    "--voxel-side",
    shadeHex(material, FACE_SHADING.sideX),
  );
  root.style.setProperty(
    "--voxel-under",
    shadeHex(material, FACE_SHADING.bottom),
  );
  root.style.setProperty("--voxel-well", shadeHex(material, WELL_SHADING));

  // Same treatment for the accent, used by pressed and active controls.
  root.style.setProperty(
    "--voxel-accent-face",
    shadeHex(tokens.accent, FACE_SHADING.sideZ),
  );
  root.style.setProperty("--voxel-accent-top", tokens.accent);
  root.style.setProperty(
    "--voxel-accent-under",
    shadeHex(tokens.accent, FACE_SHADING.bottom),
  );
}
