import { useState, useEffect, useMemo, useRef } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { positionAfter, legalMoves, toSan } from "../core/rules";
import { matchPrefix } from "../core/san-parser";

interface NotationInputProps {
  controller: GameController | null;
}

export function NotationInput({ controller }: NotationInputProps) {
  const state = useGameStore();
  const [buffer, setBuffer] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isEngineThinking =
    state.status.kind === "engine-thinking" ||
    state.status.kind === "engine-delaying";
  const isPremoveMode = isEngineThinking;

  const currentPos = useMemo(
    () =>
      positionAfter(
        state.initialFen,
        state.history.slice(0, state.cursor).map((h) => h.move),
      ),
    [state.initialFen, state.history, state.cursor],
  );

  // While the engine is thinking the side to move is the engine's, so matching
  // against `currentPos` offers the engine's moves rather than the human's.
  // Typed premoves are matched on a turn-swapped board so SAN still renders;
  // the fully relaxed premove set (rays through enemy pieces) is pointer-only.
  const matchPos = useMemo(() => {
    if (!isPremoveMode || currentPos.turn === state.humanColor) return currentPos;
    const swapped = currentPos.clone();
    swapped.turn = state.humanColor;
    return swapped;
  }, [currentPos, isPremoveMode, state.humanColor]);

  const legals = useMemo(() => legalMoves(matchPos), [matchPos]);
  const notationState = matchPrefix(buffer, legals, matchPos);

  useEffect(() => {
    // Keep focused
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (notationState.exactMatch && controller) {
        const ok = controller.makeMove(notationState.exactMatch);
        if (ok) {
          setBuffer("");
        } else {
          triggerShake();
        }
      } else {
        triggerShake();
      }
    } else if (e.key === "Escape") {
      if (buffer) {
        setBuffer("");
      } else if (controller) {
        controller.clearPremoves();
        controller.setSelectedSquare(null);
      }
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 220);
  };

  const candidateSans = notationState.candidates
    .slice(0, 8)
    .map((m) => toSan(currentPos, m));
  const remainingCount = Math.max(0, notationState.candidates.length - 8);

  const chevronColor = notationState.exactMatch
    ? isPremoveMode
      ? "var(--premove)"
      : "var(--accent-bright)"
    : "var(--text-dim)";

  return (
    <div
      style={{
        width: "100%",
        height: "76px",
        minHeight: "76px",
        maxHeight: "76px",
        flexShrink: 0,
        boxSizing: "border-box",
        background: "var(--surface)",
        border: `1px solid ${isShaking ? "var(--error)" : notationState.exactMatch ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "var(--sp-2) var(--sp-4)",
        fontFamily: "var(--font-mono)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        animation: isShaking ? "shake 220ms ease-in-out" : "none",
        transition: "border-color var(--dur-fast) ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: "var(--size-lg)",
        }}
      >
        <span
          style={{
            color: chevronColor,
            marginRight: "var(--sp-2)",
            fontWeight: "bold",
          }}
        >
          ▸
        </span>
        <input
          ref={inputRef}
          type="text"
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Enter move in SAN notation"
          placeholder={isPremoveMode ? "premove..." : "e4, Nf3..."}
          style={{
            width: "100%",
            color: isPremoveMode ? "var(--premove)" : "var(--text)",
            outline: "none",
            background: "transparent",
          }}
        />
        <span
          style={{
            fontSize: "var(--size-xs)",
            color: "var(--text-faint)",
            whiteSpace: "nowrap",
            marginLeft: "var(--sp-2)",
          }}
        >
          [↵ move]
        </span>
      </div>

      <div
        style={{
          height: "20px",
          lineHeight: "20px",
          fontSize: "var(--size-sm)",
          color: "var(--text-dim)",
          marginTop: "var(--sp-1)",
          visibility: buffer ? "visible" : "hidden",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {candidateSans.join("   ")}
        {remainingCount > 0 && (
          <span style={{ color: "var(--text-faint)" }}>
            {" "}
            +{remainingCount} more
          </span>
        )}
        {notationState.ambiguous && (
          <span
            style={{ color: "var(--warning)", marginLeft: "var(--sp-2)" }}
          >
            Type file or piece to specify
          </span>
        )}
      </div>
    </div>
  );
}
