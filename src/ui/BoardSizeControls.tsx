import { useGameStore } from "../store";
import { GameController } from "../store/controller";

export type BoardSizeOption = "compact" | "normal" | "large" | "full";

const SIZES: { id: BoardSizeOption; label: string; pctLabel: string }[] = [
  { id: "compact", label: "Compact", pctLabel: "60%" },
  { id: "normal", label: "Normal", pctLabel: "75%" },
  { id: "large", label: "Large", pctLabel: "90%" },
  { id: "full", label: "Full", pctLabel: "100%" },
];

interface BoardSizeControlsProps {
  controller: GameController | null;
}

/* Square, so the two steppers read as a pair of keys rather than two words. */
const stepStyle: React.CSSProperties = {
  width: "var(--control-h-sm)",
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--legend)",
  lineHeight: "var(--lh-legend)",
};

/**
 * A stepper, not a segmented control. Board size is a preference set once and
 * forgotten; the previous four-segment group plus a maximise toggle was the
 * loudest object on the screen, competing with the board it resizes.
 */
export function BoardSizeControls({ controller }: BoardSizeControlsProps) {
  const currentSize = useGameStore((s) => s.boardSize) ?? "full";
  const currentIndex = SIZES.findIndex((s) => s.id === currentSize);
  const current = SIZES[currentIndex] ?? SIZES[3]!;

  const setSize = (size: BoardSizeOption) => {
    controller?.setBoardSize(size);
  };

  const atMin = currentIndex <= 0;
  const atMax = currentIndex >= SIZES.length - 1;

  return (
    <div
      role="group"
      aria-label="Board size"
      style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}
    >
      <span className="vx-label">Size</span>

      <button
        className="vx-button"
        data-size="sm"
        onClick={() => !atMin && setSize(SIZES[currentIndex - 1]!.id)}
        disabled={atMin}
        aria-label="Make the board smaller"
        style={stepStyle}
      >
        {/*
          A hyphen, not U+2212. The typographic minus is not in Silkscreen and
          fell back to a system face; its partner "+" is in the font, so the
          pair was being drawn by two different typefaces.
        */}
        -
      </button>

      <span
        aria-live="polite"
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "var(--data-xs)",
          lineHeight: "var(--lh-data-xs)",
          color: "var(--text-dim)",
          minWidth: "4ch",
          textAlign: "center",
        }}
      >
        {current.pctLabel}
      </span>

      <button
        className="vx-button"
        data-size="sm"
        onClick={() => !atMax && setSize(SIZES[currentIndex + 1]!.id)}
        disabled={atMax}
        aria-label="Make the board larger"
        style={stepStyle}
      >
        +
      </button>
    </div>
  );
}
