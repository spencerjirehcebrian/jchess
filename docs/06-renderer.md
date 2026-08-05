# 06 — Renderer

## Contract

```typescript
class Renderer {
  constructor(canvas: HTMLCanvasElement, theme: Theme)

  mount(): void
  dispose(): void

  /** Subscribe to the store. Diffs state and drives the scene. */
  attach(store: Store): () => void

  /** Emitted upward for the input layer. */
  onSquarePointerDown: (square: Square, event: PointerEvent) => void
  onSquarePointerUp:   (square: Square, event: PointerEvent) => void
  onSquareHover:       (square: Square | null) => void

  cancelAllAnimations(): void
  setTheme(theme: Theme): void
  flip(animated: boolean): Promise<void>
}
```

The renderer **reads** state and **emits** pointer intent. It never writes to the store, never calls the engine, and never computes legality.

## Camera

**Orthographic. Fixed. This is the decision that makes voxel chess legible.**

```typescript
const CAMERA = {
  tilt: 57,            // degrees from horizontal
  yaw: 0,              // degrees; flip animates this to 180
  frustumPadding: 1.15 // multiplier on board extent
}
```

Orthographic projection means no foreshortening: a rook on rank 1 and a rook on rank 8 render at identical size. That eliminates the size ambiguity that makes perspective 3D hard to read. The 57-degree tilt gives height, shadow, and material presence while keeping occlusion to roughly the bottom third of the piece diagonally behind — read as depth, not obstruction.

**The camera does not orbit.** Board flip is a 180-degree yaw animation, nothing more. Free orbit reintroduces every legibility problem the fixed camera solves; do not add it, even as an option.

### Frustum sizing

Recompute on resize. Fit the board's bounding box to the canvas with `frustumPadding`, preserving aspect:

```
boardExtent = 8 squares + frame
aspect = canvas.width / canvas.height
if aspect >= 1: halfHeight = extent * padding / 2; halfWidth = halfHeight * aspect
else:           halfWidth  = extent * padding / 2; halfHeight = halfWidth / aspect
```

Set `camera.near = -100`, `camera.far = 100` (orthographic tolerates generous bounds) and position the camera far enough back that nothing clips.

## Lighting

Deliberately minimal. The voxel geometry already carries baked directional shading (`05-voxel-assets.md`), so the light's job is shadow, not form.

| Light | Config |
|---|---|
| Directional | Intensity 0.55, positioned to cast shadows down-left at roughly 40 degrees. `castShadow: true`. |
| Ambient | Intensity 0.65. Slightly cool tint (`#B8C4D0`). |

**No PBR, no environment maps, no tone mapping beyond linear.** `MeshLambertMaterial` throughout. Attempting physically-based rendering on flat-shaded voxels produces mush.

### Shadows

- `PCFSoftShadowMap`, map size 1024. Larger buys nothing at this scale.
- Tighten the directional light's shadow camera frustum to exactly the board extent. A loose frustum is the usual cause of blocky, low-resolution shadows.
- Only pieces cast. The board receives. The frame does neither.

The contact shadow under a piece is the primary grounding cue and the main thing carrying perceived quality. When a piece lifts during drag or a move arc, the shadow scales up and softens — implement this by scaling a separate soft shadow quad under the piece, not by moving the shadow-mapped geometry alone, which produces a shadow that is too sharp when lifted.

## Scene graph

```
scene
├── boardMesh              static, receives shadow
├── frameMesh              static
├── piecesGroup
│   └── 32 × Mesh          one per piece, individually positioned
├── shadowQuadsGroup
│   └── 32 × Mesh          soft contact shadow, additive-darken
├── overlayGroup           flat quads on the board plane, y = 0.02
│   ├── lastMoveFrom
│   ├── lastMoveTo
│   ├── selectedSquare
│   ├── legalMoveDots      pooled, up to 28
│   ├── checkPulse
│   └── premoveMarks       pooled, up to maxPremoves × 2
└── lights
```

**Use individual meshes, not `InstancedMesh`.** Instancing would be correct for hundreds of objects; with 32 pieces that animate independently, need per-object shadow quads, and change geometry on promotion, `InstancedMesh` costs more complexity than it saves. Twelve shared geometries plus twelve shared materials means the draw call count is already low.

Expected draw calls per frame: under 15.

## Piece identity and diffing

The renderer maintains a map from a stable piece identity to a mesh, so pieces **interpolate rather than remount** when the position changes.

```typescript
type PieceId = string     // stable across the whole game

interface RenderedPiece {
  id: PieceId
  role: Role
  color: Color
  mesh: THREE.Mesh
  shadowQuad: THREE.Mesh
  square: Square          // logical square (state)
  visualPosition: Vector3 // may lag during animation
}
```

Assign identities at game start (`w-pawn-e2`, `b-knight-g8`, and so on) and **carry them through moves**. A piece that moves keeps its id. A captured piece's id is retired. A promoted pawn keeps its id and swaps geometry.

Diffing on each state change:

```
for each piece in new position:
  known id?  → target square changed? start move animation
  unknown id → new piece (promotion); fade in
for each known id absent from new position:
  → capture; play capture exit, then retire
```

Without stable identities, every state change looks like all 32 pieces teleporting, and no amount of animation code will fix it.

## Render loop

**Render on demand.** The board is static most of the time and the engine worker is saturating a core during its turn. A continuous `requestAnimationFrame` loop is real battery cost for zero benefit.

```typescript
let dirty = true
let rafHandle: number | null = null

function requestRender() {
  dirty = true
  if (rafHandle === null) rafHandle = requestAnimationFrame(frame)
}

function frame(t: number) {
  rafHandle = null
  const stillAnimating = animator.tick(t)
  if (dirty || stillAnimating) {
    renderer.render(scene, camera)
    dirty = false
  }
  if (stillAnimating) rafHandle = requestAnimationFrame(frame)
}
```

Call `requestRender()` on: state change, hover change, animation start, resize, theme change, context restore.

Idle CPU must be effectively zero. Verify with a profiler as an acceptance criterion.

## Picking

**Raycast against a single invisible plane at Y = 0, then convert the hit point to a square index.**

```typescript
function pointerToSquare(event: PointerEvent): Square | null {
  const ndc = toNormalizedDeviceCoords(event, canvas)
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.ray.intersectPlane(BOARD_PLANE, target)
  if (!hit) return null
  return worldToSquare(target, boardFlipped)
}
```

**Do not raycast against piece meshes.** Two reasons: it is slower, and it makes empty squares unpickable, which breaks click-to-move entirely.

### Tilt compensation

On a 57-degree tilted board, squares at the far edge occupy fewer screen pixels than squares at the near edge. Expand the effective hit region toward the far edge:

```
compensation = 1 + (rankFromViewer / 7) * 0.12
```

Apply as a bias when the hit point falls near a square boundary. Without this, taps on the back rank feel unreliable on touch devices, which is exactly where reliability matters most.

### Hover

Throttle `pointermove` to animation frames. Emit `onSquareHover` only when the square actually changes. Suppress hover entirely on touch input (`event.pointerType === 'touch'`).

## Overlay layer

All highlights live **in the 3D scene** as flat quads on the board plane at Y = 0.02, not as DOM elements. They then inherit the projection for free and stay correctly aligned during the flip animation.

| Overlay | Appearance | Z-order |
|---|---|---|
| Last move (from) | Square fill, 18% accent | lowest |
| Last move (to) | Square fill, 28% accent | |
| Selected square | Square outline, 2 voxels thick, accent | |
| Legal move (empty) | Centred dot, 0.22 × square, 55% accent | |
| Legal move (capture) | Ring, inner 0.35 outer 0.48, 65% accent | |
| Premove | Square fill 25% + ordinal glyph, distinct hue | |
| Check | Radial gradient from king square, warning hue | highest |

**Three highlight types visible at once is the ceiling.** Past that they stop communicating. When premoves are active, suppress the legal-move dots.

Pool the quads. Allocate the maximum count once at boot, toggle `visible`, and never create geometry during play.

## Board flip

500ms, ease-in-out, animating camera yaw 0 → 180.

- Coordinate labels stay upright. The camera turns; the glyphs must not. All four frame bands carry labels, so re-stamp the board mesh for the new orientation — near edge `h..a`, ranks counting down — rather than rotating the mesh or the glyph geometry, either of which prints every label upside down. Gate the re-mesh on the orientation actually changing; the store pushes state on every move.
- The knight geometry is colour-facing, not camera-facing; it does not change on flip.
- Input is disabled for the duration.
- Under `prefers-reduced-motion`, snap instantly.

## Resize

Observe the canvas with `ResizeObserver`, not `window.onresize`. Debounce at 100ms. Recompute the frustum, update `renderer.setSize`, cap `setPixelRatio` at 2 (above that costs fill rate for no perceptible gain), and `requestRender()`.

## Context loss

```typescript
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  animator.cancelAll()
})
canvas.addEventListener('webglcontextrestored', () => {
  rebuildScene()
  requestRender()
})
```

Game state is untouched by context loss, so the position survives. Rebuild geometry from the voxel definitions — they are code, so there is nothing to re-fetch.

## Performance acceptance criteria

| Metric | Target |
|---|---|
| Draw calls per frame | < 15 |
| Triangles in scene | < 60,000 |
| Idle CPU | ~0% (no frames scheduled) |
| Frame time during animation | < 8ms on mid-range laptop |
| Scene boot (geometry generation + first render) | < 80ms |
| Pointer down to visual response | < 16ms |
