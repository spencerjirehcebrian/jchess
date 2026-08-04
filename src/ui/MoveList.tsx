import { useEffect, useRef } from "react";
import { useGameStore } from "../store";
import { HistoryEntry } from "../core/types";
import { GameController } from "../store/controller";
import { formatEval } from "./EvalStrip";

interface MoveListProps {
  controller: GameController | null;
}

export function MoveList({ controller }: MoveListProps) {
  const state = useGameStore();
  const listRef = useRef<HTMLDivElement | null>(null);

  const pairs: {
    moveNum: number;
    white: { san: string; index: number } | null;
    black: { san: string; index: number } | null;
    scored: HistoryEntry | null;
  }[] = [];

  for (let i = 0; i < state.history.length; i += 2) {
    const whiteEntry = state.history[i]!;
    const blackEntry = state.history[i + 1] ?? null;
    pairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: { san: whiteEntry.san, index: i + 1 },
      black: blackEntry ? { san: blackEntry.san, index: i + 2 } : null,
      // The engine plays one colour, so at most one ply of a pair was ever
      // searched — which is why a single score per row is a full column rather
      // than a half-empty one.
      scored:
        [whiteEntry, blackEntry].find(
          (e) => e && (e.evalCp !== undefined || e.evalMate !== undefined),
        ) ?? null,
    });
  }

  const isBrowsing = state.cursor < state.history.length;

  /*
   * The scores stay dark until the game is decided — same rule as the strip
   * above the transcript, and for the same reason.
   *
   * 56px, so the two move columns keep splitting an even remainder. The rail is
   * 340-380px and the display pads 12px a side, which leaves an even inner
   * width; take two even columns out of it and each `1fr` still lands on a whole
   * pixel. An odd column here would put every black move in the game on a half.
   */
  const showEval = state.status.kind === "over";
  const columns = showEval ? "56px 1fr 1fr 56px" : "56px 1fr 1fr";

  useEffect(() => {
    if (!isBrowsing && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [state.history.length, state.cursor, isBrowsing]);

  return (
    <div
      ref={listRef}
      className="app-move-list vx-lcd"
      aria-label="Move list"
      // Sizing lives in .app-move-list, not here. An inline min-height cannot
      // be overridden by the mobile media query, and set to 0 it collapsed the
      // transcript to a sliver once the rail stopped dividing a fixed height.
      style={{
        overflowY: "auto",
        fontFamily: "var(--font-data)",
        fontSize: "var(--data)",
        lineHeight: "var(--lh-data)",
        // A multiple of the cell pitch, so the grid stays in phase with the
        // glyphs rather than starting mid-cell.
        padding: "12px",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {pairs.length === 0 ? (
        // Centred in the well rather than pinned to its top corner, so the
        // empty transcript reads as a space waiting to be filled instead of
        // one line of text abandoned above a void.
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-2)",
            color: "var(--lcd-dim)",
          }}
        >
          <span
            className="vx-dither"
            aria-hidden="true"
            style={{ width: "16px", height: "8px", flexShrink: 0 }}
          />
          Play a move to begin
        </div>
      ) : (
        pairs.map((p) => {
          const isWhiteActive = state.cursor === p.white?.index;
          const isBlackActive = p.black && state.cursor === p.black.index;

          return (
            <div
              key={p.moveNum}
              style={{
                display: "grid",
                // 56, not 40: at --data a three-character move number is 42px
                // wide and was overrunning its column into the white move.
                gridTemplateColumns: columns,
                padding: "2px 0",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--lcd-dim)" }}>{p.moveNum}.</span>

              {/*
                The current ply is marked by colour and the left border, never
                by weight. Departure Mono ships one weight, so asking for bold
                got a synthesised one — the browser smearing a 1px stem sideways
                — on the single element the eye tracks most.
              */}
              {p.white && (
                <button
                  onClick={() => controller?.setCursor(p.white!.index)}
                  style={{
                    textAlign: "left",
                    color: isWhiteActive ? "var(--lcd-on)" : "var(--lcd-dim)",
                    borderLeft: isWhiteActive
                      ? "2px solid var(--lcd-on)"
                      : "2px solid transparent",
                    paddingLeft: "var(--sp-1)",
                    cursor: "pointer",
                  }}
                >
                  {p.white.san}
                </button>
              )}

              {p.black ? (
                <button
                  onClick={() => controller?.setCursor(p.black!.index)}
                  style={{
                    textAlign: "left",
                    color: isBlackActive ? "var(--lcd-on)" : "var(--lcd-dim)",
                    borderLeft: isBlackActive
                      ? "2px solid var(--lcd-on)"
                      : "2px solid transparent",
                    paddingLeft: "var(--sp-1)",
                    cursor: "pointer",
                  }}
                >
                  {p.black.san}
                </button>
              ) : (
                <span />
              )}

              {showEval && (
                <span
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--lcd-dim)",
                  }}
                >
                  {p.scored ? formatEval(p.scored) : ""}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
