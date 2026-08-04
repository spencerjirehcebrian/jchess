import { useState } from "react";
import { GameController } from "../store/controller";
import { useGameStore } from "../store";
import { IconName } from "../render/voxel/icons";
import { KeyIcon } from "./KeyIcon";

interface GameControlsProps {
  controller: GameController | null;
  onOpenSettings?: () => void;
}

/**
 * One key. The icon leads and the word follows, which is the order a keycap is
 * read in and the order that keeps the accessible name to the word alone.
 */
function Key({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="vx-button"
      onClick={onClick}
      {...(disabled === undefined ? {} : { disabled })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "var(--sp-2)",
        // 1px, not the 2px the bare legends carry. A key is now an icon, a gap
        // and a word inside a column the rail can squeeze to 155px, and the
        // tracking is the only part of that budget worth giving back.
        letterSpacing: "1px",
      }}
    >
      <KeyIcon name={icon} />
      {label}
    </button>
  );
}

export function GameControls({
  controller,
  onOpenSettings,
}: GameControlsProps) {
  // Subscribe so the takeback button re-evaluates as the game progresses.
  const state = useGameStore();
  const takebackDisabled = !controller || !controller.canTakeback();
  const isPlaying =
    state.status.kind !== "over" && state.status.kind !== "error";

  /*
   * Resigning is irreversible and sits next to the key that starts a new game,
   * so it asks twice. A two-press key rather than a dialog: the machine has no
   * other modal surface for a decision this small, and a confirmation that
   * cannot be reached by the keyboard would be worse than none.
   *
   * It does not revert on a timer. A key that quietly disarms after three
   * seconds is a race against anyone reading slowly, or listening.
   */
  const [confirmingResign, setConfirmingResign] = useState(false);
  const disarm = () => setConfirmingResign(false);

  return (
    /*
      A keypad, not a button group. The keys and the deck are one shot of
      plastic and therefore one colour, so what separates a key from the panel
      is not a difference in value — it is the dark moulded gap the keys sit in.
      That gap is also what carries the 3:1 non-text contrast floor, which no
      amount of tinting the deck could do without dragging the inks under 4.5:1.

      Grouped by what the keys do rather than by how often they are pressed:
      help with the move in hand, then how the game is shown, then the two ways
      to end it.
     */
    <div
      className="vx-keyplate"
      style={{
        display: "grid",
        /*
         * minmax(0, 1fr), not 1fr. A bare `1fr` is `minmax(auto, 1fr)`, so the
         * longest legend in a column sets that column's width — which made the
         * keys two different sizes, and made the whole keypad reflow under the
         * pointer the moment the resign key changed its word. Keys on a moulded
         * keypad are the same size as each other and stay where they are put.
         */
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      }}
      onBlur={(e) => {
        // Leaving the keypad disarms it, so a half-pressed resign is never
        // waiting to be completed by an unrelated click later on.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) disarm();
      }}
    >
      <Key
        icon="takeback"
        label="Take back"
        onClick={() => {
          disarm();
          controller?.takeback();
        }}
        disabled={takebackDisabled}
      />

      <Key
        icon="hint"
        label="Hint"
        onClick={() => {
          disarm();
          void controller?.hint();
        }}
        disabled={!controller || state.status.kind !== "human-turn"}
      />

      <Key
        icon="flip"
        label="Flip board"
        onClick={() => {
          disarm();
          controller?.flipBoard();
        }}
      />

      {onOpenSettings && (
        <Key
          icon="settings"
          label="Settings"
          onClick={() => {
            disarm();
            onOpenSettings();
          }}
        />
      )}

      {/*
        The label changes, and so does the accessible name with it — which is
        the point. A player who cannot see the key change colour is told in
        words that the next press is the one that counts.

        A question mark rather than the word "confirm": every key has to fit the
        same column as "Flip board", and the armed state must not be the widest
        thing on the plate or it is the one label that cannot be shown.
      */}
      <Key
        icon="resign"
        label={confirmingResign ? "Resign?" : "Resign"}
        onClick={() => {
          if (!confirmingResign) {
            setConfirmingResign(true);
            return;
          }
          setConfirmingResign(false);
          controller?.resign();
        }}
        disabled={!controller || !isPlaying}
      />

      {/*
        Not the primary. New game discards the game in progress, and dressing
        the most destructive control as the loudest thing in the rail pointed
        attention away from the board. Gold now marks only where the game is:
        the chosen rung on the ladder, and a matched move in the notation field.
      */}
      <Key
        icon="newgame"
        label="New game"
        onClick={() => {
          disarm();
          controller?.startNewGame();
        }}
      />
    </div>
  );
}
