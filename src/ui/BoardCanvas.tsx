import { useEffect, useRef } from "react";
import { Renderer } from "../render";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { legalMovesFrom, positionAfter } from "../core/rules";

interface BoardCanvasProps {
  controller: GameController | null;
}

export function BoardCanvas({ controller }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new Renderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.mount();

    const detach = renderer.attach(useGameStore as any);

    renderer.onSquarePointerDown = (square) => {
      if (!controller) return;

      const currentState = useGameStore.getState();
      const currentPos = positionAfter(
        currentState.initialFen,
        currentState.history.slice(0, currentState.cursor).map((h) => h.move),
      );

      if (currentState.selectedSquare === null) {
        const piece = currentPos.board.get(square);
        if (piece && piece.color === currentPos.turn) {
          controller.setSelectedSquare(square);
        }
      } else {
        if (currentState.selectedSquare === square) {
          controller.setSelectedSquare(null);
          return;
        }

        const legals = legalMovesFrom(currentPos, currentState.selectedSquare);
        const targetMove = legals.find((m) => m.to === square);

        if (targetMove) {
          controller.makeMove(targetMove);
          controller.setSelectedSquare(null);
        } else {
          const piece = currentPos.board.get(square);
          if (piece && piece.color === currentPos.turn) {
            controller.setSelectedSquare(square);
          } else {
            controller.setSelectedSquare(null);
          }
        }
      }
    };

    return () => {
      detach();
      renderer.dispose();
    };
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
      </div>
    </div>
  );
}
