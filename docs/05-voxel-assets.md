# 05 — Voxel Assets

## The core decision: pieces are code, not files

There are no `.vox` files, no glTF, no Blender step, and no artist dependency. Each piece is defined in TypeScript as a stack of ASCII layers and meshed at runtime.

This is the single most important choice in the visual layer. It means the implementing agent can author, inspect, and iterate on the models directly; the models diff cleanly in git; the entire asset payload is a few kilobytes of source; and there is no loader, no async, and no CORS surface.

## Grid format

A piece is an array of horizontal layers, ordered **bottom to top**. Each layer is an array of strings, one per row along Z. Each character is one voxel.

```typescript
type VoxelLayer = string[]
type VoxelGrid = VoxelLayer[]        // index 0 = bottom

interface PieceDefinition {
  role: Role
  grid: VoxelGrid
  /** Voxels of vertical height. Derived from grid.length, stated for clarity. */
  height: number
}
```

Characters:

| Char | Meaning |
|---|---|
| `.` | empty |
| `#` | base material (the piece's main colour) |
| `+` | accent material (highlight ramp, one step lighter) |
| `-` | shade material (one step darker) |
| `o` | detail material (used sparingly: crown jewels, eyes, cross) |

### Footprint and scale

- **Footprint: 11 × 11 voxels.** Odd, so pieces have a true centre and are symmetric about it.
- **Board square: 13 × 13 voxels** of world space. The 1-voxel margin on each side keeps adjacent pieces from touching.
- **Heights by role:**

| Role | Height (voxels) |
|---|---|
| Pawn | 14 |
| Knight | 18 |
| Bishop | 19 |
| Rook | 17 |
| Queen | 22 |
| King | 24 |

- **World scale: 1 voxel = 1/13 of a square.** Set square size to 1.0 world unit, so `VOXEL_SIZE = 1 / 13`.

### Authoring rules

1. **Every piece must be distinguishable by silhouette alone** from the fixed camera. Test by rendering flat black on white and checking that all six read at 64px tall.
2. **The knight is the hard one.** Build it first. If the knight does not read at this resolution, the entire footprint and height budget needs revisiting before any other piece is authored. Do not author all six and then discover this.
3. **Bases must be identical across all pieces** — same footprint, same bottom three layers. This makes pieces sit consistently and simplifies the contact shadow.
4. **Pieces are symmetric about the X axis** except the knight, which faces the opponent. The knight's facing flips with colour.
5. **No floating voxels.** Every voxel must be connected to the base through face-adjacency. Add a validation function that asserts this and run it in tests.

## Reference: pawn

Provided as a format example, not as final art. The agent should author all six and iterate.

```typescript
const PAWN: VoxelGrid = [
  // layer 0 — base
  [
    '...........',
    '...#####...',
    '..#######..',
    '.#########.',
    '.#########.',
    '.#########.',
    '.#########.',
    '.#########.',
    '..#######..',
    '...#####...',
    '...........',
  ],
  // layer 1 — base
  [
    '...........',
    '...#####...',
    '..#######..',
    '.#########.',
    '.#########.',
    '.#########.',
    '.#########.',
    '.#########.',
    '..#######..',
    '...#####...',
    '...........',
  ],
  // layer 2 — base taper
  [
    '...........',
    '....###....',
    '...#####...',
    '..#######..',
    '..#######..',
    '..#######..',
    '..#######..',
    '..#######..',
    '...#####...',
    '....###....',
    '...........',
  ],
  // layers 3-5 — stem
  // layer 6 — collar (wider, uses '+')
  // layers 7-10 — neck
  // layers 11-13 — head sphere
]
```

Author the remaining layers following the silhouette: wide base, taper, narrow stem, a collar ring at roughly 40% height, then a rounded head occupying the top four layers.

## Meshing

Convert `VoxelGrid` to a single `THREE.BufferGeometry` at boot.

### Algorithm: face-culled cubes

For each filled voxel, emit only the faces whose neighbour is empty or out of bounds.

```
for each (x, y, z) where grid[y][z][x] !== '.':
  for each of 6 directions:
    if neighbour is empty or out of bounds:
      emit quad (2 triangles, 4 vertices)
      vertex colour = palette[material char][direction shading]
```

**Do not implement greedy meshing in v1.** A piece at this resolution has roughly 300–800 surface voxels, producing 1,500–4,000 triangles after culling. Six unique geometries totalling under 25,000 triangles, instanced 32 times, is nothing for any GPU made in the last decade. Greedy meshing is a real optimisation but it is not needed here, and it complicates per-face shading. Revisit only if profiling shows a problem, which it will not.

### Per-face shading

Bake directional shading into vertex colours rather than relying on the light. This is what gives voxel art its characteristic crispness.

| Face direction | Multiplier |
|---|---|
| +Y (top) | 1.00 |
| +X, −X | 0.82 |
| +Z, −Z | 0.72 |
| −Y (bottom) | 0.55 |

Multiply the material colour by the face multiplier and write it to the vertex colour attribute. Use `MeshLambertMaterial` with `vertexColors: true`. The scene light then adds shadow on top of already-shaded geometry.

### Output

```typescript
interface MeshedPiece {
  geometry: THREE.BufferGeometry      // positions, normals, colors, indexed
  triangleCount: number
  boundingHeight: number              // world units, for animation arcs
}

function meshPiece(def: PieceDefinition, palette: Palette): MeshedPiece
```

Geometry is generated once per (role × colour) — twelve geometries total — and cached. Origin at the centre of the base footprint, sitting on Y = 0, so placing a piece is a plain translation to the square centre.

Budget: full generation of all twelve must complete in under 30ms on a mid-range laptop. Measure it and assert in a test.

## Palettes

Colour is data, not geometry. A theme change is a re-mesh of twelve geometries, which is cheap, or a vertex-colour buffer update, which is cheaper.

```typescript
interface Palette {
  base: string          // '#'
  accent: string        // '+'
  shade: string         // '-'
  detail: string        // 'o'
}

interface Theme {
  id: string
  label: string
  white: Palette
  black: Palette
  lightSquare: string
  darkSquare: string
  frame: string
  background: string
}
```

### Default theme: "Oxide"

Deliberately not a wood-and-ivory chess set. The voxel form is modern and the palette should agree with it.

| Token | Value | Use |
|---|---|---|
| `white.base` | `#E8E2D4` | Bone |
| `white.accent` | `#FFFAF0` | |
| `white.shade` | `#C4BCA8` | |
| `white.detail` | `#8FA89B` | Muted sage |
| `black.base` | `#3A4550` | Slate |
| `black.accent` | `#4E5B68` | |
| `black.shade` | `#252D35` | |
| `black.detail` | `#B08D57` | Aged brass |
| `lightSquare` | `#B8B0A0` | |
| `darkSquare` | `#6E6A63` | |
| `frame` | `#2A2E33` | |
| `background` | `#1A1D21` | |

Ship two additional themes so the theming machinery is exercised and not merely theoretical. The board squares are deliberately low-contrast relative to the pieces; high-contrast squares fight the pieces for attention at this tilt.

## Board geometry

The board is a single mesh, generated the same way:

- 8 × 8 squares, each 13 × 13 voxels, 2 voxels deep.
- A frame 4 voxels wide and 4 voxels tall surrounding it.
- Rank and file coordinates extruded into the frame as 3-voxel-tall glyphs, on two adjacent edges only.

Generate the board from the same mesher, treating it as one large voxel grid, so it shares the shading model and reads as part of the same world. Do not build the board from Three.js primitives — the mismatch in shading is immediately visible.

## Validation tests

Required, in `tests/unit/voxel.test.ts`:

1. Every piece definition has consistent layer dimensions (11 × 11 throughout).
2. Every piece uses only legal characters.
3. Every voxel is face-connected to the base (no floaters).
4. All six pieces share identical bottom three layers.
5. Heights match the table above.
6. Meshing all twelve geometries completes under the time budget.
7. Snapshot the triangle count per piece to catch accidental blowup.
