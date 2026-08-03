import * as THREE from "three";
import { Theme, THEMES, applyThemeToCss } from "./voxel/palette";
import { createScene } from "./scene";
import { meshBoard } from "./voxel/mesher";
import { PieceManager } from "./pieces";
import { OverlayManager } from "./overlay";
import { raycastToSquare } from "./picking";
import { AnimationEngine, PieceAnimTarget } from "./animation/engine";
import { Square } from "../core/types";
import { Store } from "../store";
import { positionAfter, legalMovesFrom } from "../core/rules";

export class Renderer {
  private canvas: HTMLCanvasElement;
  private theme: Theme;
  private webglRenderer: THREE.WebGLRenderer;
  private camera: THREE.OrthographicCamera;
  private scene: THREE.Scene;
  private boardMesh: THREE.Mesh;
  private boardContainerGroup: THREE.Group;
  private pieceManager: PieceManager;
  private overlayManager: OverlayManager;
  private animEngine = new AnimationEngine();
  private raycaster = new THREE.Raycaster();

  private dirty = true;
  private rafHandle: number | null = null;
  private resizeRafHandle: number | null = null;
  private boardFlipped = false;
  private resizeObserver: ResizeObserver | null = null;
  private hoveredSquare: Square | null = null;
  private currentBoardSize: string = "full";

  public onSquarePointerDown?: (square: Square, event: PointerEvent) => void;
  public onSquarePointerUp?: (square: Square, event: PointerEvent) => void;
  public onSquareHover?: (square: Square | null) => void;

  constructor(canvas: HTMLCanvasElement, theme?: Theme) {
    this.canvas = canvas;
    this.theme = theme ?? THEMES.oxide!;

    try {
      this.webglRenderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.webglRenderer.shadowMap.enabled = true;
      this.webglRenderer.shadowMap.type = THREE.PCFShadowMap;
      this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      this.webglRenderer = {
        shadowMap: {},
        setPixelRatio: () => {},
        setSize: () => {},
        render: () => {},
        dispose: () => {},
      } as unknown as THREE.WebGLRenderer;
    }

    const { scene, camera, boardMesh, boardContainerGroup } = createScene(this.theme);
    this.scene = scene;
    this.camera = camera;
    this.boardMesh = boardMesh;
    this.boardContainerGroup = boardContainerGroup;

    applyThemeToCss(this.theme);

    this.pieceManager = new PieceManager(this.theme);
    this.boardContainerGroup.add(this.pieceManager.piecesGroup);
    this.boardContainerGroup.add(this.pieceManager.shadowQuadsGroup);

    this.overlayManager = new OverlayManager(this.theme);
    this.boardContainerGroup.add(this.overlayManager.group);

    this.boardContainerGroup.add(this.animEngine.debrisManager.group);

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
  }

  mount(): void {
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);

    this.requestRender();
  }

  dispose(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    if (this.resizeRafHandle !== null) {
      cancelAnimationFrame(this.resizeRafHandle);
      this.resizeRafHandle = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);

    this.animEngine.debrisManager.dispose();
    this.pieceManager.dispose();
    this.overlayManager.dispose();
    this.webglRenderer.dispose();
  }

  attach(store: Store): () => void {
    const getState = () =>
      "getState" in (store as any) &&
      typeof (store as any).getState === "function"
        ? (store as any).getState()
        : store;

    let lastBoardSize = getState()?.boardSize;
    let prevCursor = -1;

    const updateFromStore = (stateArg?: any) => {
      const state = stateArg && "history" in stateArg ? stateArg : getState();
      if (!state || !state.history) return;

      if (state.theme && THEMES[state.theme] && THEMES[state.theme]!.id !== this.theme.id) {
        this.setTheme(THEMES[state.theme]!);
      }

      this.boardFlipped = !!state.boardFlipped;

      if (state.boardSize !== lastBoardSize) {
        lastBoardSize = state.boardSize;
        this.currentBoardSize = state.boardSize ?? "full";
        this.resize();

        if (this.resizeRafHandle !== null) {
          cancelAnimationFrame(this.resizeRafHandle);
          this.resizeRafHandle = null;
        }

        let frameCount = 0;
        const animateResize = () => {
          this.resize();
          if (++frameCount < 15) {
            this.resizeRafHandle = requestAnimationFrame(animateResize);
          } else {
            this.resizeRafHandle = null;
          }
        };
        this.resizeRafHandle = requestAnimationFrame(animateResize);
      }

      const historyToRender = state.history.slice(0, state.cursor);
      const currentCursor = state.cursor;
      const currentHistoryLength = state.history.length;

      const isLiveSingleMove =
        prevCursor >= 0 &&
        currentCursor === currentHistoryLength &&
        currentCursor === prevCursor + 1 &&
        historyToRender.length > 0;

      const currentPos = positionAfter(
        state.initialFen,
        historyToRender.map((h: any) => h.move),
      );

      if (isLiveSingleMove) {
        const lastEntry = historyToRender[historyToRender.length - 1];
        const lastMove = lastEntry.move;
        const prevHistory = historyToRender.slice(0, historyToRender.length - 1);
        const prevPos = positionAfter(
          state.initialFen,
          prevHistory.map((h: any) => h.move),
        );

        const movingPiece = prevPos.board.get(lastMove.from);
        const isKnight = movingPiece?.role === "knight";

        let capturedSquare: Square | null = null;
        if (
          movingPiece?.role === "pawn" &&
          lastMove.from % 8 !== lastMove.to % 8 &&
          !prevPos.board.get(lastMove.to)
        ) {
          // En passant capture
          capturedSquare = Math.floor(lastMove.from / 8) * 8 + (lastMove.to % 8);
        } else if (prevPos.board.get(lastMove.to)) {
          capturedSquare = lastMove.to;
        }

        let isCastle = false;
        let rookFrom: Square | undefined;
        let rookTo: Square | undefined;

        if (movingPiece?.role === "king") {
          const fromFile = lastMove.from % 8;
          const toFile = lastMove.to % 8;
          if (Math.abs(fromFile - toFile) === 2) {
            isCastle = true;
            if (lastMove.to === 6) {
              rookFrom = 7;
              rookTo = 5;
            } else if (lastMove.to === 2) {
              rookFrom = 0;
              rookTo = 3;
            } else if (lastMove.to === 62) {
              rookFrom = 63;
              rookTo = 61;
            } else if (lastMove.to === 58) {
              rookFrom = 56;
              rookTo = 59;
            }
          }
        }

        const movingRendered = this.pieceManager.getPieceAt(lastMove.from);
        const capturedRendered =
          capturedSquare !== null ? this.pieceManager.getPieceAt(capturedSquare) : null;
        const rookRendered =
          isCastle && rookFrom !== undefined ? this.pieceManager.getPieceAt(rookFrom) : null;

        if (movingRendered) {
          const skipSquares = new Set<Square>([lastMove.to]);
          if (rookTo !== undefined) skipSquares.add(rookTo);

          const updateOpts: { skipSquares?: Set<Square>; retainedIds?: Set<string> } = {
            skipSquares,
          };
          if (capturedRendered) {
            updateOpts.retainedIds = new Set<string>([capturedRendered.id]);
          }

          this.pieceManager.updatePosition(currentPos, this.boardFlipped, updateOpts);

          this.animEngine.cancelAll();

          const capturedId = capturedRendered?.id;
          const animTarget: PieceAnimTarget = {
            mesh: movingRendered.mesh,
            shadowQuad: movingRendered.shadowQuad,
            fromSquare: lastMove.from,
            toSquare: lastMove.to,
            durationMs: 220,
            isKnight,
            isCapture: !!capturedRendered,
            isCastle,
            isPromotion: !!lastMove.promotion,
          };

          if (capturedRendered) {
            animTarget.capturedMesh = capturedRendered.mesh;
            animTarget.capturedShadowQuad = capturedRendered.shadowQuad;
            animTarget.capturedRole = capturedRendered.role;
            animTarget.capturedColor = capturedRendered.color;
            animTarget.palette =
              capturedRendered.color === "white"
                ? this.theme.white
                : this.theme.black;
            animTarget.impactRing = this.overlayManager.impactRingMesh;
          }

          if (isCastle && rookRendered && rookFrom !== undefined && rookTo !== undefined) {
            animTarget.rookMesh = rookRendered.mesh;
            animTarget.rookShadowQuad = rookRendered.shadowQuad;
            animTarget.rookFromSquare = rookFrom;
            animTarget.rookToSquare = rookTo;
          }

          this.animEngine.animateMove(
            animTarget,
            this.boardFlipped,
            () => {
              if (capturedId) {
                this.pieceManager.removePiece(capturedId);
              }
            },
          );
        } else {
          this.animEngine.cancelAll();
          this.pieceManager.updatePosition(currentPos, this.boardFlipped);
        }
      } else {
        this.animEngine.cancelAll();
        this.pieceManager.updatePosition(currentPos, this.boardFlipped);
      }

      prevCursor = currentCursor;

      // Update overlays
      const lastEntry = historyToRender[historyToRender.length - 1];
      if (lastEntry) {
        this.overlayManager.setLastMove(
          lastEntry.move.from,
          lastEntry.move.to,
          this.boardFlipped,
        );
      } else {
        this.overlayManager.setLastMove(null, null, this.boardFlipped);
      }

      this.overlayManager.setSelectedSquare(
        state.selectedSquare,
        this.boardFlipped,
      );

      if (state.selectedSquare !== null) {
        const legals = legalMovesFrom(currentPos, state.selectedSquare);
        this.overlayManager.setLegalMoveDots(
          legals.map((m) => m.to),
          this.boardFlipped,
        );
      } else {
        this.overlayManager.setLegalMoveDots([], this.boardFlipped);
      }

      this.requestRender();
    };

    // Initial update
    updateFromStore(store);

    // Subscribe to store updates
    const subscribeFn =
      (store as any).subscribe ?? (store.setState as any)?.subscribe;
    const unsubscribe =
      typeof subscribeFn === "function"
        ? subscribeFn(updateFromStore)
        : () => {};

    return unsubscribe;
  }

  requestRender(): void {
    this.dirty = true;
    if (this.rafHandle === null) {
      this.rafHandle = requestAnimationFrame((t) => this.frame(t));
    }
  }

  private frame(t: number): void {
    this.rafHandle = null;
    const isAnimating = this.animEngine.update(t);
    const physics = this.animEngine.getBoardTransform(t);

    this.boardContainerGroup.position.copy(physics.positionOffset);
    this.boardContainerGroup.rotation.copy(physics.rotationOffset);

    if (this.dirty || isAnimating || physics.isActive) {
      this.webglRenderer.render(this.scene, this.camera);
      this.dirty = false;
    }

    if (isAnimating || physics.isActive) {
      this.requestRender();
    }
  }

  public resize(): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const parentRect = this.canvas.parentElement?.getBoundingClientRect();

    const width = Math.max(
      1,
      Math.floor(
        rect.width ||
          this.canvas.clientWidth ||
          parentRect?.width ||
          window.innerWidth,
      ),
    );
    const height = Math.max(
      1,
      Math.floor(
        rect.height ||
          this.canvas.clientHeight ||
          parentRect?.height ||
          window.innerHeight,
      ),
    );

    this.webglRenderer.setSize(width, height, false);

    const aspect = width / height;
    const extent = 10.0;
    const padding = 1.03;

    const halfH = (extent * padding) / 2;
    const halfW = halfH * aspect;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;

    // Scale camera zoom to make the 3D voxel board and pieces visibly scale up with board size
    if (this.currentBoardSize === "full") {
      this.camera.zoom = 1.25;
    } else if (this.currentBoardSize === "large") {
      this.camera.zoom = 1.12;
    } else if (this.currentBoardSize === "compact") {
      this.camera.zoom = 0.9;
    } else {
      this.camera.zoom = 1.0;
    }

    this.camera.updateProjectionMatrix();

    this.requestRender();
  }

  cancelAllAnimations(): void {
    this.animEngine.cancelAll();
    this.requestRender();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.background);
    if (this.boardMesh) {
      this.boardMesh.geometry.dispose();
      this.boardMesh.geometry = meshBoard(theme);
    }
    this.pieceManager.setTheme(theme);
    this.overlayManager.setTheme(theme);
    applyThemeToCss(theme);
    this.requestRender();
  }

  async flip(_animated = true): Promise<void> {
    this.boardFlipped = !this.boardFlipped;
    this.requestRender();
  }

  private handlePointerDown(e: PointerEvent): void {
    const sq = raycastToSquare(
      e,
      this.canvas,
      this.camera,
      this.raycaster,
      this.boardFlipped,
    );
    if (sq !== null && this.onSquarePointerDown) {
      this.onSquarePointerDown(sq, e);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    const sq = raycastToSquare(
      e,
      this.canvas,
      this.camera,
      this.raycaster,
      this.boardFlipped,
    );
    if (sq !== null && this.onSquarePointerUp) {
      this.onSquarePointerUp(sq, e);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === "touch") return;
    const sq = raycastToSquare(
      e,
      this.canvas,
      this.camera,
      this.raycaster,
      this.boardFlipped,
    );
    if (sq !== this.hoveredSquare) {
      this.hoveredSquare = sq;
      if (this.onSquareHover) {
        this.onSquareHover(sq);
      }
    }
  }
}
