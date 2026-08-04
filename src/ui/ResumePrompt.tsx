import { StoredGame } from "../storage";

interface ResumePromptProps {
  game: StoredGame;
  onResume: () => void;
  onDiscard: () => void;
}

/** "3 hours ago", "Tuesday", "on 12 March" — how a person would say it. */
function whenLabel(updatedAt: number): string {
  const elapsed = Date.now() - updatedAt;
  const hours = Math.floor(elapsed / (60 * 60 * 1000));

  if (hours < 1) return "a few minutes ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) {
    return `on ${new Date(updatedAt).toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return `on ${new Date(updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
}

function plyLabel(pgn: string): string {
  // The move text is whatever follows the tag block.
  const moveText = pgn.split("\n\n")[1] ?? "";
  const plies = moveText
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.$/.test(t) && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
  const full = Math.ceil(plies.length / 2);
  return `${full} move${full === 1 ? "" : "s"} in`;
}

/**
 * Offered on boot, never applied automatically — an unexpected board on load is
 * disorienting (`docs/04-game-core.md`). Declining is not destructive by
 * accident: it says what it does, and starts the new game the player came for.
 */
export function ResumePrompt({ game, onResume, onDiscard }: ResumePromptProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1100,
      }}
    >
      <div
        className="vx-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Resume unfinished game"
        style={{
          padding: "var(--sp-6)",
          width: "90%",
          maxWidth: "420px",
          color: "var(--text)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--size-lg)",
            fontWeight: 700,
            fontStretch: "120%",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            paddingBottom: "var(--sp-3)",
            borderBottom: "2px solid var(--accent-dim)",
          }}
        >
          Unfinished game
        </h2>

        <p
          style={{
            margin: "var(--sp-4) 0 var(--sp-2)",
            fontSize: "var(--size-sm)",
            lineHeight: 1.5,
          }}
        >
          You left a game {whenLabel(game.updatedAt)}, {plyLabel(game.pgn)}{" "}
          against Stockfish at level {game.difficulty}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-2)",
            marginTop: "var(--sp-5)",
          }}
        >
          <button className="vx-button" onClick={onDiscard}>
            Start fresh
          </button>
          <button
            className="vx-button"
            data-variant="primary"
            onClick={onResume}
            autoFocus
          >
            Resume it
          </button>
        </div>
      </div>
    </div>
  );
}
