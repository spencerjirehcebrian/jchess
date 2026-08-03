import * as THREE from "three";
import { Theme } from "./voxel/palette";
import { meshBoard } from "./voxel/mesher";

/**
 * The room is a vertical gradient rather than a flat fill: dark pieces need a
 * lifted wall behind them or their silhouettes disappear into the background,
 * and a flat fill leaves the board floating in a void.
 */
export function createBackground(theme: Theme): THREE.Texture | THREE.Color {
  const fallback = new THREE.Color(theme.background);
  if (typeof document === "undefined") return fallback;

  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, theme.backgroundTop ?? theme.background);
  gradient.addColorStop(1, theme.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createScene(theme: Theme): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  dirLight: THREE.DirectionalLight;
  boardMesh: THREE.Mesh;
  boardContainerGroup: THREE.Group;
} {
  const scene = new THREE.Scene();
  scene.background = createBackground(theme);

  // Camera setup: orthographic at 57 degrees tilt, yaw 0
  const aspect =
    typeof window !== "undefined" ? window.innerWidth / window.innerHeight : 1;
  const extent = 10.0; // Board + frame extent
  const padding = 1.03;

  const halfH = (extent * padding) / 2;
  const halfW = halfH * aspect;

  const camera = new THREE.OrthographicCamera(
    -halfW,
    halfW,
    halfH,
    -halfH,
    -100,
    100,
  );

  // Pitch is 62 degrees, not the 57 the docs started from. At 57 a back-rank
  // piece projects to almost exactly one rank of screen height, so the pawn
  // standing behind it began where its crown ended and the two ranks read as
  // one clump. 62 opens a clear band of board between them.
  const pitchRad = (62 * Math.PI) / 180;
  const dist = 20;
  camera.position.set(0, dist * Math.sin(pitchRad), dist * Math.cos(pitchRad));
  camera.lookAt(0, 0, 0);

  // Three-light rig. The intensities are budgeted so an upward face of the
  // brightest material (white.accent) lands just under 1.0 and never clips:
  // ambient + key·0.81 + fill·0.47 ≈ 1.05.
  const ambientLight = new THREE.AmbientLight(0xfff0dc, 0.3);
  scene.add(ambientLight);

  // Key: warm, high, front-left. Casts the only shadow.
  const dirLight = new THREE.DirectionalLight(0xffe9c4, 0.8);
  dirLight.position.set(-7, 13, 6);
  dirLight.castShadow = true;

  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 40;
  dirLight.shadow.radius = 3;

  const d = 7.0;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0005;

  scene.add(dirLight);

  // Fill: cool, low, opposite the key. Separates the shadowed sides of a piece
  // from the shadowed sides of the board behind it.
  const fillLight = new THREE.DirectionalLight(0x8fb4d8, 0.22);
  fillLight.position.set(9, 6, -7);
  scene.add(fillLight);

  // Board Container Group & Board mesh
  const boardContainerGroup = new THREE.Group();
  boardContainerGroup.name = "boardContainerGroup";
  scene.add(boardContainerGroup);

  const boardGeo = meshBoard(theme);
  const boardMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.receiveShadow = true;
  boardMesh.name = "boardMesh";

  boardContainerGroup.add(boardMesh);

  return {
    scene,
    camera,
    dirLight,
    boardMesh,
    boardContainerGroup,
  };
}
