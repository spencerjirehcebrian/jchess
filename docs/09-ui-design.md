# 09 — UI Design

## Direction

**The whole screen is one object: a tabletop chess computer.** Not a page with a
board on it. A moulded machine — the Mephisto / Novag / Fidelity lineage of the
early eighties — standing in the dark room the renderer already draws, with the
board set into a window cut through its deck, a dot-matrix display beside it,
and a keypad below.

This replaces an earlier direction in which the board was a physical object and
the chrome around it was quiet instrumentation. That thesis was sound and the
chrome executed it carefully, but it produced a web dashboard next to a game: a
full-bleed sidebar, a site header, hairline dividers, a grid of letterspaced sans
buttons. The board was already a game; the chrome was what gave it away.

**One material system, two renderers.** The mesher bakes a fixed multiplier into
each cube face — top 1.00, X sides 0.82, Z sides 0.72, bottom 0.55 — and the DOM
reuses those numbers, so a keycap and a pawn are lit by one imaginary sun.

You are looking *down* at a control deck, so the surface you see is a `+Y` face:
the deck is the material at **1.00**, not a shaded fraction of it.

**The housing is dark, and the same value family as the room it stands in.** The
board renders a dark room, and a cream machine beside it read as two different
products sharing a screen. It is each theme's `black.base` — the urushi the black
pieces are cut from — a step lighter than the room, so the machine still has an
edge rather than being the page merely going dark.

**Depth reads upward, and this is the load-bearing fact of the whole palette.**
Every multiplier in the material system goes *down*: 0.82, 0.72, 0.55, and the
0.30 the keyplate gap uses. On a pale deck that is free contrast — the gap around
a keycap fell to near-black and carried the 3:1 boundary between a control and
its panel at **6.7:1** all by itself. A dark deck has no headroom below it: the
same 0.30 lands **1.28:1** from the face, and the keys dissolve into the panel.

So the lit edge does that job instead. `bevel` is a solved token, not a
multiplied one, because a multiplier cannot go the way this needs to go: it is
the deck tinted toward that theme's sheen until it clears 3.05:1. It lands at a
tint of 0.37–0.49 across all four themes, which is how you can tell the model
fits rather than having been fitted.

The seam, the recess and the well all survive — a slot still reads as a slot —
but none of them owes a ratio any more. Anything that has to be *identified* is
identified by its lit edge.

Corners step rather than curve, matching the two-voxel taper on every piece base.
Radius is zero. There are no blurred shadows anywhere, and the one translucent
surface in the app is the modal scrim, which earns it: occlusion across a whole
scene is a wash, while edges and shadows are hard because the material is.

**Keys and deck are the same colour, and that is deliberate.** A single moulding
is one shot of plastic — and on a dark deck it also protects contrast, because
lifting keycaps clear of the deck would drop gold-on-keycap to 3.4:1, under the
floor for text. A key is a key because of its lit edge.

**Two colour families now, where there were three.** They are read against two
different surfaces, so a value that works on one is wrong on the other:

| family | read against | example |
|---|---|---|
| Housing inks | dark moulded plastic | `--text`, `--accent` |
| Display levels | near-black glass | `--lcd-on`, `--lcd-dim` |

`accent` and `boardAccent` were split apart when the chrome went pale, because
gold is **1.1:1** on cream and could not be type there. They are reunited now
that the machine is dark: the highlight on the board and the accent in the rail
are one colour, which is what the split was always costing. `boardAccent*` remain
separate fields only because `OverlayManager` reads them by name.

The DOM accent is `boardAccentBright`, not `boardAccent` — the mid board value
fails the 4.5:1 text floor in two themes (Oxide 3.84, Forest 4.30). The mid value
becomes `--accent-dim`, which is decorative and owes 3:1. **Knockout inverts**:
dark text on a bright accent keycap, and the dark it uses is the deck itself.

`applyThemeToCss()` derives both families from the active theme, so the machine
re-lights itself when the board does. `tests/unit/ui.test.ts` asserts every ink
clears 4.5:1 on its own housing, the lit edge clears 3:1 and is genuinely
lighter than the deck, every display level clears 4.5:1 against its own unlit
cells, and every board signal clears 3:1 against the room — for all four themes.

Those assertions are why the polarity has now been flipped twice without
breaking. They assert **ratios, not polarity**, so they survive a flip intact and
fail loudly on whatever it broke — which is exactly what happened both times.

**Contrast is a property of a pairing, not of a colour.** An ink is only solved
against a specific surface, so a surface that moves invalidates it. Lightening
the active player row cost the two faintest lines in that row their floor
(measured 3.5:1) even though both inks were solved and passing against the deck.
Re-solving them against the lit row would have worked and been worse: it pushes
`textFaint` within a hair of `textDim` and collapses a three-step ink ramp into
two. The cue moved to a lit edge instead, which costs nothing and is how the rest
of the machine says "lit" anyway.

**The UI's icons are the assets.** `voxelSpriteUrl()` reads the same voxel grids
the renderer meshes and draws each shape's front elevation as a pixel sprite. The
captured pieces, the promotion picker and the keycap legends all use it; drawing
a second set of illustrations would mean maintaining two versions of the same
shapes, and they would drift.

Piece sprites carry a one-voxel contrasting halo, because the same sprite has to
read on a keycap, on the open deck and over the board, and no single background
serves both sets — so the fix belongs to the sprite rather than to whatever is
behind it. That is what lets the captured pieces lie **directly on the deck with
no tray around them**: the box was never what made them legible, and drawn as a
recess it was two grey slots sitting in the rail doing nothing for most of a
game. The reserved height stays, so the rack cannot collapse before the first
capture and then grow a row at a time, shifting the column below it.

**The signature element is the display.** A dot-matrix LCD whose *undriven* cells
stay permanently visible: the cell grid is painted whether or not anything is lit,
so the module reads as a physical component that exists when it is off rather than
as a dark rectangle that happens to contain text. This one detail does more for
"machine" than everything else combined.

The machine has **one** screen. The transcript and the notation field are two
windows onto it — the part the app writes into, and the part you type into. An
earlier draft named the notation field as the signature; two signatures is one too
many, and one display is more object-like than two unrelated wells.

The cell pitch **must** equal the glyph pixel of the type inside the window, which
for Departure Mono is `font-size / 11`: pitch 2 with `--data`, pitch 3 with
`--data-lg`. Any other pairing puts glyph pixels out of phase with cells and the
illusion collapses. This is why the transcript is set at 22px and not 11px — at a
1px pitch the matrix is invisible, and the whole effect goes with it.

## Tokens

`src/styles/tokens.css`. Every value in the app derives from these; no literal colours or sizes at usage sites.

See `src/styles/tokens.css`. Colour defaults are the Lacquer theme and every
one of them is overwritten at runtime by `applyThemeToCss()`; the literals exist
so the first paint matches the scene instead of flashing a grey shell.

```css
:root {
  /* The room the machine stands in. The housing sits a step above it. */
  --bg:            #090605;

  /* Housing — moulded urushi ABS, the stock the black pieces are cut from */
  --surface-raised:#2E231C;   /* the material itself; everything derives from it */
  --border:        #54493E;
  --border-strong: #7A6F61;

  /* Inks silkscreened onto it. Light, because the housing is dark. */
  --text:          #E7DAC3;   /* 11.1:1 */
  --text-dim:      #B0A491;   /*  6.2:1 */
  --text-faint:    #998D7C;   /*  4.7:1 */

  /* The signal ink — gold, the same colour the board highlights a move with. */
  --accent:        #E8C558;   /*  9.1:1 */
  --accent-bright: #F2DFA3;   /* 11.6:1 — focus ring, pressed states */
  --accent-dim:    #C9A227;   /*  6.3:1 — a decorative rule, not a boundary */

  /* Extrusion, from the mesher's face shading. The deck is a +Y face.
     Depth reads *upward*: --voxel-top is the only value below that carries a
     ratio, because below a dark deck there is nowhere left to go. */
  --voxel-face:   ...;  /* material x 1.00 — the deck, seen face-on */
  --voxel-top:    ...;  /* the lit bevel — solved to 3.1:1, the control boundary */
  --voxel-side:   ...;  /* material x 0.82 — the right edge */
  --voxel-under:  ...;  /* material x 0.55 — the shadowed bottom edge */
  --voxel-hover:  ...;  /* the deck, tinted toward the lit edge */
  --voxel-recess: ...;  /* material x 0.62 — a slot moulded in the deck */
  --voxel-seam:   ...;  /* material x 0.30 — decorative; 1.3:1 from the deck */

  /* The display, as one emitter at several strengths */
  --lcd-on:    ...;  /* a lit pixel */
  --lcd-dim:   ...;  /* lcdOn x 0.78 — secondary data */
  --lcd-off:   ...;  /* lcdOn x 0.18 — an undriven cell, and it stays visible */
  --lcd-field: ...;  /* lcdOn x 0.055 — the gutter between cells */
  --lcd-alert: ...;  /* the display's one other hue */

  /* Type — two pixel faces on two different pixel grids */
  --font-legend: 'Silkscreen', monospace;
  --font-data:   'Departure Mono', ui-monospace, monospace;

  --vx: 4px;               /* one UI voxel; every gap is a whole number of them */
  --radius: 0;             /* voxels do not have corners */
}
```

**Typography roles:**

Two faces, both drawn on a pixel grid — the same grammar as the pieces. Archivo,
a variable sans, used to do all the naming while the pixel face was quarantined
to the readouts; it was the loudest reason the chrome read as a web page wrapped
around a game, and it cost 90KB of the old 112KB font payload.

- `--font-legend` — **Silkscreen.** It *names* things: the wordmark, the model
  badge, the players, every button, select and eyebrow. Always uppercase, because
  that is how a moulded panel is printed.
- `--font-data` — **Departure Mono.** It *states* them: the display, the moves,
  the clocks, the notation, the coordinates, and every full sentence. Sentences
  go here rather than in Silkscreen, whose lowercase is a 3px x-height.

**Neither face survives being taken off its own grid, and they are different
grids.** Silkscreen is exact only at multiples of **8**, Departure Mono only at
multiples of **11**, where its `7/11 em` advance lands on whole pixels. The scale
has five sizes because those are the ones that exist. A 13px Departure Mono —
which is what this app used to set the move list, clocks and every control in —
advances 8.2727px per glyph and is resampled into mush.

**Every size is paired with a line-height, and the pairing is not taste.** A line
box puts half its leftover space above the text, offsetting the glyphs by
`(line-height − (ascent + descent)) / 2`. Land that on a half pixel and every
glyph in the element is resampled — which blurs far more type than tracking or
size ever will. Measured: Departure Mono's content height is `size × 14/11`
(14/28/42, all even); Silkscreen's is 10/20 at 8/16 but **31/41 at 24/32, odd**.
So Departure Mono and small Silkscreen take even line-heights and large
Silkscreen takes odd ones. Use the `--lh-*` pairs; do not mix and match.

Four things put type on a fractional pixel, in descending order of damage:
unset `line-height` (resolves to a fractional `normal`), container/line-box parity
mismatches, `em` letter-spacing (`0.08em` at 16px is 1.28px — all tracking is in
whole pixels, and Departure Mono carries none at all so the `${n}ch` caret
arithmetic stays exact), and fractional element origins from `1fr` columns, which
is why the rail is pinned to even bounds.

`-webkit-font-smoothing: none` and `font-synthesis: none` are both set globally.
The first switches anti-aliasing off outright — a bitmap face is already at final
resolution, so AA is just a blur. The second matters because Departure Mono ships
one weight: asking for bold got a *synthesised* one, the browser smearing a 1px
stem sideways, on the current ply, the single element the eye tracks most.

Both are self-hosted latin-subset woff2 in `public/fonts` (30KB total, down from
112KB), declared `font-display: block` and preloaded — `swap` on a layout built
from whole-pixel metrics flashes the wrong advance and reflows the whole deck.
Cross-origin isolation blocks third-party font CDNs, so Google Fonts is not an
option — this is not a preference, it is a hard constraint of the COEP header.
Licences ship alongside, in `public/licenses/`.

**A glyph being in the font is not the same as the font being loaded.**
`document.fonts.check()` answers the second question and will happily return true
while the browser silently falls back for a character the subset does not contain.
`▸`, `✕`, `−`, `♕`, `▰` and `▱` all fall back. The chevron cost the notation field
its whole-pixel origin — 13.245px against a 14px advance — so every character the
user typed was resampled, in the one field the design is built around. Prefer
glyphs the faces actually carry; where one is wanted anyway, pin it to `1ch`.

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

**The two players sit together above the keys.** Stockfish above, you below,
under the transcript and over the key plate, each carrying their own name, the
material they have taken, their advantage, and a clock slot. Both rows read the
same way down — name, detail line, material — because a pair meant to be
compared should not print the same three lines in two different orders.

**They exist only once a game does.** In setup the rail is the nameplate, the
choices, and the Start key. With no game to report, the rows had nothing to say
that the setup panel was not already asking.

**Status belongs to the player it describes.** "Thinking" and the depth
indicator are things Stockfish is doing; "your move" is addressed to exactly one
of the two names on screen. There is no separate status bar. The side to move
carries the lit surface, and the status text beside it says the same thing in
words, so turn state is never colour alone.

The one message belonging to neither player — history browsing, engine failure —
gets a single line between the transcript and the players that collapses to
nothing when silent.

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
│  ▸  Nf3                                          │   --data, on the LCD
├──────────────────────────────────────────────────┤
│     Nf3   Nf6   Nc3   Nd2                        │   --data-xs, --lcd-dim
└──────────────────────────────────────────────────┘
```

- The field is the **input line of the display**, not a well of its own: the
  same recess lighting, the same permanently visible cell grid, the same lit
  levels. It is the part of the screen you type into.
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
| Engine thinking | Stockfish row | `Thinking` plus a four-cell depth indicator and the depth itself (`d12`) |
| In check | The row that has to answer it | A lit `CHECK` legend plate — `--knockout` on `--accent` |
| Your turn | Your row | `Your move`, and your row takes the lit surface |
| Premove queued | Your row | `2 premoves queued` in `--premove` |
| Browsing history | System line | `Viewing move 12. Press ↓ to return to the game.` in `--warning` |
| Engine failure | System line | The error's own message in `--error` |
| Game over | Below the transcript | Result banner: `--font-legend`, uppercase, letter-spaced, with the reason beneath |
| Game over | Above the transcript | The evaluation strip, and a fourth column of scores inside the transcript |

The depth indicator and the check legend both subscribe at the leaf rather than
taking a prop, because their parent rows read the whole game store — a prop
would drag the name, the clock and the trophy rack through every reading.

Nothing animates to report a state. A lamp that blinks is demanding attention;
these only report, and the word beside each one always says the same thing.

## The instruments

**Depth.** Four cells and a number, fed from the telemetry store (see
`03-engine.md`). Quantised in the selector so a 10Hz feed repaints two spans
about four times a search.

**Evaluation.** Recorded during play, shown only once the game is over. Being
told you are losing before you can see why is discouraging rather than
instructive against a level-two opponent, and it is the closest thing to an
assist this app would ship.

The strip is a fixed 178px — fifteen 10px cells with 2px between them — rather
than a fraction of the rail. The rail is a 340–380px range, and a proportional
block lands every cell edge on a fraction, which softens the one element in the
app made entirely of edges. The transcript's score column is 56px for the same
family of reason: the rail's inner width is even, so taking two even columns out
of it leaves each `1fr` on a whole pixel.

Mate pins the gauge rather than being scaled as a quantity. One score per row is
a full column, not a half-empty one, because the engine plays one colour and so
at most one ply of a pair was ever searched.

## Keycap legends

Control icons are authored as voxel grids in `src/render/voxel/icons.ts`, in the
same format and the same four materials as the pieces, and rendered by the same
`voxelSpriteUrl`. One grid language, one renderer, one place the light comes
from. Grids are written top-down and reversed once on the way in, so nobody has
to author upside down.

- **8×8 at `pixel: 2` — 16px.** The size at which a pixel icon has been legible
  since icons existed, and even, so it centres on a whole pixel in a 40px key.
- **Housing inks, not piece colours** (`inkPalette`). A legend is printed on the
  same moulding the deck is, so it is read against the same plastic and has to
  come from the family that was solved against it.
- **Lit by tinting up, not by shading down** (`litTint`). Pieces keep the
  mesher's shading, because they are objects in a lit scene. A legend on a dark
  key cannot: shading the unlit face down was free contrast on cream and dropped
  the dimmer materials to **2.1:1** against their own key here. Tinting the *lit*
  face up instead makes the ink's own value the worst case rather than a fraction
  of it — the same inversion the housing itself went through.
- **No halo.** Pieces carry a contrasting outline because the same sprite has to
  work on a keycap, in a dark tray and over the board. An icon only ever sits on
  one surface, and a halo around an icon on its own key reads as a glow.
- **No hover state.** A screen-printed legend does not change colour when a
  finger approaches; the key underneath already lights. Disabled comes free from
  the button's own opacity.
- **Beside the word, never instead of it.** The machine being imitated had text
  on its keys, and the specs identify these buttons by their accessible names —
  which is exactly what an icon-only control throws away. `alt=""` keeps the
  picture out of the name.

Legibility beats the better story. The resign key was drawn as a toppled king
first; a king is only a king because of the cross on its crown, a cross needs
three voxels across, and on an eight-wide grid that leaves five for the body and
renders as a smudge. It is a flag.

Keys are laid out `minmax(0, 1fr)`, not `1fr`. A bare `1fr` is `minmax(auto,
1fr)`, so the longest legend in a column sets that column's width — which made
the keys two different sizes and reflowed the whole keypad under the pointer the
moment the resign key changed its word.

## Copy rules

- **Sentence case everywhere** except the `--font-legend` labels, which are
  uppercased **in CSS, never in the string**. Playwright applies `text-transform`
  when computing an accessible name and asserts `SETTINGS`; Testing Library does
  not and asserts `Settings`. Uppercasing in CSS is what keeps both true.
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
| Resign, armed | `Resign?` |
| Result, player-relative | `YOU WON` / `YOU LOST` / `DRAW`, then `by checkmate`, `on time` |

Resigning is irreversible, so it takes two presses. The label changes, which
means the accessible name changes with it — a player who cannot see the key
change is told in words that the next press is the one that counts. It does
**not** revert on a timer: a key that quietly disarms after three seconds is a
race against anyone reading slowly, or listening. It disarms when another key
is used or focus leaves the plate.

## The three states

The machine shows one of three faces, derived from `status.kind` by `phaseOf`
so nothing has to keep a second copy of which one is current.

| | Rail's middle band | The state key |
|---|---|---|
| **Setup** | Setup panel: level, time control, side — and no player rows | `Start game` |
| **Playing** | Transcript, with Take back and Hint on the plate | `Resign` |
| **Finished** | Assessment gauge above the transcript, both browsable | `New game` |

One key at the bottom of the plate carries the machine between them, full
width, in the same place under the hand whichever word it wears. Resign and New
game can no longer be pressed by mistake for each other, because they are never
on screen at once.

Choosing a side turns the board around on the spot — the preview is the
feedback. `Random` keeps the board white-side-down and the coin is flipped by
the Start key, not by the picker. Playing white, the board and the notation
field are live in setup and making a move *is* the start: it begins the game
and lands the move in one gesture, which is a clearer way of saying "begin"
than a button that only gets you to the same place.

The result covers the board, not the window, and carries no scrim: the rail
behind it is already the finished game's analysis, and dimming that to announce
the result would hide the thing being announced. `New game` returns to the
setup panel with every choice still on it rather than starting another game —
the choices are worth seeing before the next one begins.

The armed word is `Resign?` rather than `Confirm resign` because every key has
to fit the same column as `Flip board`, and the armed state must not be the one
label on the plate that cannot be shown.

## Accessibility floor

Non-negotiable, verified before any milestone is considered done:

- Visible focus ring on every interactive element: 2px `--accent-bright`. `clip-path` crops an outline, so anything wearing the stepped-corner notch draws its focus ring as a 2px **inset** box-shadow instead. Never `outline: none` without a replacement. A panel must not ring itself because something inside it is focused — on a full-height rail that draws a box around the whole column and drowns out the control the user is actually on.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders.
- `prefers-reduced-motion` respected throughout, including DOM transitions.
- ARIA live region announcing every move, check, and result.
- Full keyboard operability with no pointer.
- Touch targets ≥ 44px.
- No state conveyed by colour alone.
