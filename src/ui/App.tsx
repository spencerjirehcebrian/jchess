import { useCallback, useState, useEffect } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { createStockfishEngine } from "../engine/stockfish";
import { isSearchCancelled } from "../engine/types";
import { restoreFromPgn } from "../core/pgn";
import {
  StoredGame,
  deleteGame,
  loadResumableGame,
  saveGame,
} from "../storage";
import { THEMES, applyThemeToCss } from "../render/voxel/palette";

import { BoardCanvas } from "./BoardCanvas";
import { NotationInput } from "./NotationInput";
import { MoveList } from "./MoveList";
import { DifficultyPicker } from "./DifficultyPicker";
import { GameControls } from "./GameControls";
import { PlayerRow } from "./PlayerRow";
import { SystemLine } from "./SystemLine";
import { ResultBanner } from "./ResultBanner";
import { SettingsPanel } from "./SettingsPanel";
import { ResumePrompt } from "./ResumePrompt";

export function App() {
  const state = useGameStore();
  const [controller, setController] = useState<GameController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [resumable, setResumable] = useState<StoredGame | null>(null);

  useEffect(() => {
    const activeTheme = state.theme ? THEMES[state.theme] : THEMES.lacquer;
    if (activeTheme) applyThemeToCss(activeTheme);

    const engine = createStockfishEngine();
    const ctrl = new GameController(useGameStore as any, engine);
    setController(ctrl);

    engine
      .init()
      .then(() => {
        ctrl.startNewGame();
      })
      .catch((err) => {
        // Unmounting (or StrictMode's double-invoke) disposes the engine
        // mid-handshake; that is an intentional teardown, not a failure.
        if (isSearchCancelled(err)) return;
        console.error("Engine init error:", err);
      });

    // Asked once, at boot. A fresh game starts underneath either way, so the
    // board is never empty while the question is on screen — and if there is
    // nothing to resume, or no storage at all, nothing appears.
    void loadResumableGame().then((game) => {
      if (game && restoreFromPgn(game.pgn)) setResumable(game);
    });

    return () => {
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

  const resumeStoredGame = useCallback(() => {
    const game = resumable;
    setResumable(null);
    if (!game || !controller) return;

    const restored = restoreFromPgn(game.pgn);
    if (!restored) return;

    controller.resumeGame(restored, {
      id: game.id,
      humanColor: game.humanColor,
      difficulty: game.difficulty,
    });
  }, [resumable, controller]);

  const discardStoredGame = useCallback(() => {
    const game = resumable;
    setResumable(null);
    if (game) void deleteGame(game.id);
  }, [resumable]);

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

          <MoveList controller={controller} />

          {state.status.kind === "over" && (
            <ResultBanner
              result={state.status.result}
              controller={controller}
            />
          )}

          <SystemLine />

          <PlayerRow side="human" />

          <div style={{ borderTop: "1px solid var(--border)" }}>
            <DifficultyPicker controller={controller} />
          </div>

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

      {resumable && (
        <ResumePrompt
          game={resumable}
          onResume={resumeStoredGame}
          onDiscard={discardStoredGame}
        />
      )}
    </div>
  );
}
