import { useGameStore } from "../store";
import { Role, Color } from "../core/types";
import { DIFFICULTY_LEVELS } from "../core/difficulty";
import { THEMES } from "../render/voxel/palette";
import { pieceSpriteUrl } from "../render/voxel/sprite";
import { ORDER, opposite, useMaterialBalance, RoleCounts } from "./material";
import { Clock } from "./Clock";

/** Four cells that fill as the engine searches deeper. */
function SearchIndicator({ depth }: { depth: number }) {
  const filled = Math.min(4, Math.max(0, Math.round(depth / 5)));
  return (
    <span
      aria-hidden="true"
      style={{ display: "flex", gap: "2px", alignItems: "center" }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: "6px",
            height: "6px",
            background: i < filled ? "var(--accent)" : "var(--border-strong)",
            transition: "background var(--dur-base) ease",
          }}
        />
      ))}
    </span>
  );
}

/**
 * Captured pieces, drawn with the same voxel grids the board renders. The
 * icons are the assets, not a second set of illustrations that would drift
 * from them.
 */
function Trophies({ counts, of }: { counts: RoleCounts; of: Color }) {
  const themeId = useGameStore((s) => s.theme) ?? "lacquer";
  const theme = THEMES[themeId] ?? THEMES.lacquer!;
  const palette = of === "white" ? theme.white : theme.black;

  const sprites: { role: Role; key: string }[] = [];
  for (const role of ORDER) {
    for (let i = 0; i < counts[role]; i += 1) {
      sprites.push({ role, key: `${role}-${i}` });
    }
  }

  // No placeholder when empty. An empty row inside a named player reads as
  // "nothing taken yet" on its own; a word there would only be noise.
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: "1px",
        flex: 1,
        minWidth: 0,
        minHeight: "20px",
      }}
    >
      {sprites.map(({ role, key }) => {
        const url = pieceSpriteUrl(role, palette, 2);
        return url ? (
          <img
            key={key}
            src={url}
            alt=""
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
      })}
    </div>
  );
}

interface PlayerRowProps {
  side: "engine" | "human";
}

/**
 * One side of the game. The two rows bracket the transcript and mirror each
 * other: the engine reads downward from its name, the human reads upward to
 * theirs, so both players' captures sit against the record of the capturing.
 *
 * Status lives on the player it describes rather than in a bar of its own —
 * "thinking" is something Stockfish is doing, and "your move" is addressed to
 * exactly one of the two names on screen.
 */
export function PlayerRow({ side }: PlayerRowProps) {
  const state = useGameStore();
  const { trophies, advantage } = useMaterialBalance();

  const color: Color =
    side === "human" ? state.humanColor : opposite(state.humanColor);
  const level = DIFFICULTY_LEVELS[state.difficulty];

  const isEngineSearching =
    state.status.kind === "engine-thinking" ||
    state.status.kind === "engine-delaying";
  const isActive =
    side === "engine" ? isEngineSearching : state.status.kind === "human-turn";

  const depth =
    state.status.kind === "engine-thinking"
      ? ((state.status as { depth?: number }).depth ?? 0)
      : 0;

  let status = "";
  let statusColor = "var(--text-dim)";

  if (side === "engine") {
    if (state.status.kind === "setup") status = "Preparing";
    else if (isEngineSearching) status = "Thinking";
  } else if (state.status.kind === "human-turn") {
    if (state.premoves.length > 0) {
      status = `${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued`;
      statusColor = "var(--premove)";
    } else {
      status = "Your move";
      statusColor = "var(--text)";
    }
  } else if (isEngineSearching && state.premoves.length > 0) {
    status = `${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued`;
    statusColor = "var(--premove)";
  }

  const name = side === "engine" ? "Stockfish" : "You";
  const detail =
    side === "engine"
      ? `level ${state.difficulty} · ${level?.label ?? ""}`
      : `playing ${color}`;

  const lead = advantage[color];

  const identity = (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
      }}
    >
      <span
        className="vx-label"
        style={{ color: isActive ? "var(--text)" : "var(--text-faint)" }}
      >
        {name}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          fontSize: "var(--size-sm)",
          color: statusColor,
        }}
      >
        {status}
        {side === "engine" && isEngineSearching && (
          <SearchIndicator depth={depth} />
        )}
      </span>
    </div>
  );

  const detailLine = (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-xs)",
        color: "var(--text-faint)",
      }}
    >
      <span>{detail}</span>
      <Clock color={color} />
    </div>
  );

  const material = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "var(--sp-2)",
      }}
    >
      <Trophies counts={trophies[color]} of={opposite(color)} />
      {lead > 0 && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-sm)",
            color: "var(--accent)",
            whiteSpace: "nowrap",
          }}
          aria-label={`${lead} points ahead`}
        >
          +{lead}
        </span>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        padding: "var(--sp-3)",
        // The side to move is the lit one. Turn state is carried by the
        // material system rather than by a coloured dot; the status text
        // beside it says the same thing in words.
        background: isActive ? "var(--voxel-top)" : "transparent",
        transition: "background var(--dur-base) ease",
      }}
    >
      {/*
        Only the material mirrors. Both names still read before their own
        detail line, because "playing white" above an unread "You" asks the
        reader to hold a fact before they know whose it is. What matters is
        that each side's captures sit against the transcript that records the
        capturing, and that survives on its own.
      */}
      {side === "engine" ? (
        <>
          {identity}
          {detailLine}
          {material}
        </>
      ) : (
        <>
          {material}
          {identity}
          {detailLine}
        </>
      )}
    </div>
  );
}
