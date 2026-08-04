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
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
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
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.0625rem",
              fontWeight: 700,
              fontStretch: "120%",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--text)",
              padding: "var(--sp-3) var(--sp-3) var(--sp-2)",
              borderBottom: "2px solid var(--accent-dim)",
              flexShrink: 0,
            }}
          >
            jchess
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
