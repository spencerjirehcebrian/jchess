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

export function App() {
  const state = useGameStore();
  const [controller, setController] = useState<GameController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const activeTheme = state.theme ? THEMES[state.theme] : THEMES.oxide;
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
      {/* Header Bar */}
      <header
        style={{
          height: "56px",
          padding: "0 var(--sp-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--size-md)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            jchess
          </h1>
          <span
            style={{ fontSize: "var(--size-sm)", color: "var(--text-dim)" }}
          >
            level {state.difficulty}
          </span>
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}
        >
          <BoardSizeControls controller={controller} />

          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            style={{
              cursor: "pointer",
              color: "var(--text-dim)",
              fontSize: "var(--size-md)",
              padding: "var(--sp-1) var(--sp-2)",
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            ⚙
          </button>
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
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-3)",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            <BoardCanvas controller={controller} />
          </div>

          <NotationInput controller={controller} />
        </div>

        {/* Right Rail: Instrumentation */}
        <div
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
