import { useCallback, useEffect, useRef, useState } from "react";
import { Renderer } from "../render";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { legalMovesFrom, positionAfter } from "../core/rules";
import { generatePremoves, hypotheticalPosition } from "../core/premove";
import { Color, Move, Square } from "../core/types";
import { PromotionPicker, PromotionRole } from "./PromotionPicker";

interface BoardCanvasProps {
  controller: GameController | null;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
  anchor: { x: number; y: number };
}

export type PointerTarget =
  | { kind: "none" }
  | { kind: "move"; move: Move }
  | { kind: "promotion" };

/**
 * Decides what a click on `square` means given the candidate moves from the
 * selected square. Several candidates for one destination differ only in
 * promotion piece, so the user must be asked — taking the first would always
 * silently queen.
 */
export function selectPointerTarget(
  candidates: Move[],
  square: Square,
): PointerTarget {
  const targets = candidates.filter((m) => m.to === square);
  if (targets.length === 0) return { kind: "none" };
  if (targets.length > 1 && targets.every((m) => m.promotion)) {
    return { kind: "promotion" };
  }
  return { kind: "move", move: targets[0]! };
}

export function BoardCanvas({ controller }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new Renderer(canvas);
    rendererRef.current = renderer;
    renderer.mount();

    const detach = renderer.attach(useGameStore as any);

    if (controller) {
      controller.onPremoveFailed = (squares) => renderer.flashSquares(squares);
    }

    // Right-click clears the premove queue and is otherwise suppressed on the
    // canvas (docs/08-input.md).
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      renderer.abortDrag();
      controller?.clearPremoves();
      controller?.setSelectedSquare(null);
      setPendingPromotion(null);
    };
    canvas.addEventListener("contextmenu", onContextMenu);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") renderer.abortDrag();
    };
    window.addEventListener("keydown", onKeyDown);

    /**
     * Everything a pointer interaction needs to know about the position right
     * now. Both the click path and the drag path read from this, so premove
     * mode and the never-silently-queen rule hold identically for each.
     */
    const readContext = () => {
      const currentState = useGameStore.getState();
      const currentPos = positionAfter(
        currentState.initialFen,
        currentState.history.slice(0, currentState.cursor).map((h) => h.move),
      );

      // While the engine is thinking the side to move is the engine's, so
      // selection and move generation key off the human's colour instead —
      // otherwise premoves are unreachable with the pointer.
      const inPremoveMode =
        currentState.status.kind === "engine-thinking" ||
        currentState.status.kind === "engine-delaying";
      const movingColor = inPremoveMode
        ? currentState.humanColor
        : currentPos.turn;
      const premoveBase = inPremoveMode
        ? hypotheticalPosition(currentPos, currentState.premoves)
        : currentPos;

      const isOwnPiece = (sq: Square) => {
        const piece = premoveBase.board.get(sq);
        return !!piece && piece.color === movingColor;
      };

      const candidatesFrom = (from: Square): Move[] =>
        inPremoveMode
          ? generatePremoves(premoveBase, from)
          : legalMovesFrom(currentPos, from);

      return {
        currentState,
        movingColor,
        inPremoveMode,
        isOwnPiece,
        candidatesFrom,
      };
    };

    // A square holding one of your own pieces can only ever be a selection,
    // never a destination, so arming a drag from it can never race the click.
    renderer.canDragFrom = (square) => {
      if (!controller) return false;
      return readContext().isOwnPiece(square);
    };

    renderer.isDropTarget = (from, to) => {
      if (!controller) return false;
      return readContext()
        .candidatesFrom(from)
        .some((m) => m.to === to);
    };

    renderer.onDrop = (from, to) => {
      if (!controller) return "returned";

      const { movingColor, inPremoveMode, candidatesFrom } = readContext();
      const target = selectPointerTarget(candidatesFrom(from), to);

      if (target.kind === "promotion") {
        setPendingPromotion({
          from,
          to,
          color: movingColor,
          anchor: renderer.squareToScreen(to),
        });
        // The piece stays in the air over the square while the picker is open,
        // so choosing finishes the motion the hand started instead of sending
        // it home and flying it back out.
        return "pending";
      }

      if (target.kind === "none") return "returned";
      if (!controller.makeMove(target.move)) return "returned";

      // A premove is accepted without changing the board, so the piece belongs
      // back where the position still has it — and nothing is landing yet.
      return inPremoveMode ? "returned" : "moved";
    };

    // Picking a piece up selects it, so the destination dots are lit while you
    // aim. Without this, dragging a piece that was already selected would clear
    // the selection on the way down and drop the dots mid-drag.
    renderer.onDragStateChange = (from) => {
      if (from !== null) controller?.setSelectedSquare(from);
    };

    // The only cue that a piece can be picked up at all.
    renderer.onSquareHover = (square) => {
      const grabbable =
        !!controller && square !== null && readContext().isOwnPiece(square);
      canvas.style.cursor = grabbable ? "grab" : "";
    };

    renderer.onSquarePointerDown = (square) => {
      if (!controller) return;

      const { currentState, movingColor, isOwnPiece, candidatesFrom } =
        readContext();

      if (currentState.selectedSquare === null) {
        if (isOwnPiece(square)) {
          controller.setSelectedSquare(square);
        }
        return;
      }

      if (currentState.selectedSquare === square) {
        controller.setSelectedSquare(null);
        return;
      }

      const from = currentState.selectedSquare;
      const target = selectPointerTarget(candidatesFrom(from), square);

      if (target.kind === "none") {
        if (isOwnPiece(square)) {
          controller.setSelectedSquare(square);
        } else {
          controller.setSelectedSquare(null);
        }
        return;
      }

      if (target.kind === "promotion") {
        setPendingPromotion({
          from,
          to: square,
          color: movingColor,
          anchor: renderer.squareToScreen(square),
        });
        return;
      }

      // makeMove clears the selection itself on success; only a rejected move
      // needs an extra store write.
      if (!controller.makeMove(target.move)) {
        controller.setSelectedSquare(null);
      }
    };

    return () => {
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      if (controller?.onPremoveFailed) controller.onPremoveFailed = null;
      detach();
      renderer.dispose();
    };
  }, [controller]);

  const commitPromotion = useCallback(
    (role: PromotionRole) => {
      if (!pendingPromotion || !controller) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);

      // Routed through the renderer so that a piece still held in the air over
      // the square lands as the promoted piece, rather than being sent home
      // and flown back out. Plain clicks have no held piece and pass straight
      // through.
      const renderer = rendererRef.current;
      const commit = () => controller.makeMove({ from, to, promotion: role });

      if (renderer) renderer.resolvePendingDrop(commit);
      else if (!commit()) controller.setSelectedSquare(null);
    },
    [pendingPromotion, controller],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    rendererRef.current?.cancelPendingDrop();
    controller?.setSelectedSquare(null);
  }, [controller]);

  const boardSize = useGameStore((s) => s.boardSize) ?? "full";
  const maxSize =
    boardSize === "full"
      ? "100%"
      : boardSize === "large"
        ? "90%"
        : boardSize === "compact"
          ? "60%"
          : "75%";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/*
        The aperture the board is set into. Drawn as a ::after on this element
        rather than as a wrapper of its own: the board-size spec reads
        `max-width` off the canvas's immediate parent, so an extra node here
        would silently break it while looking harmless.
      */}
      <div
        className="app-board-aperture"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: maxSize,
          maxHeight: maxSize,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transition: "max-width var(--dur-base) ease-in-out, max-height var(--dur-base) ease-in-out",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Chess board view"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
        {pendingPromotion && (
          <PromotionPicker
            color={pendingPromotion.color}
            anchor={pendingPromotion.anchor}
            onSelect={commitPromotion}
            onCancel={cancelPromotion}
          />
        )}
      </div>
    </div>
  );
}
