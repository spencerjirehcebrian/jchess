import { GameController } from "../store/controller";
import { useGameStore } from "../store";

interface GameControlsProps {
  controller: GameController | null;
  onOpenSettings?: () => void;
}

export function GameControls({
  controller,
  onOpenSettings,
}: GameControlsProps) {
  // Subscribe so the takeback button re-evaluates as the game progresses.
  useGameStore();
  const takebackDisabled = !controller || !controller.canTakeback();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--sp-2)",
      }}
    >
      <button
        className="vx-button"
        onClick={() => controller?.takeback()}
        disabled={takebackDisabled}
      >
        Take back
      </button>

      <button className="vx-button" onClick={() => controller?.flipBoard()}>
        Flip board
      </button>

      <button
        className="vx-button"
        data-variant="primary"
        onClick={() => controller?.startNewGame()}
      >
        New game
      </button>

      {onOpenSettings && (
        <button className="vx-button" onClick={onOpenSettings}>
          Settings
        </button>
      )}
    </div>
  );
}
