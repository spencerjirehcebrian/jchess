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
| Pawn | 12 |
| Knight | 17 |
| Bishop | 17 |
| Rook | 15 |
| Queen | 19 |
| King | 20 |

The king's 20 voxels is a ceiling derived from the camera, not a taste call. A
piece projects to `height x cos(62 deg)` of screen height while consecutive
ranks sit `1 square x sin(62 deg)` apart, so a piece taller than 20 voxels
starts covering the piece standing behind it. The original 14-24 range broke
this and the back rank was routinely hidden by its own pawns.

- **World scale: 1 voxel = 1/13 of a square.** Set square size to 1.0 world unit, so `VOXEL_SIZE = 1 / 13`.

### Authoring rules

1. **Every piece must be distinguishable by silhouette alone** from the fixed camera. Test by rendering flat black on white and checking that all six read at 64px tall.
2. **Distinguish by mass, not by finial.** The camera flattens the top of every piece, so a crown ornament is the least visible part of the model. Roles must differ in plan and profile: the rook is the only square-plan piece, the queen carries the widest crown, the pawn is by far the shortest. Four pieces sharing a stem and differing only in their tip is the failure mode this rule exists to prevent.
3. **The knight is the hard one.** Build it first. It is authored **in profile along X, muzzle to the left**, not facing the opponent along Z — the camera looks down the Z axis, so a forward-facing horse is seen nose-on and reads as a lumpy cylinder. Both colours face the same way, as in any 2D chess set.
4. **Bases must be identical across all pieces** — same footprint, same bottom three layers. This makes pieces sit consistently and simplifies the contact shadow.
5. **Shade (`-`) is not optional.** Use it as a recessed course at the plinth and at each waist. Keep it close to base: pushed too dark it reads as a break and severs the piece into two stacked objects.
6. **No floating voxels.** Every voxel must be connected to the base through face-adjacency. Add a validation function that asserts this and run it in tests.

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

### Default theme: "Lacquer"

Japanese lacquerware: urushi black and maki-e gold against pale boxwood and
vermilion. Chosen because it is what this renderer can execute honestly — deep
black, a hard specular edge and gold catching the light need no texture, while
marble, wood grain and metal roughness all need maps the mesher cannot produce.
It also gives the `o` detail channel real work: crowns, the king's cross, the
knight's eye and the bishop's orb are the only per-piece identity signals, and
in gold or vermilion they finally read.

| Token | Value | Use |
|---|---|---|
| `white.base` | `#EDE0C8` | Boxwood |
| `white.accent` | `#FBF3E0` | |
| `white.shade` | `#D8CAAC` | |
| `white.detail` | `#D1462F` | Vermilion |
| `black.base` | `#241B16` | Urushi |
| `black.accent` | `#3E2F24` | |
| `black.shade` | `#1E1613` | |
| `black.detail` | `#C9A227` | Maki-e gold |
| `lightSquare` | `#9C7F5C` | |
| `darkSquare` | `#4A3324` | |
| `frame` | `#241813` | |
| `frameInlay` | `#8A6B2E` | Gold inlay line and engraved coordinates |
| `background` | `#0A0705` | Room floor |
| `backgroundTop` | `#1F1610` | Room wall, lit |

The squares sit between the two piece colours in value. Pushing them further
apart makes the board shout over the pieces, which is the wrong way round.

### Alternative theme: "Oxide"

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

- 8 × 8 squares, each 13 × 13 voxels, on a tray 6 voxels deep.
- A frame 8 voxels wide standing 1 voxel proud of the playing surface, so the board reads as a tray rather than a decal.
- A 1-voxel inlay line in `frameInlay` separating the frame from the squares.
- Rank and file coordinates engraved into the frame — recessed to the height of the playing surface and coloured `frameInlay` — as 3 × 5 glyphs on all four edges, files on the near and far bands and ranks on the left and right, so both sides of the board have the row and column in front of them labelled. The frame is 8 wide to fit them: inlay, a voxel of margin, the 5-voxel glyph, a voxel before the outer edge.

Columns are emitted as a top face plus whatever wall is exposed against each
neighbour. That single rule gives the perimeter its full depth, the frame lip
its one-voxel step, and the engraved glyphs their shadowed edges for free.

Because the coordinates are baked into the mesh, flipping the board re-meshes it
with the labels stamped for the new orientation. It must not rotate the mesh:
the camera is fixed, so a turned board is a board printed upside down.

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
