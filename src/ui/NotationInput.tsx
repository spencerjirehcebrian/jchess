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
    if (!isPremoveMode || currentPos.turn === state.humanColor)
      return currentPos;
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

  // The shortest candidate that starts with what has been typed. Its tail is
  // painted behind the caret so the completion is legible before it is taken.
  const ghost = (() => {
    if (!buffer || notationState.exactMatch) return "";
    const match = candidateSans.find((san) => san.startsWith(buffer));
    return match ? match.slice(buffer.length) : "";
  })();

  const accentColor = isPremoveMode ? "var(--premove)" : "var(--accent)";
  const borderColor = isShaking
    ? "var(--error)"
    : notationState.exactMatch
      ? accentColor
      : "var(--border-strong)";

  return (
    <div
      style={{
        width: "100%",
        height: "84px",
        minHeight: "84px",
        maxHeight: "84px",
        flexShrink: 0,
        boxSizing: "border-box",
        position: "relative",
        background: "var(--voxel-face)",
        clipPath: "var(--vx-notch)",
        boxShadow: `inset 0 2px 0 0 ${borderColor}, inset -2px 0 0 0 var(--voxel-side), inset 0 -2px 0 0 var(--voxel-under)`,
        padding: "var(--sp-3) var(--sp-4)",
        fontFamily: "var(--font-mono)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        animation: isShaking ? "vx-shake 220ms ease-in-out" : "none",
        transition: "box-shadow var(--dur-fast) ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontSize: "var(--size-lg)",
          lineHeight: 1.2,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            color: chevronColor,
            marginRight: "var(--sp-3)",
            transition: "color var(--dur-fast) ease",
          }}
        >
          ▸
        </span>

        {/*
          The input is transparent and sits over a painted copy of the buffer.
          A native caret cannot be a solid block, and the ghost completion has
          to sit inline immediately after the typed text.
        */}
        <span style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
              whiteSpace: "pre",
              overflow: "hidden",
            }}
          >
            {buffer ? (
              <>
                <span
                  style={{
                    color: isPremoveMode ? "var(--premove)" : "var(--text)",
                  }}
                >
                  {buffer}
                </span>
                <span style={{ color: "var(--text-faint)" }}>{ghost}</span>
              </>
            ) : (
              // Offset by one cell so the block caret does not sit on top of
              // the first character of the hint.
              <span
                style={{ color: "var(--text-faint)", paddingLeft: "1.2ch" }}
              >
                {isPremoveMode ? "premove" : "e4, Nf3"}
              </span>
            )}
          </span>

          <input
            ref={inputRef}
            type="text"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Enter move in algebraic notation"
            aria-describedby="notation-candidates"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: "100%",
              color: "transparent",
              caretColor: "transparent",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "inherit",
              position: "relative",
            }}
          />

          {/* Solid block caret, 530ms, sitting after the typed characters. */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: `${buffer.length}ch`,
              transform: "translateY(-50%)",
              width: "0.55em",
              height: "1.05em",
              background: accentColor,
              animation: "vx-caret 1060ms steps(1) infinite",
              pointerEvents: "none",
            }}
          />
        </span>

        <span
          style={{
            fontSize: "var(--size-xs)",
            color: "var(--text-faint)",
            whiteSpace: "nowrap",
            marginLeft: "var(--sp-3)",
          }}
        >
          ↵ move
        </span>
      </div>

      <div
        id="notation-candidates"
        aria-live="polite"
        style={{
          height: "20px",
          lineHeight: "20px",
          fontSize: "var(--size-sm)",
          color: "var(--text-dim)",
          marginTop: "var(--sp-2)",
          visibility: buffer ? "visible" : "hidden",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {candidateSans.map((san) => (
          <span key={san} style={{ marginRight: "var(--sp-3)" }}>
            <span style={{ color: "var(--text)" }}>{buffer}</span>
            <span style={{ color: "var(--text-faint)" }}>
              {san.startsWith(buffer) ? san.slice(buffer.length) : san}
            </span>
          </span>
        ))}
        {remainingCount > 0 && (
          <span style={{ color: "var(--text-faint)" }}>
            +{remainingCount} more
          </span>
        )}
        {notationState.ambiguous && (
          <span style={{ color: "var(--warning)", marginLeft: "var(--sp-2)" }}>
            Type the file or piece to specify
          </span>
        )}
      </div>
    </div>
  );
}
