import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { createStockfishEngine } from "../engine/stockfish";
import { isSearchCancelled } from "../engine/types";
import { THEMES, applyThemeToCss } from "../render/voxel/palette";

import { BoardCanvas } from "./BoardCanvas";
import { NotationInput } from "./NotationInput";
import { MoveList } from "./MoveList";
import { DifficultyPicker } from "./DifficultyPicker";
import { GameControls } from "./GameControls";
import { StatusBar } from "./StatusBar";
import { ResultBanner } from "./ResultBanner";
import { SettingsPanel } from "./SettingsPanel";
import { BoardSizeControls } from "./BoardSizeControls";
import { CapturedTray } from "./CapturedTray";

export function App() {
  const state = useGameStore();
  const [controller, setController] = useState<GameController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

    return () => {
      engine.dispose();
    };
  }, []);

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
      {/* Header. The gold rule beneath it is the board's inlay line, continued. */}
      <header
        style={{
          height: "56px",
          padding: "0 var(--sp-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid var(--accent-dim)",
          background: "var(--surface)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "var(--sp-4)",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.0625rem",
              fontWeight: 700,
              fontStretch: "120%",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--text)",
            }}
          >
            jchess
          </h1>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-sm)",
              color: "var(--text-faint)",
            }}
          >
            level {state.difficulty}
          </span>
        </div>

        {/* Hidden on small screens, where the board is full-width regardless. */}
        <div className="app-header-size">
          <BoardSizeControls controller={controller} />
        </div>
      </header>

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

        {/* Right Rail: Instrumentation */}
        <div
          className="app-rail"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <StatusBar />

          {state.status.kind === "over" && (
            <ResultBanner
              result={state.status.result}
              controller={controller}
            />
          )}

          <MoveList controller={controller} />

          <CapturedTray />

          <DifficultyPicker controller={controller} />

          <GameControls
            controller={controller}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
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
