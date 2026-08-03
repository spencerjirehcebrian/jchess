# 09 — UI Design

## Direction

The board is a physical object rendered in a dark room. Everything around it is instrumentation: quiet, precise, and technical. The DOM chrome must never compete with the scene for attention.

The reference point is a piece of measurement equipment rather than a chess website — monospaced numerics, tight rules, restrained colour, no gradients, no shadows on DOM elements, no rounded-corner card stacks. The one place colour and motion are spent is the board itself.

**The signature element is the notation field.** It sits directly beneath the board, always focused, showing live candidate matches as the user types. It is the thing that makes this app feel different from every other chess UI, so it gets the strongest typographic treatment and the most careful interaction polish.

## Tokens

`src/styles/tokens.css`. Every value in the app derives from these; no literal colours or sizes at usage sites.

```css
:root {
  /* Surface — matches the 3D background so the canvas has no visible seam */
  --bg:            #1A1D21;
  --surface:       #23272C;
  --surface-raised:#2C3138;
  --border:        #383E46;
  --border-strong: #4A525C;

  /* Text */
  --text:          #E4E7EA;
  --text-dim:      #9AA3AC;
  --text-faint:    #656D76;

  /* Accent — sage, pulled from the white pieces' detail colour */
  --accent:        #8FA89B;
  --accent-bright: #A8C4B4;
  --accent-dim:    #5E7268;

  /* Premove — brass, pulled from the black pieces' detail colour */
  --premove:       #B08D57;
  --premove-dim:   #7A6139;

  /* Status */
  --warning:       #C87F4A;
  --error:         #C25B54;
  --success:       #7A9E6B;

  /* Type */
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  --size-xs:  0.6875rem;   /* 11px — labels, eyebrows */
  --size-sm:  0.8125rem;   /* 13px — move list, secondary */
  --size-md:  0.9375rem;   /* 15px — body */
  --size-lg:  1.25rem;     /* 20px — notation field */
  --size-xl:  1.75rem;     /* 28px — clocks, result */

  /* Space — 4px base */
  --sp-1: 0.25rem;  --sp-2: 0.5rem;   --sp-3: 0.75rem;
  --sp-4: 1rem;     --sp-6: 1.5rem;   --sp-8: 2rem;

  --radius: 2px;           /* nearly square; the app is instrument-like */
  --dur-fast: 120ms;
  --dur-base: 180ms;
}
```

**Typography roles:**

- `--font-display` — Space Grotesk. Section labels and the result banner only. Used sparingly, uppercase, letter-spaced.
- `--font-body` — Inter. All prose, buttons, settings.
- `--font-mono` — JetBrains Mono. The notation field, move list, clocks, evaluation, coordinates. Anything a chess player reads as a symbol rather than a word.

Self-host all three as woff2 subsets. Cross-origin isolation blocks third-party font CDNs, so Google Fonts is not an option — this is not a preference, it is a hard constraint of the COEP header.

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

- Caret is a solid block, not a line. Blinks at 530ms.
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

- Visible focus ring on every interactive element: 2px `--accent-bright`, 2px offset. Never `outline: none` without a replacement.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders.
- `prefers-reduced-motion` respected throughout, including DOM transitions.
- ARIA live region announcing every move, check, and result.
- Full keyboard operability with no pointer.
- Touch targets ≥ 44px.
- No state conveyed by colour alone.
