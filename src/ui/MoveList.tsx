import { useEffect, useRef } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";

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
  }[] = [];

  for (let i = 0; i < state.history.length; i += 2) {
    const whiteEntry = state.history[i]!;
    const blackEntry = state.history[i + 1] ?? null;
    pairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: { san: whiteEntry.san, index: i + 1 },
      black: blackEntry ? { san: blackEntry.san, index: i + 2 } : null,
    });
  }

  const isBrowsing = state.cursor < state.history.length;

  useEffect(() => {
    if (!isBrowsing && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [state.history.length, state.cursor, isBrowsing]);

  return (
    <div
      ref={listRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-sm)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "var(--sp-2) var(--sp-3)",
      }}
    >
      {pairs.length === 0 ? (
        <div style={{ color: "var(--text-faint)", fontStyle: "italic" }}>
          No moves played yet
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
                gridTemplateColumns: "40px 1fr 1fr",
                padding: "2px 0",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--text-faint)" }}>{p.moveNum}.</span>

              {p.white && (
                <button
                  onClick={() => controller?.setCursor(p.white!.index)}
                  style={{
                    textAlign: "left",
                    color: isWhiteActive ? "var(--text)" : "var(--text-dim)",
                    fontWeight: isWhiteActive ? "bold" : "normal",
                    borderLeft: isWhiteActive
                      ? "2px solid var(--accent)"
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
                    color: isBlackActive ? "var(--text)" : "var(--text-dim)",
                    fontWeight: isBlackActive ? "bold" : "normal",
                    borderLeft: isBlackActive
                      ? "2px solid var(--accent)"
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
            </div>
          );
        })
      )}
    </div>
  );
}
