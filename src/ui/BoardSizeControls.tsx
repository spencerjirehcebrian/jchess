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

export function BoardSizeControls({ controller }: BoardSizeControlsProps) {
  const currentSize = useGameStore((s) => s.boardSize) ?? "full";
  const currentIndex = SIZES.findIndex((s) => s.id === currentSize);

  const setSize = (size: BoardSizeOption) => {
    controller?.setBoardSize(size);
  };

  const handleDecrease = () => {
    if (currentIndex > 0) {
      setSize(SIZES[currentIndex - 1]!.id);
    }
  };

  const handleIncrease = () => {
    if (currentIndex < SIZES.length - 1) {
      setSize(SIZES[currentIndex + 1]!.id);
    }
  };

  const handleToggleMaximize = () => {
    if (currentSize === "full") {
      setSize("normal");
    } else {
      setSize("full");
    }
  };

  return (
    <div
      aria-label="Board size and zoom controls"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "3px 6px",
      }}
    >
      <span
        style={{
          fontSize: "var(--size-xs)",
          fontFamily: "var(--font-display)",
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          userSelect: "none",
          whiteSpace: "nowrap",
          paddingLeft: "4px",
        }}
      >
        Size
      </span>

      <button
        onClick={handleDecrease}
        disabled={currentIndex <= 0}
        aria-label="Make board smaller"
        title="Smaller board"
        style={{
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: currentIndex <= 0 ? "var(--text-faint)" : "var(--text)",
          cursor: currentIndex <= 0 ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: "bold",
          lineHeight: 1,
        }}
      >
        −
      </button>

      {/* Segmented Pill Group */}
      <div
        style={{
          display: "flex",
          background: "var(--surface)",
          padding: "2px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          gap: "2px",
        }}
      >
        {SIZES.map((size) => {
          const isActive = currentSize === size.id;
          return (
            <button
              key={size.id}
              onClick={() => setSize(size.id)}
              aria-label={`Set board size to ${size.label}`}
              title={`${size.label} (${size.pctLabel})`}
              style={{
                padding: "2px 8px",
                height: "22px",
                background: isActive ? "var(--accent)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--text-dim)",
                border: "none",
                borderRadius: "var(--radius)",
                fontSize: "var(--size-xs)",
                fontFamily: "var(--font-mono)",
                fontWeight: isActive ? "bold" : "normal",
                cursor: "pointer",
                transition: "all var(--dur-fast) ease-in-out",
                whiteSpace: "nowrap",
              }}
            >
              {size.pctLabel}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleIncrease}
        disabled={currentIndex >= SIZES.length - 1}
        aria-label="Make board larger"
        title="Larger board"
        style={{
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color:
            currentIndex >= SIZES.length - 1
              ? "var(--text-faint)"
              : "var(--text)",
          cursor: currentIndex >= SIZES.length - 1 ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: "bold",
          lineHeight: 1,
        }}
      >
        +
      </button>

      <div
        style={{
          width: "1px",
          height: "16px",
          background: "var(--border)",
          margin: "0 2px",
        }}
      />

      <button
        onClick={handleToggleMaximize}
        aria-label={currentSize === "full" ? "Restore normal board size" : "Maximize board size"}
        title={currentSize === "full" ? "Restore normal size" : "Maximize board size"}
        style={{
          padding: "2px 8px",
          height: "24px",
          background: currentSize === "full" ? "var(--accent-bright)" : "var(--surface)",
          color: currentSize === "full" ? "var(--bg)" : "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          fontSize: "var(--size-xs)",
          fontFamily: "var(--font-display)",
          fontWeight: "bold",
          cursor: "pointer",
          transition: "all var(--dur-fast) ease-in-out",
        }}
      >
        {currentSize === "full" ? "Exit Max" : "Max ⤢"}
      </button>
    </div>
  );
}
