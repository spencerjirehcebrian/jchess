import { useMemo } from "react";
import { useGameStore } from "../store";
import { positionAfter } from "../core/rules";
import { Role, Color } from "../core/types";
import { THEMES } from "../render/voxel/palette";
import { pieceSpriteUrl } from "../render/voxel/sprite";

const START_COUNTS: Record<Role, number> = {
  pawn: 8,
  knight: 2,
  bishop: 2,
  rook: 2,
  queen: 1,
  king: 1,
};

const VALUES: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/** Heaviest first, so the tray reads as a ranking rather than a pile. */
const ORDER: Role[] = ["queen", "rook", "bishop", "knight", "pawn"];

function captureCounts(board: {
  get: (sq: number) => { role: Role; color: Color } | undefined;
}): Record<Color, Record<Role, number>> {
  const remaining: Record<Color, Record<Role, number>> = {
    white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
    black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
  };

  for (let sq = 0; sq < 64; sq++) {
    const piece = board.get(sq);
    if (piece) remaining[piece.color][piece.role] += 1;
  }

  const captured: Record<Color, Record<Role, number>> = {
    white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
    black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
  };

  for (const color of ["white", "black"] as Color[]) {
    for (const role of ORDER) {
      // Promotion can leave more of a role on the board than the game began
      // with, so a negative difference means nothing was captured.
      captured[color][role] = Math.max(
        0,
        START_COUNTS[role] - remaining[color][role],
      );
    }
  }

  return captured;
}

function Row({
  color,
  counts,
  advantage,
}: {
  color: Color;
  counts: Record<Role, number>;
  advantage: number;
}) {
  const themeId = useGameStore((s) => s.theme) ?? "lacquer";
  const theme = THEMES[themeId] ?? THEMES.lacquer!;
  const palette = color === "white" ? theme.white : theme.black;

  const sprites: { role: Role; key: string }[] = [];
  for (const role of ORDER) {
    for (let i = 0; i < counts[role]; i += 1) {
      sprites.push({ role, key: `${role}-${i}` });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        minHeight: "28px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "1px",
          flex: 1,
          minWidth: 0,
          flexWrap: "wrap",
        }}
      >
        {sprites.length === 0 ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-xs)",
              color: "var(--text-faint)",
            }}
          >
            none
          </span>
        ) : (
          sprites.map(({ role, key }) => {
            const url = pieceSpriteUrl(role, palette, 2);
            return url ? (
              <img
                key={key}
                src={url}
                alt={role}
                style={{
                  height: "20px",
                  width: "auto",
                  imageRendering: "pixelated",
                  display: "block",
                }}
              />
            ) : (
              <span key={key} style={{ fontSize: "var(--size-xs)" }}>
                {role[0]}
              </span>
            );
          })
        )}
      </div>

      {advantage > 0 && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-sm)",
            color: "var(--accent)",
            whiteSpace: "nowrap",
          }}
        >
          +{advantage}
        </span>
      )}
    </div>
  );
}

/**
 * Captured material, drawn with the same voxel grids the board renders. The
 * icons are the assets, not a second set of illustrations that would drift
 * from them.
 */
export function CapturedTray() {
  const initialFen = useGameStore((s) => s.initialFen);
  const history = useGameStore((s) => s.history);
  const cursor = useGameStore((s) => s.cursor);

  const { captured, whiteAdvantage, blackAdvantage } = useMemo(() => {
    const pos = positionAfter(
      initialFen,
      history.slice(0, cursor).map((h) => h.move),
    );
    const counts = captureCounts(pos.board);

    const score = (side: Color) =>
      ORDER.reduce((sum, role) => sum + counts[side][role] * VALUES[role], 0);

    // Capturing a black piece is white's gain, so the balance is inverted.
    const diff = score("black") - score("white");
    return {
      captured: counts,
      whiteAdvantage: Math.max(0, diff),
      blackAdvantage: Math.max(0, -diff),
    };
  }, [initialFen, history, cursor]);

  return (
    <div className="vx-panel" style={{ padding: "var(--sp-3)" }}>
      <div className="vx-label" style={{ marginBottom: "var(--sp-2)" }}>
        Captured
      </div>
      <Row color="black" counts={captured.black} advantage={whiteAdvantage} />
      <div
        style={{
          height: "1px",
          background: "var(--border)",
          margin: "var(--sp-2) 0",
        }}
      />
      <Row color="white" counts={captured.white} advantage={blackAdvantage} />
    </div>
  );
}
