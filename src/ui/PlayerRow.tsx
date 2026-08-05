import { useGameStore } from "../store";
import { searchCells, useTelemetry } from "../store/telemetry";
import { Role, Color } from "../core/types";
import { DIFFICULTY_LEVELS } from "../core/difficulty";
import { THEMES } from "../render/voxel/palette";
import { pieceSpriteUrl } from "../render/voxel/sprite";
import { ORDER, opposite, useMaterialBalance, RoleCounts } from "./material";
import { Clock } from "./Clock";

/**
 * How deep the engine has got: four cells and the number itself.
 *
 * It subscribes to the telemetry store directly rather than taking the depth as
 * a prop, and that is the point. `PlayerRow` reads the whole game store, so a
 * prop would drag the entire row — name, clock, trophy rack and all — through a
 * re-render on every reading. Kept here, the ten-times-a-second feed repaints
 * two spans.
 *
 * Both selectors return numbers, so zustand's identity check absorbs the rest:
 * the cells change about four times a search and the number about once a second,
 * however often the engine actually reports.
 */
function SearchIndicator() {
  const filled = useTelemetry(searchCells);
  const depth = useTelemetry((t) => t.depth);

  return (
    <span
      aria-hidden="true"
      style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}
    >
      <span style={{ display: "flex", gap: "2px", alignItems: "center" }}>
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
      {/*
        Tabular and reserved at three characters, so the row does not twitch
        sideways each time the search reaches double digits.
      */}
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          minWidth: "3ch",
          color: "var(--text-faint)",
        }}
      >
        {depth > 0 ? `d${depth}` : ""}
      </span>
    </span>
  );
}

/**
 * The pieces taken, drawn with the same voxel grids the board renders. The
 * icons are the assets, not a second set of illustrations that would drift
 * from them.
 *
 * They lie on the deck rather than in a tray. It used to be a moulded recess,
 * which meant two grey slots sat in the rail doing nothing for most of a game —
 * a container drawn around an absence. The pieces carry their own outline
 * (`sprite.ts` stamps a contrasting halo precisely so they read on any surface),
 * so the box was never what made them legible.
 *
 * The height stays reserved whether the rack is full or empty. That is the one
 * thing worth keeping from the tray: the rack used to collapse to nothing
 * before the first capture and then grow a row at a time, shifting everything
 * below it in the rail. Empty space costs nothing to look at now that there is
 * no box drawn around it.
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        alignContent: "flex-start",
        flexWrap: "wrap",
        gap: "1px",
        flex: 1,
        minWidth: 0,
        // Two rows of sprites plus the gap between them. A side can lose at
        // most fifteen pieces and roughly twenty fit across the rail, so the
        // rack never needs a third row and never has to reflow the column.
        // Even, so a centred line box inside it lands on a whole pixel — at 45
        // the baseline fell on a half and the advantage readout beside it blurred.
        height: "46px",
        overflow: "hidden",
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
          <span key={key} style={{ fontSize: "var(--legend-xs)" }}>
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

  /*
   * The king on this side of the board is in check.
   *
   * The last move having given check means the side *to move* is the one in it,
   * and `isActive` already means "this row is the side to move" — so the two
   * compose without deriving a position. Mate is excluded: the game is over, the
   * result plate says so, and a check legend under it would be reporting the
   * penultimate state of a finished game.
   */
  const lastPly = state.history[state.history.length - 1];
  const inCheck = isActive && !!lastPly?.isCheck && !lastPly.isMate;

  let status = "";
  let statusColor = "var(--text-dim)";

  if (side === "engine") {
    if (isEngineSearching) status = "Thinking";
  } else if (state.status.kind === "human-turn") {
    if (state.premoves.length > 0) {
      status = `${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued`;
      statusColor = "var(--accent)";
    } else {
      status = "Your move";
      statusColor = "var(--text)";
    }
  } else if (isEngineSearching && state.premoves.length > 0) {
    status = `${state.premoves.length} premove${state.premoves.length > 1 ? "s" : ""} queued`;
    statusColor = "var(--accent)";
  }

  const name = side === "engine" ? "Stockfish" : "You";
  const detail =
    side === "engine"
      ? `level ${state.difficulty} · ${level?.label ?? ""}`
      : // The row only exists once a game does, so the coin has already landed
        // and there is always a colour to name.
        `playing ${color}`;

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
      {/*
        A name, not an eyebrow. At label size the two players read smaller than
        the level readout beside them, which put the least important number in
        the row above the people playing.
      */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          fontFamily: "var(--font-legend)",
          fontSize: "var(--legend)",
          fontWeight: 700,
          letterSpacing: "2px",
          lineHeight: "var(--lh-legend)",
          textTransform: "uppercase",
          color: isActive ? "var(--text)" : "var(--text-dim)",
        }}
      >
        {/*
          Which side the machine is waiting on. Decorative only: the status text
          beside it says the same thing in words, and the row already carries the
          lit surface, so the turn is never told by this lamp alone.
        */}
        <span className="vx-lamp" data-lit={isActive} aria-hidden="true" />
        {name}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          // A sentence addressed to a player, not a legend printed on the
          // panel — so it is set in the data face, not the legend face.
          fontSize: "var(--data-xs)",
          lineHeight: "var(--lh-data-xs)",
          color: statusColor,
        }}
      >
        {/*
          Sentence case in the literal, uppercased in CSS — the same rule the
          rest of the legends follow, because Playwright's accessible-name
          computation applies text-transform and Testing Library's does not.
        */}
        {inCheck && <span className="vx-alert-legend">Check</span>}
        {status}
        {side === "engine" && isEngineSearching && <SearchIndicator />}
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
        fontFamily: "var(--font-data)",
        fontSize: "var(--data-xs)",
        lineHeight: "var(--lh-data-xs)",
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
        alignItems: "stretch",
        gap: "var(--sp-2)",
      }}
    >
      <Trophies counts={trophies[color]} of={opposite(color)} />
      {/*
        Anchored to the rack rather than floated beside it, so the pair reads
        as one instrument: the pieces taken, and what they came to.
      */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: "var(--font-data)",
          fontSize: "var(--data)",
          lineHeight: "var(--lh-data-xs)",
          color: lead > 0 ? "var(--accent)" : "var(--text-faint)",
          whiteSpace: "nowrap",
          minWidth: "3ch",
          justifyContent: "flex-end",
        }}
        {...(lead > 0 ? { "aria-label": `${lead} points ahead` } : {})}
      >
        {lead > 0 ? `+${lead}` : "·"}
      </span>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        padding: "var(--sp-3)",
        /*
         * The side to move is marked by a lit edge, not by a lighter panel.
         *
         * It was a lighter panel while the housing was pale, where raising the
         * background raised the contrast of the dark ink on it. On a dark deck
         * it does the opposite: lifting the surface under light ink eats the
         * ink's headroom, and it measured 3.5:1 for the faintest two lines in
         * the row — under the floor, in the one row the player is looking at.
         *
         * Solving the inks against the lit panel instead would have worked and
         * been worse: it pushes text-faint up to within a hair of text-dim and
         * collapses a three-step ink ramp into two. So the cue moves to an edge,
         * which is how everything else on this machine says "lit", and the
         * transparent border keeps the text from shifting 2px when it changes.
         */
        borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
        transition: "border-color var(--dur-base) ease",
      }}
    >
      {/*
        Both rows read the same way down: who, what they are playing at, what
        they have taken. The material used to mirror on the human row so each
        side's captures sat against the transcript that recorded them — with the
        two rows stacked together beneath it, that reason is gone, and mirroring
        would only make the same three lines read in two different orders.
      */}
      {identity}
      {detailLine}
      {material}
    </div>
  );
}
