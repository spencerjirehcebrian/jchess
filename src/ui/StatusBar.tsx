import { useGameStore } from "../store";

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
    }
  } else if (
    state.status.kind === "engine-thinking" ||
    state.status.kind === "engine-delaying"
  ) {
    if (state.premoves.length > 0) {
      message = `Thinking... (${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued)`;
      color = "var(--premove)";
    } else {
      message = "Thinking...";
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--sp-2) var(--sp-3)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        fontSize: "var(--size-sm)",
        color,
      }}
    >
      <span>{message}</span>
      {(state.status.kind === "engine-thinking" ||
        state.status.kind === "setup") && (
        <span
          style={{ fontSize: "var(--size-xs)", color: "var(--text-faint)" }}
        >
          ●●●
        </span>
      )}
    </div>
  );
}
