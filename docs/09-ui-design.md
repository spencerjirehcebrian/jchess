# 09 — UI Design

## Direction

The board is a physical object rendered in a dark room. Everything around it is instrumentation: quiet, precise, and technical. The DOM chrome must never compete with the scene for attention.

**One material system, two renderers.** The mesher bakes a fixed multiplier into
each cube face — top 1.00, X sides 0.82, Z sides 0.72, bottom 0.55. The DOM
reuses those same four numbers, so a button and a pawn are lit by one imaginary
sun. A panel is a voxel seen head-on: its front is a Z face, its top edge
catches the light, its right edge is an X face, its bottom edge is in shadow.
Corners step rather than curve, matching the two-voxel taper on every piece
base. Radius is zero; there are no blurred shadows anywhere.

`applyThemeToCss()` derives the `--voxel-*` set from the active theme, so the
chrome re-lights itself when the board does.

**The UI's icons are the assets.** `renderPieceSprite()` reads the same voxel
grids the renderer meshes and draws each piece's front elevation as a pixel
sprite. The captured tray, the promotion picker and any future piece icon use
those. Drawing a second set of illustrations would mean maintaining two versions
of six shapes, and they would drift.

**The signature element is the notation field.** It sits directly beneath the board, always focused, showing live candidate matches as the user types. It is the thing that makes this app feel different from every other chess UI, so it gets the strongest typographic treatment and the most careful interaction polish.

## Tokens

`src/styles/tokens.css`. Every value in the app derives from these; no literal colours or sizes at usage sites.

See `src/styles/tokens.css`. Colour defaults are the Lacquer theme and every
one of them is overwritten at runtime by `applyThemeToCss()`; the literals exist
so the first paint matches the scene instead of flashing a grey shell.

```css
:root {
  /* Surface — warm lacquer ramp */
  --bg:            #100C0A;
  --surface:       #1A1512;
  --surface-raised:#241D18;
  --border:        #33291F;
  --border-strong: #4A3B2A;

  /* Text — the lightest value is the white pieces' own boxwood */
  --text:          #EDE0C8;
  --text-dim:      #B5A489;
  --text-faint:    #93836C;

  /* Accent — maki-e gold, the black pieces' detail voxel */
  --accent:        #C9A227;
  --accent-bright: #E8C558;
  --accent-dim:    #8A6B2E;

  /* Premove — vermilion, the white pieces' detail voxel */
  --premove:       #D1462F;
  --premove-dim:   #8E2E1F;

  /* Extrusion set, derived from the mesher's face shading */
  --voxel-face:  ...;   /* material x 0.72 — the panel front  */
  --voxel-top:   ...;   /* material x 1.00 — the lit top edge */
  --voxel-side:  ...;   /* material x 0.82 — the right edge   */
  --voxel-under: ...;   /* material x 0.55 — the bottom edge  */

  /* Type */
  --font-display: 'Archivo', system-ui, sans-serif;
  --font-body:    'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:    'Departure Mono', ui-monospace, monospace;

  --vx: 4px;               /* one UI voxel; every gap is a whole number of them */
  --radius: 0;             /* voxels do not have corners */
}
```

**Typography roles:**

- `--font-display` — Archivo, variable weight and width. Section labels, the brand, the result banner. Used sparingly: heavy, expanded, uppercase, widely letter-spaced, so a label behaves like the gold inlay on the board frame — thin and rare.
- `--font-body` — IBM Plex Sans, variable. All prose, buttons, settings. Its squared terminals sit closer to the voxel grid than a humanist grotesque.
- `--font-mono` — Departure Mono. The notation field, move list, clocks, evaluation, coordinates. It is drawn on a pixel grid, which is the same grammar as the pieces — the type and the art are built the same way.

All three are self-hosted latin-subset woff2 in `public/fonts` (152KB total).
Cross-origin isolation blocks third-party font CDNs, so Google Fonts is not an
option — this is not a preference, it is a hard constraint of the COEP header.

## Layout

### Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────┐
│  VOXEL CHESS            level 4 · strong club      ⚙  ?  │  56px
├────────────────────────────────────┬─────────────────────┤
│                                    │  STOCKFISH          │
│                                    │  ●●●○ thinking      │
│                                    │  ─────────────────  │
│                                    │   1. e4      e5     │
│         [ canvas ]                 │   2. Nf3     Nc6    │
│                                    │   3. Bb5     a6     │
│                                    │   4. Ba4  ▸         │
│                                    │                     │
│                                    │  ─────────────────  │
│                                    │  YOU                │
├────────────────────────────────────┤  ─────────────────  │
│  ▸ Nf3_                            │  ↶ take back        │
│    Nf3  Nf6  Nc3                   │  ⇄ flip             │
├────────────────────────────────────┤  ⬒ new game         │
└────────────────────────────────────┴─────────────────────┘
                                          320px fixed
```

Board fills the left column, square, capped at 720px. Notation field directly beneath, full column width. Right rail fixed at 320px.

### Tablet (640–1023px)

Right rail collapses beneath the board. Move list becomes horizontally scrollable, showing the last six plies with the current move pinned right.

### Mobile (< 640px)

```
┌─────────────────────────┐
│ ⚙   level 4        ?    │
├─────────────────────────┤
│                         │
│      [ canvas ]         │
│                         │
├─────────────────────────┤
│ ▸ Nf3_                  │
├─────────────────────────┤
│ 4. Ba4  ▸    ●●●○       │
├─────────────────────────┤
│  ↶      ⇄      ⬒        │
└─────────────────────────┘
```

Board is square, full width. Notation field persists — mobile keyboards make it genuinely useful, and it is far faster than dragging on a small tilted board. Move list collapses to the current ply with a tap-to-expand sheet.

**Minimum supported width: 320px.**

## The notation field

The signature element. Treat it accordingly.

```
┌──────────────────────────────────────────────────┐
│  ▸  Nf3                                          │   --size-lg, mono
├──────────────────────────────────────────────────┤
│     Nf3   Nf6   Nc3   Nd2                        │   --size-sm, mono, dim
└──────────────────────────────────────────────────┘
```

- Caret is a solid block, not a line. Blinks at 530ms. It is drawn by the app, not the browser: the native caret is hidden and the buffer is painted into an overlay, because the field also renders the ghost completion inline on the same text run.
- The prefix already matched renders in `--text`; the remainder of each candidate renders in `--text-faint`, so the user sees the completion inline.
- Candidate row shows up to 8, then `+N more`.
- Exact match: left chevron turns `--accent-bright` and a subtle border glow appears.
- Rejection: 220ms shake, border flashes `--error`, text stays.
- Premove mode: chevron and border shift to `--premove`, placeholder changes.

No visible label. A permanently focused field with a live candidate list beneath it does not need one, and a label would weaken the element. Provide an `aria-label`.

## Move list

A real `<ol>`, monospaced, two columns of plies with the move number in `--text-faint`.

- Current ply highlighted with a left border in `--accent`, not a background fill.
- Clicking a ply enters history browsing.
- Auto-scrolls to keep the current ply visible; suppress auto-scroll while the user is browsing.
- Captures, checks, and mates are not decorated with extra symbols beyond the SAN itself. The SAN already carries them.

## Difficulty picker

Eight rungs as a vertical list, not a slider. Each shows the label and approximate Elo. A slider implies a continuum; the ladder is eight discrete, deliberately tuned configurations.

Levels 7 and 8 when unavailable (no cross-origin isolation): dimmed, not hidden, with a single line of explanatory text below the list. Hiding capabilities users cannot access is worse than explaining why.

## Status states

| State | Display |
|---|---|
| Loading engine | `preparing engine` with an indeterminate 2px bar |
| Your turn | `your move` in `--text-dim` |
| Engine thinking | `thinking` plus a four-dot depth indicator filling with search depth |
| Premove queued | `2 premoves queued` in `--premove` |
| Browsing history | `viewing move 12 · press ↓ to return` in `--warning` |
| Game over | Result banner: `--font-display`, uppercase, letter-spaced, with the reason beneath |

## Copy rules

- **Sentence case everywhere** except the `--font-display` labels, which are uppercase.
- **Active voice on every control.** "Take back", not "Undo move". "New game", not "Reset".
- **An action keeps its name through the flow.** The button that says "New game" produces a dialog titled "New game".
- **Errors state what happened and what to do.** Not "An error occurred". Write "The engine stopped responding. Start a new game to continue."
- **Errors do not apologise** and are never vague.
- **No exclamation marks. No emoji anywhere in the product.**
- **Never name internals.** The user has a difficulty level, not a `UCI_Elo` setting. The user premoves; they do not queue against a relaxed generator.

Specific strings:

| Situation | Copy |
|---|---|
| Engine loading | `Preparing engine` |
| Single-threaded fallback | `Running in single-thread mode. Levels 7 and 8 need a secure connection.` |
| Premove cancelled | `Premove no longer legal` |
| Move rejected | `Not a legal move` |
| Browsing history | `Viewing move 12. Press ↓ to return to the game.` |
| Move while browsing | `Return to the live position to move.` |
| Engine failure | `The engine stopped responding. Start a new game to continue.` |
| Storage unavailable | `Games won't be saved in this browser mode.` |
| Resume prompt | `You have an unfinished game from Tuesday. Resume it?` |

## Accessibility floor

Non-negotiable, verified before any milestone is considered done:

- Visible focus ring on every interactive element: 2px `--accent-bright`. `clip-path` crops an outline, so anything wearing the stepped-corner notch draws its focus ring as a 2px **inset** box-shadow instead. Never `outline: none` without a replacement.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders.
- `prefers-reduced-motion` respected throughout, including DOM transitions.
- ARIA live region announcing every move, check, and result.
- Full keyboard operability with no pointer.
- Touch targets ≥ 44px.
- No state conveyed by colour alone.
