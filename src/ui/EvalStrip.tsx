import { HistoryEntry } from "../core/types";
import { useGameStore } from "../store";

/**
 * How the engine saw the game, shown once it is finished.
 *
 * Deliberately absent during play. The evaluation is recorded ply by ply as the
 * engine searches, but showing it live tells a player they are losing before
 * they can see why — which against a level-two opponent is discouraging rather
 * than instructive, and is the closest thing to an assist this app would ship.
 *
 * It reads at the cursor, so stepping back through the transcript walks the
 * assessment back with it.
 */

/** Cells either side of the centre, and what each one is worth. */
const ARM = 7;
const CP_PER_CELL = 50;

/*
 * Fixed width, not a fraction of the rail.
 *
 * 15 cells at 10px with 2px between them is 178px however wide the rail gets,
 * and the rail's bounds are both even — so the block always centres on a whole
 * pixel instead of landing each cell edge on a fraction and softening the one
 * element in here made entirely of edges.
 */
const CELL = 10;
const GAP = 2;

/** The last ply at or before the cursor that the engine actually searched. */
function readingAt(history: HistoryEntry[], cursor: number): HistoryEntry | null {
  for (let i = Math.min(cursor, history.length) - 1; i >= 0; i -= 1) {
    const ply = history[i];
    if (ply && (ply.evalCp !== undefined || ply.evalMate !== undefined)) {
      return ply;
    }
  }
  return null;
}

/** Signed cell offset from the centre, clamped to the arm. */
function offsetFor(ply: HistoryEntry): number {
  if (ply.evalMate !== undefined) {
    // Mate is not a quantity — it pins the gauge.
    return ply.evalMate >= 0 ? ARM : -ARM;
  }
  const cp = ply.evalCp ?? 0;
  const steps = Math.round(cp / CP_PER_CELL);
  return Math.max(-ARM, Math.min(ARM, steps));
}

/** Shared with the transcript column, so both say a score the same way. */
export function formatEval(ply: HistoryEntry): string {
  if (ply.evalMate !== undefined) {
    return `${ply.evalMate < 0 ? "-" : "+"}M${Math.abs(ply.evalMate)}`;
  }
  const pawns = (ply.evalCp ?? 0) / 100;
  return `${pawns >= 0 ? "+" : "−"}${Math.abs(pawns).toFixed(1)}`;
}

function describe(ply: HistoryEntry): string {
  if (ply.evalMate !== undefined) {
    const side = ply.evalMate >= 0 ? "White" : "Black";
    return `${side} mates in ${Math.abs(ply.evalMate)}`;
  }
  const pawns = (ply.evalCp ?? 0) / 100;
  if (Math.abs(pawns) < 0.1) return "Level";
  const side = pawns > 0 ? "White" : "Black";
  return `${side} ahead by ${Math.abs(pawns).toFixed(1)} pawns`;
}

export function EvalStrip() {
  const status = useGameStore((s) => s.status);
  const history = useGameStore((s) => s.history);
  const cursor = useGameStore((s) => s.cursor);

  if (status.kind !== "over") return null;

  const ply = readingAt(history, cursor);
  // A game with no engine ply in it — resigned on move one, or restored from a
  // PGN, which carries notation and not instrument readings.
  if (!ply) return null;

  const offset = offsetFor(ply);

  return (
    <div
      className="vx-lcd"
      role="img"
      aria-label={`Engine evaluation: ${describe(ply)}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-2)",
        // A multiple of the cell pitch, so the matrix behind stays in phase.
        padding: "12px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: "flex", gap: `${GAP}px`, flexShrink: 0 }}
      >
        {Array.from({ length: ARM * 2 + 1 }, (_, i) => {
          const at = i - ARM;
          const lit =
            offset === 0
              ? at === 0
              : at === 0 ||
                (offset > 0 ? at > 0 && at <= offset : at < 0 && at >= offset);

          return (
            <span
              key={at}
              style={{
                width: `${CELL}px`,
                height: "12px",
                // Unlit segments stay visible rather than disappearing into the
                // glass — the display is a component that exists when it is off.
                backgroundColor: lit
                  ? at === 0 && offset === 0
                    ? "var(--lcd-dim)"
                    : "var(--lcd-on)"
                  : "var(--lcd-field)",
              }}
            />
          );
        })}
      </span>

      <span
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "var(--data)",
          lineHeight: "var(--lh-data)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--lcd-on)",
          whiteSpace: "nowrap",
        }}
      >
        {formatEval(ply)}
      </span>
    </div>
  );
}
