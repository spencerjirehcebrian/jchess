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
      controller?.clearPremoves();
      controller?.setSelectedSquare(null);
      setPendingPromotion(null);
    };
    canvas.addEventListener("contextmenu", onContextMenu);

    renderer.onSquarePointerDown = (square) => {
      if (!controller) return;

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
      if (
        !controller.makeMove({ from, to, promotion: role })
      ) {
        controller.setSelectedSquare(null);
      }
    },
    [pendingPromotion, controller],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
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
      <div
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
