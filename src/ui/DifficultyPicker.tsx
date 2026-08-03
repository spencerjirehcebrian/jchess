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
              className={disabled ? "vx-dither" : undefined}
              aria-pressed={isCurrent}
              aria-label={`Level ${lvl.id}, ${lvl.label}, about ${lvl.approxElo} Elo`}
              disabled={disabled}
              onClick={() => {
                if (controller && !disabled) {
                  controller.startNewGame({ difficulty: lvl.id });
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                height: "44px",
                cursor: disabled ? "not-allowed" : "pointer",
                background: disabled
                  ? "transparent"
                  : isFilled
                    ? "var(--voxel-accent-face)"
                    : "var(--voxel-well)",
                boxShadow: disabled
                  ? "inset 0 0 0 1px var(--border)"
                  : isFilled
                    ? "inset 0 2px 0 0 var(--voxel-accent-top)"
                    : "inset 0 2px 0 0 var(--voxel-under)",
                // The chosen rung is the only one that carries the bright
                // edge, so the ladder says both "this hard" and "this one".
                outline: isCurrent
                  ? "2px solid var(--accent-bright)"
                  : undefined,
                outlineOffset: "-2px",
                transition:
                  "background var(--dur-fast) ease, box-shadow var(--dur-fast) ease",
              }}
            />
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
