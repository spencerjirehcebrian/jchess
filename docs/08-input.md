# 08 — Input

Three input paths, all producing the same output: a candidate `Move` handed to the controller. They must be fully interchangeable — a user can select with the mouse and commit with the keyboard, or the reverse.

## Pointer input

Both click-to-move and drag-to-move must work on every input type. This is not a preference toggle; users switch between them mid-game without noticing.

### State machine

```
idle
 ├─ pointerdown on own piece      → selected(square), armed for drag
 ├─ pointerdown on empty/enemy    → idle (no-op)
 │
selected(from)
 ├─ pointermove > 4px             → dragging(from)
 ├─ pointerup on same square      → selected(from)      [click-to-move mode]
 ├─ pointerdown on legal target   → emit Move, idle
 ├─ pointerdown on own piece      → selected(newSquare)
 ├─ pointerdown elsewhere         → idle
 ├─ Escape                        → idle
 │
dragging(from)
 ├─ pointermove                   → piece follows cursor at lift height
 ├─ pointerup on legal target     → emit Move, idle
 ├─ pointerup elsewhere           → animate return to origin, idle
 └─ pointercancel                 → animate return to origin, idle
```

Key details:

- **4px threshold** before a press becomes a drag. Lower and every click becomes a jittery micro-drag; higher and drags feel unresponsive.
- **Use Pointer Events with `setPointerCapture`.** Mouse and touch handled by one path.
- **The dragged piece follows the cursor projected onto the board plane**, lifted to `0.6 * squareSize` with an enlarged, softened shadow. It does not snap to square centres during the drag; it snaps on release.
- **Highlight the square under the cursor** during drag, but only if it is a legal target.
- **`touch-action: none`** on the canvas or mobile drags will scroll the page.
- **Right-click clears premoves** and is otherwise suppressed on the canvas (`contextmenu` prevented).

### Promotion

On a pawn move reaching the last rank, do not emit immediately. Show an inline picker: four voxel pieces rendered in the scene, stacked vertically above the destination square, at 0.7 scale.

- Click or tap one to commit.
- `Q`, `R`, `B`, `N` keys select directly.
- `Escape` or a click elsewhere cancels the whole move.
- Default focus on queen; `Enter` commits queen.

Rendering the picker in the scene rather than as a DOM modal keeps the interaction on the board where the user's attention already is.

## Keyboard: standard algebraic notation

A full game must be playable without a pointer. The mechanism is a persistent, auto-focused text field that parses SAN incrementally.

### Accepted input

| Input | Meaning |
|---|---|
| `e4`, `Nf3`, `Bxc6`, `Qh4` | Standard SAN |
| `nf3`, `qh4` | Lowercase piece letters |
| `e2e4`, `g1f3` | UCI / long algebraic |
| `O-O`, `0-0`, `oo` | Kingside castle |
| `O-O-O`, `0-0-0`, `ooo` | Queenside castle |
| `e8=Q`, `e8Q`, `e8q` | Promotion |
| `Nbd2`, `R1e2`, `Qh4e1` | Explicit disambiguation |

`+` and `#` suffixes are accepted and ignored — they are derived, not input. Whitespace is stripped. `x` is optional (`ed5` matches `exd5` if unambiguous).

### The lowercase `b` problem

`b` is the only genuine ambiguity: it is both a file and a bishop.

Resolution: parse the buffer both ways against the legal move list.
- Exactly one interpretation yields matches → use it.
- Both yield matches → show both candidate sets highlighted in different tints and require the user to disambiguate by typing further. If the buffer becomes complete and both still match, require the uppercase form and show a one-line hint.
- Neither → no match, standard rejection feedback.

### Incremental candidate filtering

The field is not a blind text box. On every keystroke, filter the legal move list by the current buffer as a prefix and reflect the result on the board.

```typescript
interface NotationState {
  buffer: string
  candidates: Move[]          // legal moves whose SAN starts with buffer (lenient)
  ambiguous: boolean
  exactMatch: Move | null
}

function matchPrefix(buffer: string, legal: Move[], pos: Position): NotationState
```

Board feedback by candidate count:

| Candidates | Board shows |
|---|---|
| 0 | Nothing. Field shows rejection state. |
| 2+ | Origin squares of all candidates glow; destination dots on all candidate targets. |
| 1, incomplete | Origin highlighted solid; destination dot emphasised. |
| 1, exact | Origin and destination highlighted solid. Field shows ready-to-commit state. |

This turns the text field into a live query over the legal move list. The user learns notation by using it, and typos are visible before commit rather than after.

**Reuse the same overlay pool as pointer input.** Notation candidates and legal-move dots are the same visual vocabulary; they must not be two systems.

### Commit and correction

| Key | Action |
|---|---|
| `Enter` | Commit `exactMatch`. If none, reject. |
| `Backspace` | Remove one char, re-widen candidates |
| `Escape` | Clear buffer and highlights (first press); clear premoves (second press) |
| Any other printable | Append to buffer |

**Auto-commit on unambiguous exact match** is available as a setting, default **off**. It is faster but surprising the first time, since `e4` fires before you can type `e4` as a prefix of a disambiguated move.

**On illegal or unmatched input:** shake the field 220ms, apply the error style, and **leave the text intact**. Never silently clear — the user needs to see what they typed to understand what went wrong.

### Focus management

The field is focused by default and refocused whenever focus would otherwise land on the body. It must not steal focus from other controls (difficulty picker, dialogs). Global shortcuts fire only when the field is empty, so typing `f` in a partially-entered move does not flip the board.

## Global keyboard shortcuts

Active when the notation field is empty or unfocused.

| Key | Action | |
|---|---|---|
| `←` / `→` | Browse history back / forward | bound |
| `↑` / `↓` | Jump to game start / live position | bound |
| `Escape` | Clear selection, then clear premoves | bound |
| `Q` `R` `B` `N` | Promotion choice (only while the picker is open) | bound |
| `f` | Flip board | not yet |
| `Ctrl/Cmd + Z` | Takeback | not yet |
| `?` | Show shortcut reference | not yet |

"Empty or unfocused" is doing real work in the rule above: the notation field
takes focus on mount and holds it for most of a game, so refusing every arrow
aimed at a text input would mean refusing them nearly always. Arrows move the
caret while there is something to move it through, and browse the game when the
buffer is empty. A modal — settings, promotion, the result plate — owns the
keyboard outright while it is open; they are all detected by `role="dialog"`.
The result plate is one deliberately: browsing the transcript behind something
covering the board is not useful, and dismissing it unmounts the plate, so
browsing works from the moment there is anything to look at.

In setup the notation field is live only for white, whose typed first move
starts the game the way a dragged one does. For a side that does not move first
— black, or a random draw not yet made — the field is disabled rather than left
offering moves that would be refused.

Do not bind single letters that collide with SAN piece letters when the field could plausibly be receiving input. `f` is safe because a bare `f` is a file letter that requires a following digit; `n` and `b` are not safe and are therefore not bound.

## Premoves

See `04-game-core.md` for the legality model and the drain algorithm. This section covers only the input and presentation surface.

### Entry

Premoves are entered exactly like normal moves — same pointer state machine, same notation field. The only difference is validation target: `premoveDestinations()` instead of `legalMoves()`.

When `status.kind === 'engine-thinking'` or `'engine-delaying'`:
- Legal-move dots are replaced by premove destination dots in a distinct hue.
- Selecting a piece shows its relaxed destination set.
- Committing adds to the queue rather than applying.

### Presentation

| Element | Appearance |
|---|---|
| Premoved piece | Rendered at destination, 45% opacity, slow breathe |
| Origin square | Outlined, premove hue |
| Destination square | Filled 25%, premove hue |
| Queue ordinal | Small numeral on the destination square when queue length > 1 |
| Captured-by-premove piece | Unchanged (the capture has not happened) |

The premove hue must be visually distinct from both the accent (legal moves, selection) and the last-move highlight. Three simultaneous highlight vocabularies is the maximum before the board stops communicating; when premoves are active, suppress the last-move highlight.

### Queue limits

- `RuntimeConfig.maxPremoves`, default 3, settable to 1.
- Entering a premove when the queue is full **replaces the tail**, it does not reject. Users correcting the end of a chain expect replacement.
- Each subsequent premove validates against the hypothetical position: your own premoves applied, opponent pieces left where they are.

### Cancellation

Clear the **entire** queue on: right-click, `Escape`, clicking any square, starting a drag, takeback, new game, difficulty change, entering history browsing, or a premove failing validation during drain.

On cancellation caused by drain failure, flash the destination squares in the error hue for 300ms so the user sees why their planned moves did not happen. Silent cancellation is confusing.

## Accessibility

- All controls reachable by `Tab` with a visible focus ring.
- The board exposes an ARIA live region announcing each move in SAN plus check and mate state.
- The move list is a real `<ol>`, navigable and readable by screen readers.
- The notation field is the accessible path to playing; it should be labelled as such, not as a power-user shortcut.
- Never convey state by colour alone. Check has a shake and an announcement, not just a red glow. Premoves have opacity and an ordinal, not just a hue.
