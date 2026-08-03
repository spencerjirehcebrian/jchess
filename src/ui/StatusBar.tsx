import { useGameStore } from "../store";

/** Four cells that fill as the engine searches deeper. */
function SearchIndicator({ depth }: { depth: number }) {
  const filled = Math.min(4, Math.max(0, Math.round(depth / 5)));
  return (
    <span
      aria-hidden="true"
      style={{ display: "flex", gap: "2px", alignItems: "center" }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: "6px",
            height: "6px",
            background: i < filled ? "var(--accent)" : "var(--border-strong)",
            transition: "background var(--dur-base) ease",
          }}
        />
      ))}
    </span>
  );
}

export function StatusBar() {
  const state = useGameStore();
  const isBrowsing = state.cursor < state.history.length;

  let message = "";
  let color = "var(--text-dim)";

  if (isBrowsing) {
    message = `Viewing move ${state.cursor}. Press ↓ to return to the game.`;
    color = "var(--warning)";
  } else if (state.status.kind === "setup") {
    message = "Preparing engine";
  } else if (state.status.kind === "human-turn") {
    if (state.premoves.length > 0) {
      message = `${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued`;
      color = "var(--premove)";
    } else {
      message = "Your move";
      color = "var(--text)";
    }
  } else if (
    state.status.kind === "engine-thinking" ||
    state.status.kind === "engine-delaying"
  ) {
    if (state.premoves.length > 0) {
      message = `Thinking. ${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued`;
      color = "var(--premove)";
    } else {
      message = "Thinking";
    }
  } else if (state.status.kind === "over") {
    const res = state.status.result;
    if (res.winner === "white") message = "White won by " + res.reason;
    else if (res.winner === "black") message = "Black won by " + res.reason;
    else message = "Draw by " + res.reason;
    color = "var(--accent-bright)";
  } else if (state.status.kind === "error") {
    message = state.status.error.message;
    color = "var(--error)";
  }

  const isSearching =
    state.status.kind === "engine-thinking" || state.status.kind === "setup";
  const depth =
    state.status.kind === "engine-thinking"
      ? ((state.status as { depth?: number }).depth ?? 0)
      : 0;

  return (
    <div
      className="vx-panel"
      aria-live="polite"
      aria-atomic="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
        padding: "var(--sp-3)",
        minHeight: "44px",
        fontSize: "var(--size-sm)",
        color,
      }}
    >
      <span>{message}</span>
      {isSearching && <SearchIndicator depth={depth} />}
    </div>
  );
}
