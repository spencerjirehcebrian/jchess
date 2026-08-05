import * as THREE from "three";
import { Theme, THEMES, applyThemeToCss } from "./voxel/palette";
import { createScene, createBackground } from "./scene";
import { meshBoard } from "./voxel/mesher";
import { PieceManager } from "./pieces";
import { OverlayManager } from "./overlay";
import { raycastToBoard, raycastToSquare, squareToWorld } from "./picking";
import {
  PieceDragController,
  dragThresholdFor,
  DROP_QUIET_MS,
  DROP_CAPTURE_MS,
} from "./drag";
import { AnimationEngine, PieceAnimTarget } from "./animation/engine";
import { Square } from "../core/types";
import { Store } from "../store";
import { positionAfter, legalMovesFrom } from "../core/rules";
import { premoveDestinations, hypotheticalPosition } from "../core/premove";

/**
 * What a released piece should do next.
 *
 * "The move was accepted" and "the board changed" are different questions: a
 * premove is accepted and queued without moving anything, so the piece has to
 * go back where the position still says it is.
 */
export type DropOutcome =
  /** The position changed. Land on the destination. */
  | "moved"
  /** Waiting on the promotion picker. Stay where the hand let go. */
  | "pending"
  /** Refused, or queued as a premove. Fall back onto the origin square. */
  | "returned";

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
  private dragController = new PieceDragController();
  private raycaster = new THREE.Raycaster();

  private dirty = true;
  private rafHandle: number | null = null;
  private resizeRafHandle: number | null = null;
  private boardFlipped = false;
  /** Which orientation the coordinates currently baked into the mesh read for. */
  private meshedFlipped = false;
  private resizeObserver: ResizeObserver | null = null;
  private hoveredSquare: Square | null = null;
  private currentBoardSize: string = "full";

  // A press becomes a drag only after it travels; below the threshold it falls
  // through untouched to the click-to-select path.
  private pressSquare: Square | null = null;
  private pressClient: { x: number; y: number } | null = null;
  private pressPointerId: number | null = null;
  private pressCanDrag = false;
  private lastDragMoveTime = 0;
  private lastFrameTime = 0;

  /**
   * The pose a dragged piece was released at, held until the move it produced
   * comes back through the store. Flying that piece from its origin would
   * rewind the drag the player just finished, so it falls from here instead.
   *
   * Also survives an open promotion picker, which is why it is a pose rather
   * than a flag: the piece hangs where it was dropped until the choice is made.
   */
  private pendingDrop: {
    from: Square;
    to: Square;
    pose: { world: THREE.Vector3; y: number; tilt: { x: number; z: number } };
  } | null = null;

  public onSquarePointerDown?: (square: Square, event: PointerEvent) => void;
  public onSquarePointerUp?: (square: Square, event: PointerEvent) => void;
  public onSquareHover?: (square: Square | null) => void;

  /** Answers whether the square holds a piece this player may pick up. */
  public canDragFrom?: (square: Square) => boolean;
  /** Answers whether dropping on `to` would be a move. */
  public isDropTarget?: (from: Square, to: Square) => boolean;
  /** Commits the drop. See {@link DropOutcome}. */
  public onDrop?: (from: Square, to: Square) => DropOutcome;
  public onDragStateChange?: (from: Square | null) => void;

  constructor(canvas: HTMLCanvasElement, theme?: Theme) {
    this.canvas = canvas;
    this.theme = theme ?? THEMES.lacquer!;

    try {
      this.webglRenderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.webglRenderer.shadowMap.enabled = true;
      this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    const { scene, camera, boardMesh, boardContainerGroup } = createScene(
      this.theme,
    );
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
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
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
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);

    // A test seam, dev builds only. Board squares exist in a WebGL scene, so a
    // browser test has no element to aim at and no way to derive one without
    // reimplementing the projection. Exposing the projection the renderer
    // already computes keeps `tests/e2e/touch-drag.spec.ts` exact instead of
    // approximate, and it disappears from production bundles.
    if (import.meta.env.DEV) {
      (this.canvas as HTMLCanvasElement & { __squareToScreen?: unknown })
        .__squareToScreen = (square: Square) => this.squareToScreen(square);
    }

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
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);

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
    // The store notifies on every field, but only these affect what is on the
    // board. Rebuilding (and cancelling animations) on unrelated writes killed
    // every human move's animation and replayed the whole game each time.
    let prevRenderKey = "";
    let cachedPos: ReturnType<typeof positionAfter> | null = null;

    const updateFromStore = (stateArg?: any) => {
      const state = stateArg && "history" in stateArg ? stateArg : getState();
      if (!state || !state.history) return;

      if (
        state.theme &&
        THEMES[state.theme] &&
        THEMES[state.theme]!.id !== this.theme.id
      ) {
        this.setTheme(THEMES[state.theme]!);
      }

      this.boardFlipped = !!state.boardFlipped;
      this.applyBoardOrientation();

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

      const renderKey = `${currentCursor}:${currentHistoryLength}:${state.initialFen}:${this.boardFlipped}`;
      const positionChanged = renderKey !== prevRenderKey;
      prevRenderKey = renderKey;

      if (positionChanged || cachedPos === null) {
        cachedPos = positionAfter(
          state.initialFen,
          historyToRender.map((h: any) => h.move),
        );
      }
      const currentPos = cachedPos;

      const isLiveSingleMove =
        prevCursor >= 0 &&
        currentCursor === currentHistoryLength &&
        currentCursor === prevCursor + 1 &&
        historyToRender.length > 0;

      // A drop pose only ever belongs to the move that drop produced. Anything
      // else reaching the board first — an engine reply, a takeback, a premove
      // drain — discards it, so a dropped piece's landing can never be grafted
      // onto somebody else's move.
      if (positionChanged && this.pendingDrop) {
        const last = historyToRender[historyToRender.length - 1];
        const isOurs =
          isLiveSingleMove &&
          last &&
          last.move.from === this.pendingDrop.from &&
          last.move.to === this.pendingDrop.to;
        if (!isOurs) this.pendingDrop = null;
      }

      if (!positionChanged) {
        // Overlay-only update: leave any in-flight animation alone.
      } else if (isLiveSingleMove) {
        const lastEntry = historyToRender[historyToRender.length - 1];
        const lastMove = lastEntry.move;
        const prevHistory = historyToRender.slice(
          0,
          historyToRender.length - 1,
        );
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
          capturedSquare =
            Math.floor(lastMove.from / 8) * 8 + (lastMove.to % 8);
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

        // Settle the previous move before touching the board, so its captured
        // piece is discarded and every mesh is back at rest. Cancelling after
        // the fact used to leave a half-tumbled mesh in play.
        this.animEngine.cancelAll();

        const applied = this.pieceManager.applyMove({
          from: lastMove.from,
          to: lastMove.to,
          promotion: lastMove.promotion,
          capturedSquare: capturedSquare ?? undefined,
          rookFrom,
          rookTo,
        });

        if (applied) {
          const { moved, captured, rook } = applied;

          // If this is the move the player just dropped, it does not fly — it
          // falls the last stretch from the hand and lands. Everything after
          // touchdown is identical either way, which is the whole point of
          // sharing this path: a capture you made yourself still shatters.
          const drop =
            this.pendingDrop &&
            this.pendingDrop.from === lastMove.from &&
            this.pendingDrop.to === lastMove.to
              ? this.pendingDrop
              : null;
          this.pendingDrop = null;

          const animTarget: PieceAnimTarget = {
            mesh: moved.mesh,
            shadowQuad: moved.shadowQuad,
            fromSquare: lastMove.from,
            toSquare: lastMove.to,
            durationMs: drop
              ? captured
                ? DROP_CAPTURE_MS
                : DROP_QUIET_MS
              : 220,
            isKnight,
            isCapture: !!captured,
            isCastle,
            isPromotion: !!lastMove.promotion,
            ...(drop
              ? {
                  arrival: {
                    startWorld: drop.pose.world,
                    startY: drop.pose.y,
                    startTilt: drop.pose.tilt,
                  },
                }
              : {}),
          };

          if (captured) {
            animTarget.capturedMesh = captured.mesh;
            animTarget.capturedShadowQuad = captured.shadowQuad;
            animTarget.capturedRole = captured.role;
            animTarget.capturedColor = captured.color;
            animTarget.palette =
              captured.color === "white" ? this.theme.white : this.theme.black;
            animTarget.impactRing = this.overlayManager.impactRingMesh;
          }

          if (rook && rookFrom !== undefined && rookTo !== undefined) {
            animTarget.rookMesh = rook.mesh;
            animTarget.rookShadowQuad = rook.shadowQuad;
            animTarget.rookFromSquare = rookFrom;
            animTarget.rookToSquare = rookTo;
          }

          this.animEngine.animateMove(animTarget, this.boardFlipped, () => {
            if (captured) this.pieceManager.discardSettling(captured);
          });
        } else {
          // No mesh on the from-square: the board and the position have drifted
          // apart, so rebuild rather than guess.
          this.pieceManager.syncPosition(currentPos, this.boardFlipped);
        }
      } else {
        this.animEngine.cancelAll();
        this.pieceManager.syncPosition(currentPos, this.boardFlipped);
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

      const inPremoveMode =
        state.status?.kind === "engine-thinking" ||
        state.status?.kind === "engine-delaying";

      if (state.selectedSquare !== null) {
        // While the engine is thinking the board shows relaxed premove
        // destinations, not legal moves for the side to move (the engine).
        const dests = inPremoveMode
          ? premoveDestinations(
              hypotheticalPosition(currentPos, state.premoves ?? []),
              state.selectedSquare,
            )
          : legalMovesFrom(currentPos, state.selectedSquare).map((m) => m.to);
        this.overlayManager.setLegalMoveDots(
          dests,
          this.boardFlipped,
          inPremoveMode ? "premove" : "legal",
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
    // update() steps the physics with the real frame dt; getBoardTransform()
    // is a pure read of that step's result. Calling both used to integrate the
    // spring twice per frame, the second time with a hard-coded 16.67ms dt.
    const isAnimating = this.animEngine.update(t);
    const physics = this.animEngine.getBoardTransform();

    const dragDt = (t - this.lastFrameTime) / 1000;
    this.lastFrameTime = t;
    const isSwinging = this.dragController.update(dragDt);

    this.boardContainerGroup.position.copy(physics.positionOffset);
    this.boardContainerGroup.rotation.copy(physics.rotationOffset);

    if (this.dirty || isAnimating || physics.isActive || isSwinging) {
      this.webglRenderer.render(this.scene, this.camera);
      this.dirty = false;
    }

    if (isAnimating || physics.isActive || isSwinging) {
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

  /**
   * Canvas-relative pixel position of a square's centre, for anchoring DOM
   * overlays (the promotion picker) to the board.
   */
  squareToScreen(square: Square): { x: number; y: number } {
    const world = squareToWorld(square, this.boardFlipped);
    const vec = new THREE.Vector3(world.x, 0, world.z);
    vec.add(this.boardContainerGroup.position);
    vec.project(this.camera);

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth;
    const height = rect.height || this.canvas.clientHeight;
    return {
      x: ((vec.x + 1) / 2) * width,
      y: ((1 - vec.y) / 2) * height,
    };
  }

  /** Briefly highlights squares in the error hue (failed premove drain). */
  flashSquares(squares: Square[], durationMs = 300) {
    this.overlayManager.flashSquares(
      squares,
      this.boardFlipped,
      durationMs,
      () => this.requestRender(),
    );
  }

  cancelAllAnimations(): void {
    this.animEngine.cancelAll();
    this.requestRender();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    const previousBackground = this.scene.background;
    this.scene.background = createBackground(theme);
    if (previousBackground instanceof THREE.Texture) {
      previousBackground.dispose();
    }
    if (this.boardMesh) {
      this.boardMesh.geometry.dispose();
      this.boardMesh.geometry = meshBoard(theme, this.boardFlipped);
    }
    this.pieceManager.setTheme(theme);
    this.overlayManager.setTheme(theme);
    applyThemeToCss(theme);
    this.requestRender();
  }

  async flip(_animated = true): Promise<void> {
    this.boardFlipped = !this.boardFlipped;
    this.applyBoardOrientation();
    this.requestRender();
  }

  /**
   * Pieces are remapped square-by-square when the board flips. The frame's
   * engraved coordinates are baked into the mesh, so the mesh is re-stamped for
   * the new orientation rather than turned — turning it would print every
   * letter and number upside down under a camera that never orbits.
   *
   * The store calls this on every update, so the re-mesh is gated on the
   * orientation actually having changed.
   */
  private applyBoardOrientation(): void {
    if (!this.boardMesh || this.meshedFlipped === this.boardFlipped) return;
    this.meshedFlipped = this.boardFlipped;
    this.boardMesh.geometry.dispose();
    this.boardMesh.geometry = meshBoard(this.theme, this.boardFlipped);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== undefined && e.button !== 0) return;

    const sq = raycastToSquare(
      e,
      this.canvas,
      this.camera,
      this.raycaster,
      this.boardFlipped,
    );
    if (sq === null) return;

    // Asked before the click is handled. A square holding your own piece can
    // only ever be a selection, never a destination — castling is encoded as
    // the king's own destination square, so a click on your rook is not a move.
    this.pressCanDrag = this.canDragFrom ? this.canDragFrom(sq) : false;
    this.pressSquare = sq;
    this.pressClient = { x: e.clientX, y: e.clientY };
    this.pressPointerId = e.pointerId;

    if (this.pressCanDrag) {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a convenience; without it the drag simply ends at the
        // canvas edge.
      }
    }

    if (this.onSquarePointerDown) {
      this.onSquarePointerDown(sq, e);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.dragController.isDragging()) {
      const to = raycastToSquare(
        e,
        this.canvas,
        this.camera,
        this.raycaster,
        this.boardFlipped,
      );
      this.finishDrag(to);
      this.clearPress(e);
      return;
    }

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
    this.clearPress(e);
  }

  private handlePointerCancel(e: PointerEvent): void {
    if (this.dragController.isDragging()) this.cancelDrag();
    this.clearPress(e);
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.dragController.isDragging()) {
      this.updateDrag(e);
      return;
    }

    if (
      this.pressCanDrag &&
      this.pressSquare !== null &&
      this.pressClient !== null &&
      (this.pressPointerId === null || e.pointerId === this.pressPointerId)
    ) {
      const dx = e.clientX - this.pressClient.x;
      const dy = e.clientY - this.pressClient.y;
      if (Math.hypot(dx, dy) >= dragThresholdFor(e.pointerType)) {
        this.beginDrag(this.pressSquare, e);
        return;
      }
    }

    // Hover is a pointing-device affordance; a finger has no hover state.
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

  private clearPress(e?: PointerEvent): void {
    if (e && this.pressPointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Already released, or the browser dropped the capture for us.
      }
    }
    this.pressSquare = null;
    this.pressClient = null;
    this.pressPointerId = null;
    this.pressCanDrag = false;
  }

  private beginDrag(from: Square, e: PointerEvent): void {
    const piece = this.pieceManager.getPieceAt(from);
    const world = raycastToBoard(e, this.canvas, this.camera, this.raycaster);
    if (!piece || !world) return;

    // A piece in the player's hand is not the animation's to move.
    this.animEngine.cancelAll();
    this.pieceManager.holdPiece(from);
    this.dragController.begin(piece, from, world, e.pointerType);
    this.lastDragMoveTime = performance.now();

    this.canvas.style.cursor = "grabbing";
    // The origin is not somewhere you can land, so it starts unmarked; the
    // selection wash under the piece already says where it came from.
    this.overlayManager.setHoverSquare(null, this.boardFlipped);
    this.onDragStateChange?.(from);
    this.requestRender();
  }

  private updateDrag(e: PointerEvent): void {
    const world = raycastToBoard(e, this.canvas, this.camera, this.raycaster);
    if (!world) return;

    const now = performance.now();
    this.dragController.moveTo(world, (now - this.lastDragMoveTime) / 1000);
    this.lastDragMoveTime = now;

    // The square under the cursor is the drop target, not the square under the
    // lifted piece — the piece hangs above and behind where you are pointing.
    // Only a square you could actually land on is marked, so the outline is an
    // answer rather than a cursor readout (docs/08-input.md).
    const from = this.dragController.getFromSquare();
    const target = raycastToSquare(
      e,
      this.canvas,
      this.camera,
      this.raycaster,
      this.boardFlipped,
    );
    const legal =
      target !== null &&
      from !== null &&
      (this.isDropTarget?.(from, target) ?? true);
    this.overlayManager.setHoverSquare(legal ? target : null, this.boardFlipped);
    this.requestRender();
  }

  private finishDrag(to: Square | null): void {
    const pose = this.dragController.getPose();
    const held = this.dragController.end();
    this.canvas.style.cursor = "";
    this.overlayManager.setHoverSquare(null, this.boardFlipped);

    if (!held) return;

    // Armed before the drop resolves: makeMove writes to the store
    // synchronously, so the position update can come back inside this call and
    // must already be able to see where the piece was let go.
    this.pendingDrop = { from: held.from, to: to ?? held.from, pose };

    const outcome =
      to !== null && to !== held.from
        ? (this.onDrop?.(held.from, to) ?? "returned")
        : "returned";

    // The hand is off the piece either way; the animation owns it from here.
    // releasePiece() would settle it flat, which is the teleport this replaces.
    this.pieceManager.holdPiece(null);

    if (outcome === "returned") this.returnDroppedPiece();
    // "pending" leaves the piece hanging where it was released, and the pose
    // armed, until the promotion picker resolves.

    this.onDragStateChange?.(null);
    this.requestRender();
  }

  /**
   * Falls the released piece back onto the square it came from. Same machinery
   * as landing on a destination — the destination is just the origin — but
   * flagged `isReturn`, so the board stays still. Nothing was played.
   */
  private returnDroppedPiece(): void {
    const pending = this.pendingDrop;
    this.pendingDrop = null;
    if (!pending) return;

    const piece = this.pieceManager.getPieceAt(pending.from);
    if (!piece) return;

    this.animEngine.animateMove(
      {
        mesh: piece.mesh,
        shadowQuad: piece.shadowQuad,
        fromSquare: pending.from,
        toSquare: pending.from,
        durationMs: DROP_QUIET_MS,
        isReturn: true,
        arrival: {
          startWorld: pending.pose.world,
          startY: pending.pose.y,
          startTilt: pending.pose.tilt,
        },
      },
      this.boardFlipped,
    );
    this.requestRender();
  }

  /**
   * Resolves a drop that was waiting on the promotion picker. `commit` reports
   * whether it changed the position; if it did not, the piece goes home.
   */
  public resolvePendingDrop(commit: () => boolean): void {
    if (!this.pendingDrop) {
      commit();
      return;
    }
    const pending = this.pendingDrop;
    if (!commit()) {
      this.pendingDrop = pending;
      this.returnDroppedPiece();
    }
  }

  /** Abandons a drop waiting on the picker; the piece falls back home. */
  public cancelPendingDrop(): void {
    this.returnDroppedPiece();
  }

  private cancelDrag(): void {
    if (!this.dragController.isDragging()) return;
    const pose = this.dragController.getPose();
    const held = this.dragController.end();
    this.canvas.style.cursor = "";
    this.overlayManager.setHoverSquare(null, this.boardFlipped);
    this.pieceManager.holdPiece(null);
    if (held) {
      this.pendingDrop = { from: held.from, to: held.from, pose };
      this.returnDroppedPiece();
    }
    this.onDragStateChange?.(null);
    this.requestRender();
  }

  /** Aborts a drag in progress; used by Escape and by right-click. */
  public abortDrag(): void {
    this.cancelDrag();
    this.clearPress();
  }
}
