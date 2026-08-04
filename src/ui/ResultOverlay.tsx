import { useEffect, useRef } from "react";
import { Color, Result } from "../core/types";

interface ResultOverlayProps {
  result: Result;
  humanColor: Color;
  onDismiss: () => void;
}

/**
 * How the game ended, said from where the player is sitting. "White wins" is
 * a fact about a board; "you won" is the thing they actually want to know, and
 * it is the only phrasing that survives choosing a side at random.
 */
function headline(result: Result, humanColor: Color): string {
  if (!result.winner) return "DRAW";
  return result.winner === humanColor ? "YOU WON" : "YOU LOST";
}

const REASONS: Record<Result["reason"], string> = {
  checkmate: "by checkmate",
  stalemate: "by stalemate",
  "insufficient-material": "by insufficient material",
  threefold: "by repetition",
  "fifty-move": "by the fifty-move rule",
  resignation: "by resignation",
  timeout: "on time",
};

/**
 * The result, over the board it happened on.
 *
 * It covers the board rather than the whole window, and carries no scrim: the
 * rail behind it is already the finished game's analysis — the assessment
 * gauge, the transcript to walk back through — and dimming that to announce
 * the result would be hiding the thing the announcement is about.
 *
 * Every way out leads to the same place. Dismissing does not change the game's
 * state at all; it only stops covering it up.
 */
export function ResultOverlay({
  result,
  humanColor,
  onDismiss,
}: ResultOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    buttonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onDismiss]);

  return (
    /*
      Anchored to the board stage, which is already positioned, so `inset: 0`
      covers exactly the board and nothing else — the same trick the promotion
      picker plays one square at a time.

      role="dialog" is deliberate: it is what the arrow-key handler in `App`
      looks for to keep the transcript from being walked while something is
      over the board. The moment this unmounts, browsing works again.
    */
    <div
      role="dialog"
      aria-label="Game result"
      onClick={onDismiss}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-4)",
      }}
    >
      <div
        className="vx-panel"
        // The plate is the thing being pressed, not the way out of it.
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "var(--sp-6)",
          textAlign: "center",
          minWidth: "min(320px, 100%)",
          // The accent-topped extrusion the old result plate wore: lit along
          // the top edge, so it reads as something that just landed.
          boxShadow:
            "inset 0 2px 0 0 var(--accent), inset -2px 0 0 0 var(--voxel-side), inset 0 -2px 0 0 var(--voxel-under)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-legend)",
            // One step up from every other heading in the machine. This is the
            // only moment that earns the largest legend it has.
            fontSize: "var(--legend-xl)",
            fontWeight: 700,
            letterSpacing: "3px",
            lineHeight: "var(--lh-legend-xl)",
            textTransform: "uppercase",
            color: "var(--accent-bright)",
            marginBottom: "var(--sp-2)",
          }}
        >
          {headline(result, humanColor)}
        </h2>
        <p
          style={{
            color: "var(--text-dim)",
            fontSize: "var(--data-xs)",
            lineHeight: "var(--lh-data-xs)",
            marginBottom: "var(--sp-6)",
          }}
        >
          {REASONS[result.reason]}
        </p>
        {/*
          Not "new game". The game is still here to be looked at, and the key
          that replaces it is on the keypad where every other state change is.
        */}
        <button
          ref={buttonRef}
          className="vx-button"
          data-variant="primary"
          onClick={onDismiss}
          style={{ width: "100%" }}
        >
          View game
        </button>
      </div>
    </div>
  );
}
