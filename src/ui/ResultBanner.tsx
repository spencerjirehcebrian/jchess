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
      className="vx-panel"
      role="status"
      style={{
        padding: "var(--sp-4)",
        textAlign: "center",
        boxShadow:
          "inset 0 2px 0 0 var(--accent), inset -2px 0 0 0 var(--voxel-side), inset 0 -2px 0 0 var(--voxel-under)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--size-xl)",
          fontWeight: 700,
          fontStretch: "120%",
          letterSpacing: "0.16em",
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
        className="vx-button"
        data-variant="primary"
        onClick={() => controller?.startNewGame()}
        style={{ width: "100%" }}
      >
        New game
      </button>
    </div>
  );
}
