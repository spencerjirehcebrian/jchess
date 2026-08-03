import { Result } from "../core/types";
import { GameController } from "../store/controller";

interface ResultBannerProps {
  result: Result;
  controller: GameController | null;
}

export function ResultBanner({ result, controller }: ResultBannerProps) {
  const header =
    result.winner === "white"
      ? "WHITE WINS"
      : result.winner === "black"
        ? "BLACK WINS"
        : "DRAW";

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--accent)",
        borderRadius: "var(--radius)",
        padding: "var(--sp-4)",
        textAlign: "center",
        marginTop: "var(--sp-3)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--size-xl)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--accent-bright)",
          marginBottom: "var(--sp-1)",
        }}
      >
        {header}
      </h2>
      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "var(--size-sm)",
          marginBottom: "var(--sp-3)",
        }}
      >
        by {result.reason}
      </p>
      <button
        onClick={() => controller?.startNewGame()}
        style={{
          padding: "var(--sp-2) var(--sp-6)",
          background: "var(--accent)",
          color: "var(--bg)",
          fontWeight: "bold",
          borderRadius: "var(--radius)",
          cursor: "pointer",
        }}
      >
        New game
      </button>
    </div>
  );
}
