import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { DIFFICULTY_LEVELS } from "../core/difficulty";
import { detectCapabilities } from "../engine/capability";

interface DifficultyPickerProps {
  controller: GameController | null;
}

/**
 * Eight rungs, drawn as a ladder. A select implies a list of unrelated
 * options and a slider implies a continuum; the ladder is what this actually
 * is — eight discrete, deliberately tuned configurations that get harder from
 * left to right, so the control fills the way strength does.
 *
 * Levels that need threads stay visible when unavailable. Hiding a capability
 * a user cannot reach is worse than explaining why it is out of reach.
 */
export function DifficultyPicker({ controller }: DifficultyPickerProps) {
  const difficulty = useGameStore((s) => s.difficulty);
  const caps = detectCapabilities();
  const levels = Object.values(DIFFICULTY_LEVELS);
  const current = DIFFICULTY_LEVELS[difficulty];

  return (
    <div
      style={{
        padding: "var(--sp-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--sp-3)",
        }}
      >
        <span className="vx-label">Level</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-sm)",
            color: "var(--text)",
          }}
        >
          {difficulty} · {current?.label}
        </span>
      </div>

      <div
        role="group"
        aria-label="Engine level"
        style={{ display: "flex", gap: "2px" }}
      >
        {levels.map((lvl) => {
          const disabled = lvl.requiresThreads && !caps.threaded;
          const isCurrent = lvl.id === difficulty;
          const isFilled = lvl.id <= difficulty;

          return (
            <button
              key={lvl.id}
              className="vx-rung-hit"
              aria-pressed={isCurrent}
              aria-label={`Level ${lvl.id}, ${lvl.label}, about ${lvl.approxElo} Elo`}
              disabled={disabled}
              onClick={() => {
                if (controller && !disabled) {
                  controller.startNewGame({ difficulty: lvl.id });
                }
              }}
            >
              <span
                className={disabled ? "vx-rung vx-dither" : "vx-rung"}
                data-filled={!disabled && isFilled}
                data-current={isCurrent}
                data-available={!disabled}
              />
            </button>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-xs)",
          color: "var(--text-faint)",
          lineHeight: 1.4,
        }}
      >
        ~{current?.approxElo} Elo
        {!caps.threaded && (
          <>
            {" · "}
            Levels 7 and 8 need a secure connection
          </>
        )}
      </div>
    </div>
  );
}
