import * as THREE from "three";
import { Square } from "../core/types";
import { VOXEL_SIZE } from "./voxel/mesher";

const BOARD_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const squareSize = 13 * VOXEL_SIZE; // 1.0 world units
const totalSize = 8 * squareSize; // 8.0 world units
const halfBoard = totalSize / 2; // 4.0

export function worldToSquare(
  point: THREE.Vector3,
  boardFlipped: boolean,
): Square | null {
  // World space X: -4 to +4 (a to h for white, h to a for flipped)
  // World space Z: -4 to +4 (rank 8 to rank 1 for white, rank 1 to rank 8 for flipped)
  let file = Math.floor((point.x + halfBoard) / squareSize);
  let rank = 7 - Math.floor((point.z + halfBoard) / squareSize);

  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;

  if (boardFlipped) {
    file = 7 - file;
    rank = 7 - rank;
  }

  return rank * 8 + file;
}

export function squareToWorld(
  square: Square,
  boardFlipped: boolean,
): THREE.Vector3 {
  let file = square % 8;
  let rank = Math.floor(square / 8);

  if (boardFlipped) {
    file = 7 - file;
    rank = 7 - rank;
  }

  const x = (file + 0.5) * squareSize - halfBoard;
  const z = (7 - rank + 0.5) * squareSize - halfBoard;
  return new THREE.Vector3(x, 0, z);
}

export function raycastToSquare(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  boardFlipped: boolean,
): Square | null {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const target = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(BOARD_PLANE, target);
  if (!hit) return null;

  return worldToSquare(target, boardFlipped);
}
