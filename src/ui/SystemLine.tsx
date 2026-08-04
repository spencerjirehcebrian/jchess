import { useGameStore } from "../store";

/**
 * The one message in the rail that belongs to neither player: what the app is
 * doing to the game, rather than what a side is doing in it. Collapses to
 * nothing when there is nothing to say, so it never holds a reserved empty
 * strip through a whole game.
 */
export function SystemLine() {
  const state = useGameStore();
  const isBrowsing = state.cursor < state.history.length;

  let message = "";
  let color = "var(--text-dim)";

  if (state.status.kind === "error") {
    message = state.status.error.message;
    color = "var(--error)";
  } else if (isBrowsing) {
    message = `Viewing move ${state.cursor}. Press ↓ to return to the game.`;
    color = "var(--warning)";
  }

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "var(--sp-2) var(--sp-3)",
        borderTop: "1px solid var(--border)",
        fontSize: "var(--data-xs)",
        lineHeight: "var(--lh-data-xs)",
        color,
      }}
    >
      {message}
    </div>
  );
}
