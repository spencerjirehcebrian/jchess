import { useState } from "react";
import { GameController } from "../store/controller";
import { useGameStore } from "../store";
import { phaseOf } from "../core/types";
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
  span,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** The state key runs the full width of the plate. */
  span?: boolean;
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
        ...(span ? { gridColumn: "1 / -1" } : {}),
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
  const phase = phaseOf(state.status);
  const takebackDisabled = !controller || !controller.canTakeback();

  /*
   * Resigning is irreversible, so it asks twice. A two-press key rather than a
   * dialog: the machine has no other modal surface for a decision this small,
   * and a confirmation that cannot be reached by the keyboard would be worse
   * than none.
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
      {phase === "playing" && (
        <>
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
        </>
      )}

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
        One key, three legends. The bottom of the plate always holds the single
        control that moves the machine between its states — Start game in
        setup, Resign while playing, New game once it is over — full width, so
        it sits in the same place under the hand whichever word it wears.
        Resign and New game can no longer collide: they never exist at once.
      */}
      {phase === "setup" && (
        <Key
          icon="start"
          label="Start game"
          onClick={() => controller?.startGame()}
          disabled={!controller}
          span
        />
      )}

      {phase === "playing" && (
        /*
          The label changes, and so does the accessible name with it — which is
          the point. A player who cannot see the key change colour is told in
          words that the next press is the one that counts.
        */
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
          disabled={!controller}
          span
        />
      )}

      {phase === "finished" && (
        /*
          Back to the setup panel, not straight into another game: the choices
          are shown again, pre-filled, and Start is one press away.
        */
        <Key
          icon="newgame"
          label="New game"
          onClick={() => controller?.returnToSetup()}
          disabled={!controller}
          span
        />
      )}
    </div>
  );
}
