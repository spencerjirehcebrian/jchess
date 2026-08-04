import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { ColorChoice } from "../core/types";
import { DEFAULT_TIME_CONTROL_ID, TIME_CONTROLS } from "../core/clock";
import { DifficultyPicker } from "./DifficultyPicker";

interface SetupPanelProps {
  controller: GameController | null;
}

const COLOR_CHOICES: { id: ColorChoice; label: string }[] = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "random", label: "Random" },
];

/**
 * The rail before there is a game: the transcript's slot holds the choices
 * instead of the record. Strength, time and colour are set here and consumed
 * by the Start key; the panel disappears the moment the game exists, and it
 * comes back pre-filled when a finished game is put away.
 */
export function SetupPanel({ controller }: SetupPanelProps) {
  const timeControlId = useGameStore(
    (s) => s.timeControlId ?? DEFAULT_TIME_CONTROL_ID,
  );
  const colorChoice = useGameStore((s) => s.colorChoice);

  const optionStyle: React.CSSProperties = {
    background: "var(--surface-raised)",
    color: "var(--text)",
  };

  return (
    <div
      className="app-setup-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-4)",
        padding: "var(--sp-3)",
        overflowY: "auto",
      }}
    >
      <div
        className="vx-label"
        style={{ paddingBottom: "var(--sp-1)" }}
      >
        New game
      </div>

      <DifficultyPicker controller={controller} />

      <div>
        <label
          className="vx-label"
          htmlFor="setup-time-control"
          style={{ display: "block", marginBottom: "var(--sp-2)" }}
        >
          Time control
        </label>
        <select
          className="vx-select"
          id="setup-time-control"
          value={timeControlId}
          onChange={(e) => controller?.setTimeControl(e.target.value)}
        >
          {TIME_CONTROLS.map((tc) => (
            <option key={tc.id} value={tc.id} style={optionStyle}>
              {tc.label}
              {tc.id === DEFAULT_TIME_CONTROL_ID ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span
          className="vx-label"
          id="setup-color-label"
          style={{ display: "block", marginBottom: "var(--sp-2)" }}
        >
          Play as
        </span>
        {/*
          Three keys, one pressed. Picking a side turns the board around on the
          spot — the preview is the feedback — and Random keeps the board
          white-side-down so the coin flip stays a coin flip until Start.
        */}
        <div
          role="group"
          aria-labelledby="setup-color-label"
          style={{ display: "flex", gap: "2px" }}
        >
          {COLOR_CHOICES.map((c) => (
            <button
              key={c.id}
              className="vx-button"
              aria-pressed={colorChoice === c.id}
              onClick={() => controller?.setColorChoice(c.id)}
              style={{
                flex: 1,
                letterSpacing: "1px",
                ...(colorChoice === c.id
                  ? {
                      boxShadow:
                        "inset 0 0 0 2px var(--accent), var(--vx-recess-shadow)",
                      color: "var(--accent-bright)",
                    }
                  : {}),
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
