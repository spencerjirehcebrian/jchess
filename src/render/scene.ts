import * as THREE from "three";
import { Theme } from "./voxel/palette";
import { meshBoard } from "./voxel/mesher";

export function createScene(theme: Theme): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  dirLight: THREE.DirectionalLight;
  boardMesh: THREE.Mesh;
  boardContainerGroup: THREE.Group;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.background);

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

  // Position camera at 57 degree pitch down along Z axis
  const pitchRad = (57 * Math.PI) / 180;
  const dist = 20;
  camera.position.set(0, dist * Math.sin(pitchRad), dist * Math.cos(pitchRad));
  camera.lookAt(0, 0, 0);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xb8c4d0, 0.65);
  scene.add(ambientLight);

  // Directional light with shadow mapping
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
  dirLight.position.set(-8, 14, 8);
  dirLight.castShadow = true;

  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 30;

  const d = 6.0;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0005;

  scene.add(dirLight);

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
