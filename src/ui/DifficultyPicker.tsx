import { useState } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "var(--sp-2) var(--sp-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <label
          htmlFor="engine-level-select"
          style={{
            fontSize: "var(--size-xs)",
            fontFamily: "var(--font-display)",
            color: "var(--text-faint)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Engine Level
        </label>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            fontSize: "var(--size-xs)",
            color: "var(--text-dim)",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          {isExpanded ? "Collapse ▲" : "All levels ▼"}
        </button>
      </div>

      <select
        id="engine-level-select"
        value={state.difficulty}
        onChange={(e) => {
          const lvlId = parseInt(e.target.value, 10);
          if (controller && DIFFICULTY_LEVELS[lvlId]) {
            controller.startNewGame({ difficulty: lvlId });
          }
        }}
        style={{
          width: "100%",
          padding: "var(--sp-1) var(--sp-2)",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-strong)",
          color: "var(--accent-bright)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-sm)",
          fontWeight: "bold",
        }}
      >
        {Object.values(DIFFICULTY_LEVELS).map((lvl) => {
          const disabled = lvl.requiresThreads && !caps.threaded;
          return (
            <option
              key={lvl.id}
              value={lvl.id}
              disabled={disabled}
              style={{
                background: "var(--surface-raised)",
                color: disabled ? "var(--text-faint)" : "var(--text)",
              }}
            >
              Level {lvl.id} · {lvl.label} (~{lvl.approxElo} Elo)
            </option>
          );
        })}
      </select>

      {isExpanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            marginTop: "var(--sp-1)",
            paddingTop: "var(--sp-2)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {Object.values(DIFFICULTY_LEVELS).map((lvl) => {
            const disabled = lvl.requiresThreads && !caps.threaded;
            const isSelected = state.difficulty === lvl.id;

            return (
              <button
                key={lvl.id}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={`Select level ${lvl.id} ${lvl.label}`}
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
                  opacity: disabled ? 0.6 : 1,
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
        </div>
      )}

      {!caps.threaded && (
        <div
          style={{
            fontSize: "var(--size-xs)",
            color: "var(--text-faint)",
            lineHeight: 1.3,
          }}
        >
          Single-thread mode. Levels 7-8 require multi-threading.
        </div>
      )}
    </div>
  );
}
