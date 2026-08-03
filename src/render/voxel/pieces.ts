import { Role } from "../../core/types";

export type VoxelLayer = string[];
export type VoxelGrid = VoxelLayer[];

export interface PieceDefinition {
  role: Role;
  grid: VoxelGrid;
  height: number;
}

/*
 * Authoring notes
 * ---------------
 * The camera is a fixed orthographic view tilted 62 degrees, which foreshortens
 * the Z axis and flattens the top of every piece. A piece is therefore
 * identified by the mass of its body, not by the ornament on its crown: two
 * pieces that share a stem and differ only in their finial are the same piece
 * to a player glancing at the board.
 *
 * So each role owns a distinct plan and profile:
 *
 *   pawn    round, shortest, ball on a stub          12
 *   rook    the only square plan, notched parapet    15
 *   knight  side profile, muzzle left, two ears      17
 *   bishop  smooth cone, flared shoulder, slit       17
 *   queen   narrow waist into the widest crown       19
 *   king    tallest, narrow crown, upright cross     20
 *
 * The king's 20 voxels is a hard ceiling, not a preference: a piece projects
 * to height * cos(62 degrees) on screen while consecutive ranks are one
 * square * sin(62 degrees) apart, so anything over 20 voxels starts covering
 * the piece standing behind it.
 *
 * Materials: '#' base, '+' accent (one step lighter), '-' shade (one step
 * darker), 'o' detail. Shade earns its keep as a recessed band at the plinth
 * and at each waist — without it the mid-body of a tall piece is one flat
 * value from base to collar.
 */

/** Blank row, for layers that only occupy part of the footprint. */
const E = "...........";

/** 9-wide round plan. */
const R5: VoxelLayer = [
  E,
  "...#####...",
  "..#######..",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  "..#######..",
  "...#####...",
  E,
];

/** 7-wide round plan. */
const R4: VoxelLayer = [
  E,
  E,
  "....###....",
  "...#####...",
  "..#######..",
  "..#######..",
  "..#######..",
  "...#####...",
  "....###....",
  E,
  E,
];

/** 5-wide round plan. */
const R3: VoxelLayer = [
  E,
  E,
  E,
  "....###....",
  "...#####...",
  "...#####...",
  "...#####...",
  "....###....",
  E,
  E,
  E,
];

/** 3-wide plan. */
const R2: VoxelLayer = [
  E,
  E,
  E,
  E,
  "....###....",
  "....###....",
  "....###....",
  E,
  E,
  E,
  E,
];

/** 7-wide octagon, the step between the round base and the rook's square body. */
const OCT7: VoxelLayer = [
  E,
  E,
  "...#####...",
  "..#######..",
  "..#######..",
  "..#######..",
  "..#######..",
  "..#######..",
  "...#####...",
  E,
  E,
];

/** 7-wide square plan. Only the rook uses it, which is the point. */
const S7: VoxelLayer = [
  E,
  E,
  "..#######..",
  "..#######..",
  "..#######..",
  "..#######..",
  "..#######..",
  "..#######..",
  "..#######..",
  E,
  E,
];

/** 9-wide square plan. */
const S9: VoxelLayer = [
  E,
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  ".#########.",
  E,
];

/** Recolours a plan into another material. */
function paint(plan: VoxelLayer, char: string): VoxelLayer {
  return plan.map((row) => row.replace(/#/g, char));
}

/*
 * Shared base: a wide plinth, a recessed shade course that reads as the
 * shadow line under a piece, then a taper. Identical on all six so they sit
 * as one set.
 */
const BASE_0 = R5;
const BASE_1 = paint(R5, "-");
const BASE_2 = R4;

// ---------------------------------------------------------------------------
// PAWN — height 12
// ---------------------------------------------------------------------------
const PAWN_GRID: VoxelGrid = [
  BASE_0,
  BASE_1,
  BASE_2,
  R3, // stem
  paint(R3, "-"), // waist groove
  paint(R4, "+"), // collar
  R4, // head
  R4,
  R4,
  R4,
  R3,
  R2,
];

// ---------------------------------------------------------------------------
// ROOK — height 15. Square from the third course up.
// ---------------------------------------------------------------------------
/** Parapet: a continuous wall with an embrasure cut through each face. */
const ROOK_PARAPET: VoxelLayer = [
  E,
  ".##.###.##.",
  ".#.......#.",
  E,
  ".#.......#.",
  ".#.......#.",
  ".#.......#.",
  E,
  ".#.......#.",
  ".##.###.##.",
  E,
];

const ROOK_GRID: VoxelGrid = [
  BASE_0,
  BASE_1,
  BASE_2,
  OCT7, // round-to-square transition
  S7,
  S7,
  paint(S7, "-"), // course line
  S7,
  S7,
  S7,
  S7,
  S9, // corbel
  paint(S9, "+"), // rim
  ROOK_PARAPET,
  ROOK_PARAPET,
];

// ---------------------------------------------------------------------------
// KNIGHT — height 17.
//
// The knight is the one piece identified by a profile rather than a plan, and
// the camera looks straight down the Z axis. Authored facing the opponent the
// horse is seen nose-on and reads as a lumpy cylinder, so it is authored in
// profile along X instead, muzzle to the left. Both colours face the same way,
// which is the convention every 2D chess set uses for the same reason.
// ---------------------------------------------------------------------------

/** A slab five voxels deep in Z carrying a left-to-right profile. */
function slab(profile: string): VoxelLayer {
  return [E, E, E, profile, profile, profile, profile, profile, E, E, E];
}

const KNIGHT_GRID: VoxelGrid = [
  BASE_0,
  BASE_1,
  BASE_2,
  slab("..#######.."), // chest
  slab("..-------.."), // chest groove
  slab("..#######.."),
  slab("..#######.."),
  slab("..#######.."), // shoulder
  slab("..######+.."), // neck; the mane starts at the back
  slab("..#####++.."),
  slab(".######++.."), // head begins reaching forward
  slab(".######+..."),
  slab(".###o##...."), // muzzle, with the eye as the only detail voxel
  slab(".######...."),
  slab("...####...."), // skull
  slab("....#.#...."), // ears
  slab("....#.#...."),
];

// ---------------------------------------------------------------------------
// BISHOP — height 17. Cone, flared shoulder, slit mitre.
// ---------------------------------------------------------------------------
/** The mitre's slit, cut through the front half only. */
const BISHOP_SLIT: VoxelLayer = [
  E,
  E,
  E,
  "....#.#....",
  "...##.##...",
  "...##.##...",
  "...#####...",
  "....###....",
  E,
  E,
  E,
];

const BISHOP_ORB: VoxelLayer = [E, E, E, E, E, ".....o.....", E, E, E, E, E];

const BISHOP_GRID: VoxelGrid = [
  BASE_0,
  BASE_1,
  BASE_2,
  R4,
  paint(R4, "-"), // waist groove
  R4,
  R4,
  R3, // taper
  R3,
  R3,
  paint(R4, "+"), // shoulder
  R3, // mitre
  BISHOP_SLIT,
  BISHOP_SLIT,
  R2,
  R2,
  BISHOP_ORB,
];

// ---------------------------------------------------------------------------
// QUEEN — height 19. Narrow waist opening into the widest crown on the board.
// ---------------------------------------------------------------------------
/** Coronet: eight points around the rim, on a central boss. */
const QUEEN_CORONET: VoxelLayer = [
  E,
  "....o.o....",
  "..o.....o..",
  E,
  ".o..###..o.",
  "....###....",
  ".o..###..o.",
  E,
  "..o.....o..",
  "....o.o....",
  E,
];

const QUEEN_JEWEL: VoxelLayer = [
  E,
  E,
  E,
  E,
  "....ooo....",
  "....ooo....",
  "....ooo....",
  E,
  E,
  E,
  E,
];

const QUEEN_GRID: VoxelGrid = [
  BASE_0,
  BASE_1,
  BASE_2,
  R4,
  paint(R4, "-"),
  R4,
  R4,
  R3,
  R3,
  paint(R3, "-"), // waist groove
  R3,
  R3,
  R3,
  paint(R4, "+"), // collar
  R5, // crown flare
  paint(R5, "+"),
  QUEEN_CORONET,
  QUEEN_CORONET,
  QUEEN_JEWEL,
];

// ---------------------------------------------------------------------------
// KING — height 20. Tallest, narrowest crown, upright cross.
// ---------------------------------------------------------------------------
/** Horizontal arms of the cross, extending along X so they read from the front. */
const KING_CROSS_ARMS: VoxelLayer = [
  E,
  E,
  E,
  E,
  "..ooooooo..",
  "..ooooooo..",
  "..ooooooo..",
  E,
  E,
  E,
  E,
];

const KING_CROSS_STEM = paint(R2, "o");

const KING_GRID: VoxelGrid = [
  BASE_0,
  BASE_1,
  BASE_2,
  R4,
  paint(R4, "-"),
  R4,
  R4,
  R3,
  R3,
  paint(R3, "-"), // waist groove
  R3,
  R3,
  R3,
  paint(R4, "+"), // collar
  R4, // crown band, narrower than the queen's
  paint(R4, "+"),
  KING_CROSS_STEM,
  KING_CROSS_ARMS,
  // Two stem voxels above the arms, not one: the camera looks down on the
  // cross, and a single voxel hides behind the bar it is meant to top.
  KING_CROSS_STEM,
  KING_CROSS_STEM,
];

export const PIECE_DEFINITIONS: Record<Role, PieceDefinition> = {
  pawn: { role: "pawn", grid: PAWN_GRID, height: PAWN_GRID.length },
  knight: { role: "knight", grid: KNIGHT_GRID, height: KNIGHT_GRID.length },
  bishop: { role: "bishop", grid: BISHOP_GRID, height: BISHOP_GRID.length },
  rook: { role: "rook", grid: ROOK_GRID, height: ROOK_GRID.length },
  queen: { role: "queen", grid: QUEEN_GRID, height: QUEEN_GRID.length },
  king: { role: "king", grid: KING_GRID, height: KING_GRID.length },
};
