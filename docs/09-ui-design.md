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

Two surfaces invert this. The transcript and the notation field are **wells**:
their light falls the other way — shadowed along the top edge, lit along the
bottom — so they read as cut into the material rather than sitting on it. The
notation field is the one thing in the app you type into, and the transcript is
the one thing the app writes into. Everything else is a block you press.

`--bg` sits well below `--voxel-face` on purpose. The panel front is a Z face at
0.72 of the material, so if the background is not pushed clear of that product
the chrome shades itself into the room and every panel disappears.

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
  --voxel-well:  ...;   /* material x 0.45 — the floor of a recess */

  /* Type */
  --font-display: 'Archivo', system-ui, sans-serif;
  --font-body:    'Archivo', system-ui, sans-serif;
  --font-mono:    'Departure Mono', ui-monospace, monospace;

  --vx: 4px;               /* one UI voxel; every gap is a whole number of them */
  --radius: 0;             /* voxels do not have corners */
}
```

**Typography roles:**

Two faces, and each owns a job. A third — IBM Plex Sans — used to sit between
them on the buttons, which are the most-looked-at chrome in the app, with no
relationship to either of these or to the board. It has been dropped.

- `--font-display` / `--font-body` — Archivo, variable weight and width. It
  **names** things. At its loudest, heavy and expanded, it is the wordmark, the
  result banner and the players. At label size it is the eyebrows, behaving like
  the gold inlay on the board frame — thin and rare. In between, condensed and
  uppercase at 13px, it is every button, select and rung. A control and a label
  are the same voice at two volumes.
- `--font-mono` — Departure Mono. It **states** things: the notation field, move
  list, clocks, evaluation, coordinates. It is drawn on a pixel grid, which is
  the same grammar as the pieces — the type and the art are built the same way.

Both are self-hosted latin-subset woff2 in `public/fonts` (112KB total).
Cross-origin isolation blocks third-party font CDNs, so Google Fonts is not an
option — this is not a preference, it is a hard constraint of the COEP header.

## Layout

### Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────┐
│  JCHESS                                                  │  56px
├────────────────────────────────────┬─────────────────────┤
│                                    │ STOCKFISH  thinking │
│                                    │ level 4 · club ●●●○ │
│                                    │ ♟ ♟                 │
│                                    ├─────────────────────┤
│                                    │  1. e4      e5      │
│         [ canvas ]                 │  2. Nf3     Nc6     │
│                                    │  3. Bb5   ▸         │
│                                    │                     │
│                                    ├─────────────────────┤
│                                    │ ♞ ♝            +1   │
│                                    │ YOU                 │
│                                    │ playing white  4:58 │
├────────────────────────────────────┼─────────────────────┤
│  ▸ Nf3_                            │ LEVEL     4 · club  │
│    Nf3  Nf6  Nc3                   │ ▰▰▰▰▱▱▱▱            │
│                                    ├─────────────────────┤
│                                    │ Take back    Flip   │
│                                    │ New game   Settings │
└────────────────────────────────────┴─────────────────────┘
                                          320px fixed
```

Board fills the left column, square, capped at 720px. Notation field directly beneath, full column width. Right rail fixed at 320px.

**The rail is one instrument, not a stack of cards.** A single `.vx-panel`
divided by hairlines, so the extrusion reads once at the scale of a real object
instead of once per card, where it only looks like noise.

**The two players bracket the transcript.** Stockfish above, you below, each
carrying their own name, the material they have taken, their advantage, and a
clock slot. Only the material mirrors — it sits against the transcript that
records the capturing — because both names still read before their own detail
line.

**Status belongs to the player it describes.** "Thinking" and the depth
indicator are things Stockfish is doing; "your move" is addressed to exactly one
of the two names on screen. There is no separate status bar. The side to move
carries the lit surface, and the status text beside it says the same thing in
words, so turn state is never colour alone.

The one message belonging to neither player — history browsing, engine failure —
gets a single line above the human row that collapses to nothing when silent.

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

- The field is a **well**: shadowed top edge, lit bottom edge, `--voxel-well`
  floor. It is the one surface you push into rather than press on.
- Caret is a solid block, not a line. Blinks at 530ms. It is drawn by the app, not the browser: the native caret is hidden and the buffer is painted into an overlay, because the field also renders the ghost completion inline on the same text run. It renders **only while the field has focus** — a caret blinking in an unfocused field claims you can type there, and since `clip-path` crops the native outline the caret and the focus ring are the only things marking focus.
- The candidate row is always live. With an empty buffer it lists the legal
  moves dimmed, so the field is a readout of what you can play rather than an
  input that waits to be filled.
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

Eight rungs, drawn as a ladder: one row of eight cells that fills from the left,
with the chosen rung carrying the bright edge. A select implies a list of
unrelated options and a slider implies a continuum; this is eight discrete,
deliberately tuned configurations that get harder left to right, so the control
fills the way strength does. The level name and approximate Elo read beside and
beneath it.

Levels 7 and 8 when unavailable (no cross-origin isolation): dithered and
disabled, not hidden, with the reason appended to the Elo line. Hiding
capabilities users cannot access is worse than explaining why.

## Status states

Each state is shown on the row it belongs to, not in a bar of its own.

| State | Where | Display |
|---|---|---|
| Loading engine | Stockfish row | `Preparing` |
| Engine thinking | Stockfish row | `Thinking` plus a four-dot depth indicator filling with search depth |
| Your turn | Your row | `Your move`, and your row takes the lit surface |
| Premove queued | Your row | `2 premoves queued` in `--premove` |
| Browsing history | System line | `Viewing move 12. Press ↓ to return to the game.` in `--warning` |
| Engine failure | System line | The error's own message in `--error` |
| Game over | Below the transcript | Result banner: `--font-display`, uppercase, letter-spaced, with the reason beneath |

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

- Visible focus ring on every interactive element: 2px `--accent-bright`. `clip-path` crops an outline, so anything wearing the stepped-corner notch draws its focus ring as a 2px **inset** box-shadow instead. Never `outline: none` without a replacement. A panel must not ring itself because something inside it is focused — on a full-height rail that draws a box around the whole column and drowns out the control the user is actually on.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders.
- `prefers-reduced-motion` respected throughout, including DOM transitions.
- ARIA live region announcing every move, check, and result.
- Full keyboard operability with no pointer.
- Touch targets ≥ 44px.
- No state conveyed by colour alone.
