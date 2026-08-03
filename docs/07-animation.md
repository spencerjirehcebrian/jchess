# 07 — Animation

## The rule everything depends on

**A new animation cancels the previous one by snapping it to completion. Never by queueing.**

During premove chains and fast play against a low-difficulty engine, moves can land 50ms apart. A queue produces lag that compounds until the board is showing a position several plies stale. Every animation must therefore hold a reference to its target transform, and cancellation writes that target directly.

```typescript
interface Animation {
  id: string
  target: PieceId | 'camera' | 'overlay'
  startTime: number
  duration: number
  /** Called with eased t in [0,1]. */
  apply(t: number): void
  /** Write the final state immediately. Must be idempotent. */
  complete(): void
}

class Animator {
  start(anim: Animation): void          // cancels any animation on the same target
  cancelAll(): void                     // completes every in-flight animation
  cancel(target: string): void
  tick(now: number): boolean            // returns true if any animation remains
  readonly active: number
}
```

`start()` on a target with an in-flight animation calls that animation's `complete()` first. It does not blend, does not queue, does not wait.

`cancelAll()` is called by the premove drain (`04-game-core.md`, step 7) and must leave the scene in exactly the state it would reach if every animation had run to its end.

**Invariant to test:** after `cancelAll()`, every rendered piece position equals the position derived from state. Assert this in a unit test with a scripted sequence of overlapping moves.

## Timing table

Implement these as named constants in `src/render/animation.ts`.

| Event | Duration | Easing | Notes |
|---|---|---|---|
| Move | 180ms | `easeOutCubic` | |
| Capture — arriving piece | 180ms | `easeOutCubic` | Same as a move |
| Capture — departing piece | 140ms | `easeInQuad` | Starts at +80ms, overlaps arrival |
| Castle — king | 180ms | `easeOutCubic` | |
| Castle — rook | 180ms | `easeOutCubic` | Starts at +40ms |
| Promotion | 320ms | `spring(0.6, 0.8)` | |
| Board flip | 500ms | `easeInOutCubic` | |
| Check pulse | 400ms | `easeOutQuad` | |
| King shake | 220ms | 3 oscillations | Decaying amplitude |
| Piece lift (drag start) | 90ms | `easeOutQuad` | |
| Piece drop (drag end) | 120ms | `easeOutCubic` | |
| Overlay fade | 120ms | `linear` | |
| Premove mark appear | 100ms | `easeOutQuad` | |

180ms for a move is deliberate. Slower feels sluggish the moment the user starts playing quickly, and the gap between "feels weighty" and "feels laggy" is roughly 220ms.

## Move arc

Pieces arc through Y during a move. In 3D this is nearly free and it is the main thing that makes pieces read as objects rather than sprites.

```
apexHeight = 0.35 * squareSize
y(t) = 4 * apexHeight * t * (1 - t)        // parabola, zero at both ends
```

Combine with horizontal `easeOutCubic` interpolation. The horizontal easing and vertical parabola use the same `t`.

**Knights arc higher** — `0.55 * squareSize` — reinforcing that they jump. This is a small detail that people notice without being able to say why.

While arcing, the contact shadow scales from 1.0 to 1.45 and its opacity drops from 0.5 to 0.22, following the same parabola. This is what sells the height.

## Choreography by event

### Simple move
Piece animates along the arc. Overlay `lastMove` quads fade to the new squares over 120ms, concurrent.

### Capture
1. t=0: arriving piece begins its arc.
2. t=80ms: captured piece begins its exit — scale 1.0 → 0.0 with `easeInQuad`, plus a 0.15-square nudge along the attack vector, plus opacity 1 → 0.
3. t=220ms: captured piece retired, mesh returned to pool.

The overlap matters. If the captured piece disappears before the attacker arrives, the board reads as two unrelated events instead of one.

### Castling
King moves normally. Rook starts 40ms later and arcs slightly lower (`0.25 * squareSize`). The stagger reads as the king leading and the rook following, which is what castling is.

### Promotion
1. Pawn continues its move arc to the last rank (180ms).
2. On arrival, pawn geometry scales 1.0 → 0.0 in Y over 140ms while the new piece scales 0.0 → 1.0 with a spring, offset by 60ms.
3. A brief 1.15× overshoot on the new piece, settling over the spring's tail.
4. Contact shadow scales to the new piece's footprint over the same window.

No particles. No modal. The piece morphs in place. This is the one moment in a game that deserves punctuation and it should be handled in the scene, not in the DOM.

### Check
Concurrent, starting when the checking move completes:
- Radial pulse quad expands from the king's square, 0 → 1.8 squares radius, opacity 0.45 → 0 over 400ms.
- King mesh shakes: 3 oscillations along X, amplitude 0.08 → 0 squares, 220ms.

### Checkmate
Check animation, then after 200ms the losing king tips over — rotate 90 degrees about the X axis over 500ms with a slight bounce on landing. Contact shadow stretches to match. The camera does not move.

### Game start
Pieces drop into place from 1.5 squares above, staggered by rank, 40ms between ranks, 400ms per piece with `easeOutBounce` at very low amplitude. Total roughly 700ms. This is the app's one orchestrated moment; keep everything else quiet.

## Ambient states

These run continuously while active and are the difference between a board that feels alive and one that feels like a diagram.

### Engine thinking

A slow pulse on the engine's side of the board frame. Period 2000ms, opacity oscillating 0.15 → 0.35.

Map intensity to reported search depth from `onProgress`: as depth increases, shorten the period toward 1200ms and raise peak opacity toward 0.5. The effect is that the board visibly intensifies on hard positions, which is both true and satisfying.

This is the state almost nobody designs, and it is dead air on every single move of every single game. It is worth the effort.

### Premove pending

Premoved pieces render at their destination at 45% opacity with the origin square marked. A slow 1500ms breathing on the opacity (45% → 55%) distinguishes "pending" from "faded out".

## Reduced motion

`prefers-reduced-motion: reduce` must:

- Set all durations to 0. Pieces teleport.
- Disable all ambient pulses.
- Disable the game-start drop.
- Replace the check pulse with a static highlight that clears after 800ms.
- Keep the board flip instant.

Everything must remain fully functional. Query the media list once and subscribe to changes; do not read it per animation.

## Frame budget

The animator's `tick()` must complete in under 2ms with 32 pieces animating simultaneously (the game-start case). This is trivially achievable with direct transform writes and no allocation.

**Allocate nothing in `tick()`.** Pre-allocate `Vector3` and `Quaternion` scratch objects at construction. Garbage collection during a move animation produces a visible hitch and is the most likely source of jank in this app.

## Audio pairing

Out of scope for v1 implementation but the animation events must emit hooks so audio can be added without touching the renderer:

```typescript
type AnimationEvent =
  | { kind: 'move-land'; role: Role }
  | { kind: 'capture-land'; role: Role; captured: Role }
  | { kind: 'castle-land' }
  | { kind: 'promote-land'; role: Role }
  | { kind: 'check' }
  | { kind: 'mate' }

renderer.onAnimationEvent: (e: AnimationEvent) => void
```

Emit on the frame where the piece lands, not when the animation starts. Well-tuned sound does more for perceived quality than any visual effect and costs almost nothing; leaving the hooks in place makes it a one-day addition later.
