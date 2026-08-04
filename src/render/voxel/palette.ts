export interface Palette {
  base: string; // '#'
  accent: string; // '+'
  shade: string; // '-'
  detail: string; // 'o'
}

/**
 * Three families, and they must not be mixed up, because they are seen against
 * three different backgrounds.
 *
 *  - The housing inks are dark, and are read against pale moulded plastic.
 *  - The board signals are bright, and are read against the dark room.
 *  - The display levels are emitted, and are read against near-black glass.
 *
 * The split exists because `accent` used to do the first two jobs at once: it
 * was the gold on the board's last-move highlight *and* the accent colour of
 * the DOM. Once the chrome became a pale housing those requirements inverted —
 * gold is 1.1:1 on the deck and invisible — so they are now separate fields.
 */
export interface ThemeTokens {
  /** The room the board sits in. Stays dark; the housing is painted over it. */
  bg: string;

  // --- Housing: moulded ABS, and the inks printed on it -------------------
  /** A slot moulded into the housing. */
  surface: string;
  /** The material itself. Every --voxel-* value is derived from this. */
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  /** The signal ink. Dark, because the housing is pale. */
  accent: string;
  /** A step darker again: pressed states and the focus ring. */
  accentBright: string;
  /** A step lighter: the rule under a heading. Decorative, so 3:1 not 4.5:1. */
  accentDim: string;
  warning: string;
  error: string;
  success: string;

  // --- Board: read against the dark room, so these stay bright -------------
  /** Last move, selection, legal destinations. Consumed by OverlayManager. */
  boardAccent: string;
  /** The drop-target outline. Consumed by OverlayManager. */
  boardAccentBright: string;
  /** Queued premove destinations. Board only. */
  premove: string;
  premoveDim: string;

  // --- Display -------------------------------------------------------------
  /**
   * A lit pixel. The rest of the LCD ramp is derived from it — see LCD_SHADING
   * — because a display is one emitter at several strengths, not several
   * independently chosen colours.
   */
  lcdOn: string;
  /** The one hue the display is allowed besides its own: an alert segment. */
  lcdAlert: string;
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
      surface: "#867D6B",
      surfaceRaised: "#D8CAAC",
      border: "#B1A68D",
      borderStrong: "#867D6B",
      text: "#23201C",
      textDim: "#484339",
      textFaint: "#5A5448",
      accent: "#8E2E1F",
      accentBright: "#662116",
      accentDim: "#A45D49",
      premove: "#D1462F",
      premoveDim: "#8E2E1F",
      warning: "#744C17",
      error: "#983221",
      success: "#4F5934",
      lcdOn: "#A8C08A", // phosphor green, the classic module
      boardAccent: "#C9A227",
      boardAccentBright: "#E8C558",
      lcdAlert: "#E8654A",
    
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
      surface: "#7A7568",
      surfaceRaised: "#C4BCA8",
      border: "#A19A8A",
      borderStrong: "#7A7568",
      text: "#10100E",
      textDim: "#3C3A34",
      textFaint: "#4E4B43",
      accent: "#674319",
      accentBright: "#4A3012",
      accentDim: "#7D603B",
      premove: "#B08D57",
      premoveDim: "#7A6139",
      warning: "#684226",
      error: "#783834",
      success: "#3E5036",
      lcdOn: "#9CC4B4", // a cooler green, to sit with the slate housing
      boardAccent: "#8FA89B",
      boardAccentBright: "#A8C4B4",
      lcdAlert: "#E5836B",
    
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
      surface: "#7E7E7E",
      surfaceRaised: "#CCCCCC",
      border: "#A7A7A7",
      borderStrong: "#7E7E7E",
      text: "#212121",
      textDim: "#444444",
      textFaint: "#555555",
      accent: "#3A3A3A",
      accentBright: "#2A2A2A",
      accentDim: "#707070",
      premove: "#888888",
      premoveDim: "#555555",
      warning: "#555555",
      error: "#4A4A4A",
      success: "#555555",
      lcdOn: "#D0D0D0", // neutral: a coloured readout would break the theme
      boardAccent: "#999999",
      boardAccentBright: "#FFFFFF",
      lcdAlert: "#FFFFFF",
    
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
      surface: "#7A8275",
      surfaceRaised: "#C5D1BC",
      border: "#A2AB9A",
      borderStrong: "#7A8275",
      text: "#20221F",
      textDim: "#42463F",
      textFaint: "#52574E",
      accent: "#7A4020",
      accentBright: "#582E17",
      accentDim: "#8F694C",
      premove: "#D4A373",
      premoveDim: "#966F4A",
      warning: "#6D512E",
      error: "#89403B",
      success: "#465C36",
      lcdOn: "#A3C985", // the theme is already green; the display agrees
      boardAccent: "#87A96B",
      boardAccentBright: "#A3C985",
      lcdAlert: "#E0885F",
    
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

/**
 * Housing depths, below anything the mesher produces.
 *
 * `recess` is a slot moulded into the deck — the trophy tray, an unfilled
 * detent. `seam` is the dark gap a keycap sits in, and it is the one doing real
 * work: keys and deck are a single shot of plastic and therefore a single
 * colour, so the boundary between a control and the panel it sits on is not a
 * difference in value but the moulded gap around it. That gap is what clears
 * the 3:1 non-text contrast floor, which is why it is this dark.
 */
export const RECESS_SHADING = 0.62;
export const SEAM_SHADING = 0.3;

/** Mixes toward a target colour. Used for the hover tint, which has to go up. */
export function tintHex(hex: string, toward: string, amount: number): string {
  const a = parseInt(hex.replace("#", ""), 16);
  const b = parseInt(toward.replace("#", ""), 16);
  const mix = (shift: number) =>
    Math.round(
      (((a >> shift) & 0xff) * (1 - amount) + ((b >> shift) & 0xff) * amount),
    );
  const r = mix(16);
  const g = mix(8);
  const bl = mix(0);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

/**
 * The display, as one emitter at four strengths.
 *
 * `off` is the load-bearing one. A dot-matrix LCD does not go black between
 * glyphs — every cell in the grid stays faintly visible whether or not it is
 * driven, and that is what makes the module read as a physical thing that
 * exists when the power is off rather than as a hole cut in the panel. `field`
 * is the gutter between cells, darker still.
 *
 * Contrast is quoted against `off` rather than `field` throughout, because the
 * off-cell is the lightest thing that ever sits directly under a lit glyph.
 */
export const LCD_SHADING = {
  dim: 0.78,
  off: 0.18,
  field: 0.055,
} as const;

/** Multiplies a hex colour by a scalar, the way the mesher shades a face. */
export function shadeHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const g = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * The four materials a keycap legend is printed in.
 *
 * Housing inks rather than piece colours: an icon on a key is screen-printed on
 * the same moulding the deck is, so it is read against pale plastic and has to
 * come from the family that was solved against pale plastic. Passing a piece
 * palette instead would put a boxwood-coloured icon on a boxwood-coloured key.
 *
 * The renderer multiplies these by the face shading, so every value only gets
 * darker from here — which means the housing contrast floor the ink family
 * already clears is the worst case, not the best.
 */
export function inkPalette(tokens: ThemeTokens): Palette {
  return {
    base: tokens.textDim,
    accent: tokens.text,
    shade: tokens.textFaint,
    detail: tokens.accent,
  };
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

  /*
   * The housing.
   *
   * You are looking down at a control deck, so the surface you see is a +Y
   * face — the mesher's `top`, at full material value. That is why the deck is
   * the material itself rather than a shaded fraction of it, and it is what
   * makes the pale housing work at all: taking the front face at 0.72 instead
   * leaves only one ink above 4.5:1 and no readable red anywhere.
   *
   * The lit bevel along a raised edge is then a *specular* term, not a fifth
   * face. Moulded ABS has a hard sheen, and a specular highlight is legitimately
   * brighter than the diffuse maximum — which is the only way an edge can still
   * catch the light on a surface already at 1.00. It is the same boxwood the
   * white pieces are cut from, so the machine and the men it plays with are made
   * of one material.
   *
   * The mesher's sideX and bottom are used unchanged, so a keycap edge and a
   * pawn's edge are still lit by one imaginary sun.
   */
  const material = tokens.surfaceRaised;
  const specular = theme.white.base;
  root.style.setProperty("--voxel-face", shadeHex(material, FACE_SHADING.top));
  root.style.setProperty("--voxel-top", specular);
  root.style.setProperty(
    "--voxel-side",
    shadeHex(material, FACE_SHADING.sideX),
  );
  root.style.setProperty(
    "--voxel-under",
    shadeHex(material, FACE_SHADING.bottom),
  );

  /*
   * `--voxel-top` is the lit edge and nothing else. It used to double as a
   * hover background, which was harmless while it was a shade of the material
   * and is not now that it is a near-white sheen.
   */
  root.style.setProperty("--voxel-hover", tintHex(material, specular, 0.4));
  root.style.setProperty("--voxel-recess", shadeHex(material, RECESS_SHADING));
  root.style.setProperty("--voxel-seam", shadeHex(material, SEAM_SHADING));
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

  // The display. Not derived from the housing material: an LCD is a separate
  // object set into a window, not a recess moulded in the same shot of plastic.
  root.style.setProperty("--lcd-on", tokens.lcdOn);
  root.style.setProperty("--lcd-dim", shadeHex(tokens.lcdOn, LCD_SHADING.dim));
  root.style.setProperty("--lcd-off", shadeHex(tokens.lcdOn, LCD_SHADING.off));
  root.style.setProperty(
    "--lcd-field",
    shadeHex(tokens.lcdOn, LCD_SHADING.field),
  );
  root.style.setProperty("--lcd-alert", tokens.lcdAlert);

  // Light text knocked out of a dark accent fill — the primary keycap. It is
  // the specular value rather than the room, which on a dark --bg was 1.9:1.
  root.style.setProperty("--knockout", specular);
}
