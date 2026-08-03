import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { DIFFICULTY_LEVELS } from "../core/difficulty";
import { detectCapabilities } from "../engine/capability";

interface DifficultyPickerProps {
  controller: GameController | null;
}

export function DifficultyPicker({ controller }: DifficultyPickerProps) {
  const state = useGameStore();
  const caps = detectCapabilities();

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "var(--sp-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-1)",
      }}
    >
      <div
        style={{
          fontSize: "var(--size-xs)",
          fontFamily: "var(--font-display)",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          marginBottom: "var(--sp-1)",
        }}
      >
        Engine Level
      </div>

      {Object.values(DIFFICULTY_LEVELS).map((lvl) => {
        const disabled = lvl.requiresThreads && !caps.threaded;
        const isSelected = state.difficulty === lvl.id;

        return (
          <button
            key={lvl.id}
            disabled={disabled}
            onClick={() => {
              if (controller && !disabled) {
                controller.startNewGame({ difficulty: lvl.id });
              }
            }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "var(--sp-2)",
              borderRadius: "var(--radius)",
              background: isSelected ? "var(--surface-raised)" : "transparent",
              border: isSelected
                ? "1px solid var(--accent-dim)"
                : "1px solid transparent",
              color: disabled
                ? "var(--text-faint)"
                : isSelected
                  ? "var(--accent-bright)"
                  : "var(--text-dim)",
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <span style={{ fontWeight: isSelected ? "bold" : "normal" }}>
              Level {lvl.id} · {lvl.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-sm)",
                opacity: 0.8,
              }}
            >
              ~{lvl.approxElo} Elo
            </span>
          </button>
        );
      })}

      {!caps.threaded && (
        <div
          style={{
            fontSize: "var(--size-xs)",
            color: "var(--text-faint)",
            marginTop: "var(--sp-2)",
            lineHeight: 1.3,
          }}
        >
          Running in single-thread mode. Levels 7 and 8 need a secure
          connection.
        </div>
      )}
    </div>
  );
}
