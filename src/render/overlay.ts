import * as THREE from "three";
import { Square } from "../core/types";
import { squareToWorld } from "./picking";
import { Theme } from "./voxel/palette";

export type DotVariant = "legal" | "premove";

/*
 * Overlays are drawn in the theme accent — gold, in Lacquer — and premoves in
 * the premove token. That split carries meaning: gold marks what is true of
 * the position right now (last move, selection, legal destinations) and the
 * premove hue marks what is only queued. Previously both used a piece's detail
 * colour, so a routine last-move highlight arrived in alarm red.
 */

/** No theme exposes an error token; premove drain failures use a fixed red. */
const ERROR_FLASH_COLOR = "#C64B4B";

export class OverlayManager {
  readonly group = new THREE.Group();

  private lastMoveFromQuad: THREE.Mesh;
  private lastMoveToQuad: THREE.Mesh;
  private selectedSquareQuad: THREE.Mesh;
  private legalDotsGroup = new THREE.Group();
  private legalDotsPool: THREE.Mesh[] = [];
  private legalDotMaterial: THREE.MeshBasicMaterial;
  private premoveDotMaterial: THREE.MeshBasicMaterial;
  private flashPool: THREE.Mesh[] = [];
  private flashMaterial: THREE.MeshBasicMaterial;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  public readonly impactRingMesh: THREE.Mesh;

  constructor(theme: Theme) {
    this.group.name = "overlayGroup";
    this.group.position.y = 0.02;

    const squareGeo = new THREE.PlaneGeometry(0.96, 0.96);
    squareGeo.rotateX(-Math.PI / 2);

    // Impact ring for captures
    const ringGeo = new THREE.RingGeometry(0.2, 0.45, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.cssTokens.accent),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.impactRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.impactRingMesh.visible = false;
    this.group.add(this.impactRingMesh);

    // Last move from
    const fromMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.cssTokens.accent),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    this.lastMoveFromQuad = new THREE.Mesh(squareGeo, fromMat);
    this.lastMoveFromQuad.visible = false;
    this.group.add(this.lastMoveFromQuad);

    // Last move to
    const toMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.cssTokens.accent),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.lastMoveToQuad = new THREE.Mesh(squareGeo, toMat);
    this.lastMoveToQuad.visible = false;
    this.group.add(this.lastMoveToQuad);

    // Selected square
    const selMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.cssTokens.accent),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.selectedSquareQuad = new THREE.Mesh(squareGeo, selMat);
    this.selectedSquareQuad.visible = false;
    this.group.add(this.selectedSquareQuad);

    // Legal move dots pool (up to 28)
    const dotGeo = new THREE.CircleGeometry(0.12, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.cssTokens.accent),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    this.legalDotMaterial = dotMat;

    // Premove destinations get a distinct hue (docs/08-input.md).
    this.premoveDotMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.cssTokens.premove),
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    for (let i = 0; i < 28; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.visible = false;
      this.legalDotsPool.push(dot);
      this.legalDotsGroup.add(dot);
    }
    this.group.add(this.legalDotsGroup);

    // Error flash for a premove queue that failed to drain.
    this.flashMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ERROR_FLASH_COLOR),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const quad = new THREE.Mesh(squareGeo, this.flashMaterial);
      quad.visible = false;
      this.flashPool.push(quad);
      this.group.add(quad);
    }
  }

  setLastMove(from: Square | null, to: Square | null, boardFlipped: boolean) {
    if (from !== null) {
      const pos = squareToWorld(from, boardFlipped);
      this.lastMoveFromQuad.position.set(pos.x, 0, pos.z);
      this.lastMoveFromQuad.visible = true;
    } else {
      this.lastMoveFromQuad.visible = false;
    }

    if (to !== null) {
      const pos = squareToWorld(to, boardFlipped);
      this.lastMoveToQuad.position.set(pos.x, 0, pos.z);
      this.lastMoveToQuad.visible = true;
    } else {
      this.lastMoveToQuad.visible = false;
    }
  }

  setSelectedSquare(square: Square | null, boardFlipped: boolean) {
    if (square !== null) {
      const pos = squareToWorld(square, boardFlipped);
      this.selectedSquareQuad.position.set(pos.x, 0, pos.z);
      this.selectedSquareQuad.visible = true;
    } else {
      this.selectedSquareQuad.visible = false;
    }
  }

  setLegalMoveDots(
    squares: Square[],
    boardFlipped: boolean,
    variant: DotVariant = "legal",
  ) {
    const material =
      variant === "premove" ? this.premoveDotMaterial : this.legalDotMaterial;

    for (let i = 0; i < this.legalDotsPool.length; i++) {
      const dot = this.legalDotsPool[i]!;
      dot.material = material;
      if (i < squares.length) {
        const sq = squares[i]!;
        const pos = squareToWorld(sq, boardFlipped);
        dot.position.set(pos.x, 0, pos.z);
        dot.visible = true;
      } else {
        dot.visible = false;
      }
    }
  }

  /** Briefly highlights squares in the error hue; `onChange` requests a redraw. */
  flashSquares(
    squares: Square[],
    boardFlipped: boolean,
    durationMs: number,
    onChange?: () => void,
  ) {
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);

    for (let i = 0; i < this.flashPool.length; i++) {
      const quad = this.flashPool[i]!;
      if (i < squares.length) {
        const pos = squareToWorld(squares[i]!, boardFlipped);
        quad.position.set(pos.x, 0, pos.z);
        quad.visible = true;
      } else {
        quad.visible = false;
      }
    }
    onChange?.();

    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      for (const quad of this.flashPool) quad.visible = false;
      onChange?.();
    }, durationMs);
  }

  clearAll() {
    this.lastMoveFromQuad.visible = false;
    this.lastMoveToQuad.visible = false;
    this.selectedSquareQuad.visible = false;
    for (const dot of this.legalDotsPool) {
      dot.visible = false;
    }
    for (const quad of this.flashPool) {
      quad.visible = false;
    }
  }

  setTheme(theme: Theme) {
    const detailColor = new THREE.Color(theme.cssTokens.accent);
    (this.impactRingMesh.material as THREE.MeshBasicMaterial).color =
      detailColor;
    (this.lastMoveFromQuad.material as THREE.MeshBasicMaterial).color =
      detailColor;
    (this.lastMoveToQuad.material as THREE.MeshBasicMaterial).color =
      detailColor;
    (this.selectedSquareQuad.material as THREE.MeshBasicMaterial).color =
      detailColor;
    this.legalDotMaterial.color = detailColor;
    this.premoveDotMaterial.color = new THREE.Color(theme.cssTokens.premove);
  }

  dispose() {
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
    // Flash quads share squareGeo with the highlight quads disposed below.
    this.premoveDotMaterial.dispose();
    this.flashMaterial.dispose();
    this.flashPool = [];
    this.impactRingMesh.geometry.dispose();
    (this.impactRingMesh.material as THREE.Material).dispose();
    this.lastMoveFromQuad.geometry.dispose();
    (this.lastMoveFromQuad.material as THREE.Material).dispose();
    this.lastMoveToQuad.material &&
      (this.lastMoveToQuad.material as THREE.Material).dispose();
    this.selectedSquareQuad.material &&
      (this.selectedSquareQuad.material as THREE.Material).dispose();
    if (this.legalDotsPool.length > 0) {
      this.legalDotsPool[0]!.geometry.dispose();
      (this.legalDotsPool[0]!.material as THREE.Material).dispose();
    }
    this.legalDotsPool = [];
  }
}
