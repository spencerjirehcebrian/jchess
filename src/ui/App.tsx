import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { createStockfishEngine } from "../engine/stockfish";
import { isSearchCancelled } from "../engine/types";
import { restoreFromPgn } from "../core/pgn";
import { loadResumableGame, saveGame } from "../storage";
import { THEMES, applyThemeToCss } from "../render/voxel/palette";

import { BoardCanvas } from "./BoardCanvas";
import { NotationInput } from "./NotationInput";
import { MoveList } from "./MoveList";
import { EvalStrip } from "./EvalStrip";
import { SetupPanel } from "./SetupPanel";
import { GameControls } from "./GameControls";
import { PlayerRow } from "./PlayerRow";
import { SystemLine } from "./SystemLine";
import { ResultOverlay } from "./ResultOverlay";
import { SettingsPanel } from "./SettingsPanel";

export function App() {
  const state = useGameStore();
  const [controller, setController] = useState<GameController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  /*
   * Which game's result has already been read. Keyed by game rather than held
   * as a bare boolean, so dismissing one result cannot swallow the next: every
   * game carries a fresh id, and a resumed game that was already over shows
   * its result again — which is right, because it has not been shown here.
   */
  const [resultSeenFor, setResultSeenFor] = useState<string | null>(null);

  useEffect(() => {
    const activeTheme = state.theme ? THEMES[state.theme] : THEMES.lacquer;
    if (activeTheme) applyThemeToCss(activeTheme);

    const engine = createStockfishEngine();
    const ctrl = new GameController(useGameStore as any, engine);
    setController(ctrl);

    let disposed = false;

    /*
     * One decision, taken once, after both answers are in.
     *
     * The engine handshake and the storage probe used to race: a game was
     * started the moment the engine was ready while the stored game arrived on
     * its own schedule. That was survivable while resuming was a question the
     * player answered, but not now that it happens silently — whichever landed
     * last would win. Waiting for both settles it by construction.
     *
     * An unfinished game is simply put back, without asking. The store already
     * boots in setup, so the other branches have nothing to do: no stored
     * game, no storage at all, or an engine that never came up all land on the
     * setup panel, which is where a player with no game in progress belongs.
     */
    void Promise.allSettled([engine.init(), loadResumableGame()]).then(
      ([initResult, storedResult]) => {
        // Unmounting — or StrictMode's double-invoke — has already torn this
        // controller down; whatever it decided is about a machine that is gone.
        if (disposed) return;

        if (initResult.status === "rejected") {
          // A disposal mid-handshake is an intentional teardown, not a failure.
          if (!isSearchCancelled(initResult.reason)) {
            console.error("Engine init error:", initResult.reason);
          }
          return;
        }

        const game =
          storedResult.status === "fulfilled" ? storedResult.value : null;
        if (!game) return;

        const restored = restoreFromPgn(game.pgn);
        if (!restored) return;

        ctrl.resumeGame(restored, {
          id: game.id,
          humanColor: game.humanColor,
          difficulty: game.difficulty,
          timeControlId: game.timeControlId,
          clockRemaining: game.clockRemaining,
        });
      },
    );

    return () => {
      disposed = true;
      ctrl.dispose();
      engine.dispose();
    };
  }, []);

  /*
   * Persistence subscribes outside React and writes on every store change; the
   * storage layer owns the debounce, so this is never on the critical path of
   * applying a move. Games in progress and finished games are both written —
   * the record's `completed` flag is what decides whether it is ever offered
   * back — but a game with no moves in it is not worth a record.
   */
  useEffect(() => {
    return useGameStore.subscribe((s) => {
      if (s.history.length > 0) saveGame(s);
    });
  }, []);

  /*
   * Stepping through the game with the arrow keys — which `SystemLine` has been
   * telling players to do since before anything listened for it.
   *
   * `setCursor` already clamps the index and already knows what to do about a
   * search in flight (discard it on the way out of the live position, restart it
   * on the way back), so this only has to decide where to point.
   */
  useEffect(() => {
    if (!controller) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // A dialog owns the keyboard while it is open; browsing the game behind
      // one is not something anybody asked for.
      if (document.querySelector('[role="dialog"]')) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        if (target.tagName === "SELECT" || target.isContentEditable) return;
        // The notation field holds focus almost all the time, so refusing every
        // keystroke aimed at it would mean refusing them nearly always. Arrows
        // move the caret when there is something to move it through, and browse
        // the game when there is not.
        const isTextField =
          target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        if (isTextField && (target as HTMLInputElement).value !== "") return;
      }

      const { cursor, history } = useGameStore.getState();

      switch (e.key) {
        case "ArrowLeft":
          controller.setCursor(cursor - 1);
          break;
        case "ArrowRight":
          controller.setCursor(cursor + 1);
          break;
        case "ArrowUp":
          controller.setCursor(0);
          break;
        case "ArrowDown":
          controller.setCursor(history.length);
          break;
        default:
          return;
      }

      // Only for keys actually handled, so the board's own Escape and the
      // page's scrolling are left alone.
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller]);

  return (
    /*
      The machine. One moulded object standing in the dark room, rather than a
      page with panels on it — so the housing is painted here and `--bg` is left
      to the document underneath, where it stays the room seen around the
      machine and through the aperture the board is set into.
     */
    <div
      className="app-housing"
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "var(--text)",
      }}
    >
      {/* Main Layout */}
      <main
        className="app-main-layout"
        style={{
          maxWidth:
            state.boardSize === "full"
              ? "100%"
              : state.boardSize === "large"
                ? "90%"
                : state.boardSize === "compact"
                  ? "60%"
                  : "75%",
          transition: "max-width var(--dur-base) ease-in-out",
        }}
      >
        {/* Left Column: Board + NotationInput */}
        <div
          className="app-board-column"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div
            className="app-board-stage"
            style={{ flex: 1, position: "relative", minHeight: 0 }}
          >
            <BoardCanvas controller={controller} />

            {state.status.kind === "over" && resultSeenFor !== state.id && (
              <ResultOverlay
                result={state.status.result}
                humanColor={state.humanColor}
                onDismiss={() => setResultSeenFor(state.id)}
              />
            )}
          </div>

          <NotationInput controller={controller} />
        </div>

        {/*
          One instrument, not a stack of cards. The two players bracket the
          transcript and the dividers are hairlines, so the extrusion reads
          once at the scale of a real object instead of four times at card
          scale, where it only looked like noise.
        */}
        <div
          className="app-rail vx-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/*
            The nameplate. It used to be a full-width header bar above both
            columns, which cost the board 56px to say one word. On the rail it
            names the instrument it sits on, and the gold rule beneath it — the
            board's inlay line, continued — still caps the column.
          */}
          {/*
            The model badge, moulded into the top of the deck: the machine's
            name and what it is, the way a tabletop computer carries its model
            number. Stays an <h1> — it is still the page's heading, and the
            responsive spec looks for it at both viewports.
          */}
          <h1
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--sp-3)",
              fontFamily: "var(--font-legend)",
              fontSize: "var(--legend-lg)",
              fontWeight: 700,
              letterSpacing: "3px",
              lineHeight: "var(--lh-legend-lg)",
              textTransform: "uppercase",
              color: "var(--text)",
              padding: "var(--sp-3) var(--sp-3) var(--sp-2)",
              borderBottom: "2px solid var(--accent-dim)",
              flexShrink: 0,
            }}
          >
            jchess
            <span
              style={{
                fontSize: "var(--legend-xs)",
                lineHeight: "var(--lh-legend-xs)",
                letterSpacing: "1px",
                fontWeight: 400,
                color: "var(--text-faint)",
              }}
            >
              model 08
            </span>
          </h1>

          <PlayerRow side="engine" />

          {state.status.kind === "setup" ? (
            /*
              Before there is a game, the transcript's slot holds the choices:
              strength, time, colour. The panel and the record never exist at
              once — starting the game swaps one for the other.
            */
            <SetupPanel controller={controller} />
          ) : (
            <>
              {/*
                Above the transcript rather than below it, so the gauge and the
                column of scores it summarises read as one instrument. Renders
                nothing at all until the game is over.
              */}
              <EvalStrip />

              <MoveList controller={controller} />
            </>
          )}

          <SystemLine />

          <PlayerRow side="human" />

          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: "var(--sp-3)",
            }}
          >
            <GameControls
              controller={controller}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>
        </div>
      </main>

      {isSettingsOpen && (
        <SettingsPanel
          controller={controller}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

    </div>
  );
}
