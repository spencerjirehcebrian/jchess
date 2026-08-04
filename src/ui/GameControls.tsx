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
    /*
      A keypad, not a button group. The keys and the deck are one shot of
      plastic and therefore one colour, so what separates a key from the panel
      is not a difference in value — it is the dark moulded gap the keys sit in.
      That gap is also what carries the 3:1 non-text contrast floor, which no
      amount of tinting the deck could do without dragging the inks under 4.5:1.
     */
    <div
      className="vx-keyplate"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
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

      {/*
        Not the primary. New game discards the game in progress, and dressing
        the most destructive control as the loudest thing in the rail pointed
        attention away from the board. Gold now marks only where the game is:
        the chosen rung on the ladder, and a matched move in the notation field.
      */}
      <button className="vx-button" onClick={() => controller?.startNewGame()}>
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
