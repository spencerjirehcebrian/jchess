import { useState, useEffect, useMemo, useRef } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { phaseOf } from "../core/types";
import { positionAfter, legalMoves, toUci } from "../core/rules";
import { matchPrefix } from "../core/san-parser";
import { audioEngine } from "../audio";

interface NotationInputProps {
  controller: GameController | null;
}

export function NotationInput({ controller }: NotationInputProps) {
  const state = useGameStore();
  const [buffer, setBuffer] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isEngineThinking =
    state.status.kind === "engine-thinking" ||
    state.status.kind === "engine-delaying";
  const isPremoveMode = isEngineThinking;

  /*
   * When there is no move to be made, the slot is switched off rather than
   * left offering moves that would be refused.
   *
   * In setup that means every side but white, who moves first and whose typed
   * move starts the game the same way a dragged one does. Once a game is over
   * it means always: the transcript is there to be read, not added to.
   */
  const phase = phaseOf(state.status);
  const isInert =
    phase === "finished" ||
    (phase === "setup" && state.colorChoice !== "white");

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

  // Focus on mount, and again whenever the field wakes up — a disabled input
  // cannot hold focus, so after Start-as-black the caret has to be put back.
  useEffect(() => {
    if (!isInert) inputRef.current?.focus();
  }, [isInert]);

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
    // Heard as well as seen. The shake is 220ms of movement in a field the
    // player is looking away from as they type, and it is suppressed outright
    // under prefers-reduced-motion — where this is the only refusal left.
    audioEngine.playSound("illegal");
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 220);
  };

  // Taken from the parser rather than recomputed. Rendering these against
  // `currentPos` was wrong in premove mode, where the candidates come from a
  // turn-swapped board: chessops disambiguates against the side to move, so two
  // knights that both reached f3 were both offered as "Nf3" — a name that does
  // not identify either of them, and is ambiguous when typed back.
  //
  // A switched-off field offers nothing. The moves it would list belong to
  // whoever is to move on a board the player cannot move on, which is at best
  // noise and at worst an invitation.
  const candidateSans = isInert ? [] : notationState.candidateSans.slice(0, 8);
  const candidateMoves = isInert ? [] : notationState.candidates.slice(0, 8);
  const remainingCount = isInert
    ? 0
    : Math.max(0, notationState.candidates.length - 8);

  const chevronColor = notationState.exactMatch
    ? isPremoveMode
      ? "var(--premove)"
      : "var(--lcd-on)"
    : "var(--lcd-dim)";

  // The shortest candidate that starts with what has been typed. Its tail is
  // painted behind the caret so the completion is legible before it is taken.
  const ghost = (() => {
    if (!buffer || notationState.exactMatch) return "";
    const match = candidateSans.find((san) => san.startsWith(buffer));
    return match ? match.slice(buffer.length) : "";
  })();

  const accentColor = isPremoveMode ? "var(--premove)" : "var(--lcd-on)";

  /*
   * Inverted extrusion, shared with every other recess in the app. This is the
   * one thing you type into, so the light falls the other way and it reads as a
   * slot cut into the material rather than a button sitting on it.
   *
   * Taken as a custom property rather than the .vx-recess class because the
   * focus ring is composed onto the front of the list below, and an inline
   * box-shadow would replace the class's outright.
   */
  const recess = "var(--vx-recess-shadow)";

  /*
   * The native outline is suppressed because clip-path would crop it, so the
   * ring is the only thing marking focus. It matters more here than on a
   * button: the caret is painted by the app, and a caret blinking in a field
   * that is not focused claims you can type into it.
   */
  const stateRing = isShaking
    ? "var(--error)"
    : notationState.exactMatch
      ? accentColor
      : isFocused
        ? "var(--lcd-on)"
        : null;

  return (
    <div
      /*
       * The input line of the same display the transcript is written on. The
       * machine has one screen; this is the part of it you type into.
       *
       * 86, and every term in it is whole: 12 padding + 32 typing row + 8 gap
       * + 22 candidate row + 12 padding. The content fills the box exactly, so
       * `justifyContent: center` distributes nothing and no line box lands on a
       * half pixel. At the old 84 it had one pixel of slack to centre into, and
       * every glyph in the field was resampled by half of it.
       */
      className="vx-lcd"
      style={{
        width: "100%",
        height: "86px",
        minHeight: "86px",
        maxHeight: "86px",
        flexShrink: 0,
        boxSizing: "border-box",
        position: "relative",
        clipPath: "var(--vx-notch)",
        boxShadow: stateRing ? `inset 0 0 0 2px ${stateRing}, ${recess}` : recess,
        padding: "12px 16px",
        fontFamily: "var(--font-data)",
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
          fontSize: "var(--data)",
          // 32, not the --lh-data 22: this row wants air, and 32 against a
          // 28px content height leaves a whole 2px of half-leading.
          lineHeight: "32px",
          height: "32px",
        }}
      >
        {/*
          Pinned to exactly one cell. U+25B8 is not in Departure Mono's latin
          subset, so the browser falls back for it and renders it 13.245px wide
          against the face's true 14px advance — which pushed the input, and so
          every character the user types, onto a fractional x. Giving the mark
          its own cell puts the readout back on the grid regardless of which
          font ends up drawing it.
        */}
        <span
          aria-hidden="true"
          style={{
            color: chevronColor,
            width: "1ch",
            flexShrink: 0,
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
                    color: isPremoveMode ? "var(--premove)" : "var(--lcd-on)",
                  }}
                >
                  {buffer}
                </span>
                <span style={{ color: "var(--lcd-dim)" }}>{ghost}</span>
              </>
            ) : (
              // Offset by one cell so the block caret does not sit on top of
              // the first character of the hint.
              // Exactly one cell, so the block caret sits clear of the hint's
              // first character. 1.2ch was 16.8px and put the hint on a
              // fractional x for the whole of its run.
              <span
                style={{ color: "var(--lcd-dim)", paddingLeft: "1ch" }}
              >
                {phase === "finished"
                  ? "game over"
                  : isInert
                    ? "press start"
                    : isPremoveMode
                      ? "premove"
                      : "e4, Nf3"}
              </span>
            )}
          </span>

          <input
            ref={inputRef}
            type="text"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label="Enter move in algebraic notation"
            aria-describedby="notation-candidates"
            disabled={isInert}
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

          {/*
            Solid block caret, 530ms, sitting after the typed characters.
            Every term is a whole pixel. Departure Mono advances exactly 7/11 em,
            so at --data one cell is 14px and `${n}ch` is always an integer — but
            only while nothing adds tracking to this face, which is why the data
            face carries none anywhere in the app. The old 0.55em/1.05em box was
            12.1 x 23.1px and the 50% + translate centring added another half.
          */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              display: isFocused ? "block" : "none",
              top: "5px",
              left: `${buffer.length}ch`,
              width: "14px",
              height: "22px",
              background: accentColor,
              animation: "vx-caret 1060ms steps(1) infinite",
              pointerEvents: "none",
            }}
          />
        </span>

        <span
          style={{
            fontSize: "var(--data-xs)",
            lineHeight: "var(--lh-data-xs)",
            color: "var(--lcd-dim)",
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
          height: "22px",
          lineHeight: "var(--lh-data-xs)",
          fontSize: "var(--data-xs)",
          color: "var(--lcd-dim)",
          marginTop: "var(--sp-2)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {candidateSans.map((san, i) => (
          // Keyed on the move, not its label: a SAN is a name for a move and
          // names are the thing that just went wrong here.
          <span
            key={toUci(candidateMoves[i]!)}
            style={{ marginRight: "var(--sp-3)" }}
          >
            <span style={{ color: "var(--lcd-on)" }}>{buffer}</span>
            <span style={{ color: "var(--lcd-dim)" }}>
              {san.startsWith(buffer) ? san.slice(buffer.length) : san}
            </span>
          </span>
        ))}
        {remainingCount > 0 && (
          <span style={{ color: "var(--lcd-dim)" }}>
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
