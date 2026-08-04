export interface Palette {
  base: string; // '#'
  accent: string; // '+'
  shade: string; // '-'
  detail: string; // 'o'
}

/**
 * Two families now, where there were three.
 *
 *  - The housing inks are light, and are read against dark moulded plastic.
 *  - The display levels are emitted, and are read against near-black glass.
 *
 * `accent` and `boardAccent` were split apart when the chrome was a pale
 * housing, because gold is 1.1:1 on cream and could not be type there. The
 * machine is dark again, so they have been reunited: the highlight on the board
 * and the accent in the rail are one colour, which is the whole point of the
 * split existing in the first place. `boardAccent*` remain as separate fields
 * because `OverlayManager` reads them by name, but they now hold the same
 * values the housing does.
 */
export interface ThemeTokens {
  /** The room the board sits in. The housing stands on it, a step lighter. */
  bg: string;

  // --- Housing: moulded ABS, and the inks printed on it -------------------
  /** A slot moulded into the housing. */
  surface: string;
  /** The material itself. Every --voxel-* value is derived from this. */
  surfaceRaised: string;
  /**
   * The lit edge of anything raised, and the load-bearing value of the whole
   * dark palette.
   *
   * On a pale housing, depth read downwards: the moulded gap around a keycap
   * was `material x 0.30`, which fell to near-black and carried the 3:1
   * boundary between a control and its panel on its own. There is no headroom
   * below a dark material — the same multiplier gives 1.28:1 — so depth reads
   * *upwards* instead, and this edge is what says "raised". Solved per theme by
   * tinting the deck toward that theme's own sheen until it clears 3.05:1, and
   * asserted in `tests/unit/ui.test.ts`.
   */
  bevel: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  /** The signal ink. Light, because the housing is dark. */
  accent: string;
  /** A step lighter again: pressed states and the focus ring. */
  accentBright: string;
  /** A step darker: the rule under a heading. Decorative, so 3:1 not 4.5:1. */
  accentDim: string;
  warning: string;
  error: string;
  success: string;

  // --- Board: read against the dark room ----------------------------------
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
    /*
     * The housing is moulded from the black pieces' urushi, the way it used to
     * be moulded from the white pieces' boxwood — the same machine, cut from
     * the other set. Gold returns as the signal ink: it was retired from the
     * DOM at 1.1:1 on cream and reads 9.14:1 here.
     */
    cssTokens: {
      bg: "#090605",
      surface: "#201914",
      surfaceRaised: "#2E231C",
      bevel: "#7A6F61",
      border: "#54493E",
      borderStrong: "#7A6F61",
      text: "#E7DAC3",
      textDim: "#B0A491",
      textFaint: "#998D7C",
      accent: "#E8C558",
      accentBright: "#F2DFA3",
      accentDim: "#C9A227",
      premove: "#D1462F",
      premoveDim: "#8E2E1F",
      warning: "#E0A845",
      error: "#E8654A",
      success: "#9CBF6E",
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
      surface: "#293038",
      surfaceRaised: "#3A4550",
      bevel: "#8F9291",
      border: "#60686D",
      borderStrong: "#8F9291",
      text: "#E8E2D4",
      textDim: "#D1CEC3",
      textFaint: "#B6B4AE",
      accent: "#A8C4B4",
      accentBright: "#CFDFD6",
      accentDim: "#8FA89B",
      premove: "#B08D57",
      premoveDim: "#7A6139",
      warning: "#D9A96C",
      error: "#EB9E8C",
      success: "#9EBA8B",
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
      surface: "#181818",
      surfaceRaised: "#222222",
      bevel: "#6E6E6E",
      border: "#474747",
      borderStrong: "#6E6E6E",
      text: "#D7D7D7",
      textDim: "#A2A2A2",
      textFaint: "#8D8D8D",
      accent: "#FFFFFF",
      // The one theme with no headroom above its accent, so the focus ring
      // steps down instead of up. It only has to be distinct and legible on
      // the deck, and both still hold.
      accentBright: "#E4E4E4",
      accentDim: "#999999",
      premove: "#888888",
      premoveDim: "#555555",
      warning: "#BBBBBB",
      error: "#DDDDDD",
      success: "#AAAAAA",
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
    // The theme that most needed this: a red-brown accent on a sage machine was
    // the one place two hues were arguing. Both are green now.
    cssTokens: {
      bg: "#0D1412",
      surface: "#1F2B22",
      surfaceRaised: "#2D3E30",
      bevel: "#7D897C",
      border: "#516053",
      borderStrong: "#7D897C",
      text: "#E2E8DD",
      textDim: "#BAC3B7",
      textFaint: "#A1AB9F",
      accent: "#A3C985",
      accentBright: "#CCE1BC",
      accentDim: "#87A96B",
      premove: "#D4A373",
      premoveDim: "#966F4A",
      warning: "#D9B172",
      error: "#E2906A",
      success: "#9CC97E",
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
 * the same moulding the deck is, so it is read against the same plastic and has
 * to come from the family that was solved against it. Passing a piece palette
 * instead would put a urushi-coloured icon on a urushi-coloured key.
 *
 * The renderer multiplies these by the face shading, so every value only gets
 * darker from here — which on a dark deck now works *against* the icon rather
 * than for it. The front face at 0.72 is the worst case, and it is the one the
 * contrast test asserts.
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
   * the material itself rather than a shaded fraction of it.
   *
   * Which direction depth reads in is the thing that changed when the machine
   * went dark. On a pale housing it read *down*: the moulded gap a keycap sits
   * in was `material x 0.30`, falling to near-black, and that gap carried the
   * 3:1 boundary between a control and its panel by itself. A dark material has
   * no headroom below — the same multiplier gives 1.28:1, and the keys dissolve
   * into the deck. So depth reads *up*, and `bevel` is the value that says
   * "raised". It is solved per theme rather than multiplied out of the
   * material, because a multiplier cannot go the way this needs to go.
   *
   * The mesher's sideX and bottom are still used unchanged for the remaining
   * edges, so a keycap edge and a pawn's edge are lit by one imaginary sun.
   */
  const material = tokens.surfaceRaised;
  const specular = tokens.bevel;
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
   * `--voxel-top` is the lit edge and nothing else — a background at that value
   * would be a flare. Hover is the deck brought partway toward it, which on a
   * dark machine is a surface catching more light rather than less.
   */
  root.style.setProperty("--voxel-hover", tintHex(material, specular, 0.28));

  /*
   * The three depths below the deck. They still go down, and they are still
   * worth having — a slot reads as a slot — but none of them carries a contrast
   * requirement any more. There is not enough room between a dark deck and
   * black for them to: seam lands 1.28:1 from the face. Anything that has to be
   * *identified* is identified by its lit edge instead.
   */
  root.style.setProperty("--voxel-recess", shadeHex(material, RECESS_SHADING));
  root.style.setProperty("--voxel-seam", shadeHex(material, SEAM_SHADING));
  root.style.setProperty("--voxel-well", shadeHex(material, WELL_SHADING));

  /*
   * Same treatment for the accent, used by pressed and active controls — and
   * inverted the same way. The accent keycap is the accent at full value rather
   * than a shaded fraction of it, because the knockout legend on top of it is
   * the deck colour: taking the face down to 0.72 first drops that legend to
   * 3.4:1, under the floor for text.
   */
  root.style.setProperty("--voxel-accent-face", tokens.accent);
  root.style.setProperty(
    "--voxel-accent-top",
    tintHex(tokens.accent, tokens.accentBright, 0.6),
  );
  root.style.setProperty(
    "--voxel-accent-under",
    shadeHex(tokens.accent, FACE_SHADING.sideZ),
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

  // Dark text knocked out of a bright accent fill — the primary keycap. The
  // deck itself, so the legend reads as the moulding showing through the paint.
  root.style.setProperty("--knockout", material);
}
