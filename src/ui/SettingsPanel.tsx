import { useEffect, useState } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { isStorageAvailable } from "../storage";
import { THEMES } from "../render/voxel/palette";
import { BoardSizeControls } from "./BoardSizeControls";

interface SettingsPanelProps {
  controller?: GameController | null;
  onClose: () => void;
}

export function SettingsPanel({ controller, onClose }: SettingsPanelProps) {
  const currentTheme = useGameStore((s) => s.theme) ?? "lacquer";
  const currentMaxPremoves = useGameStore((s) => s.maxPremoves) ?? 3;
  const [storageReady, setStorageReady] = useState<boolean | null>(null);

  useEffect(() => {
    void isStorageAvailable().then(setStorageReady);
  }, []);

  const optionStyle: React.CSSProperties = {
    background: "var(--surface-raised)",
    color: "var(--text)",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="vx-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          padding: "var(--sp-6)",
          width: "90%",
          maxWidth: "480px",
          color: "var(--text)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--sp-4)",
            paddingBottom: "var(--sp-3)",
            borderBottom: "2px solid var(--accent-dim)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--size-lg)",
              fontWeight: 700,
              fontStretch: "120%",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
            }}
          >
            Settings
          </h2>
          <button
            className="vx-button"
            data-size="sm"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-4)",
          }}
        >
          {/*
            The stepper used to sit in the header, duplicating a select that
            lived here. Board size is set once and forgotten, so it belongs in
            settings and the header keeps its space for the wordmark.
          */}
          <BoardSizeControls controller={controller ?? null} />

          <div>
            <label
              className="vx-label"
              htmlFor="settings-max-premoves"
              style={{ display: "block", marginBottom: "var(--sp-2)" }}
            >
              Max premoves
            </label>
            <select
              className="vx-select"
              id="settings-max-premoves"
              value={currentMaxPremoves}
              onChange={(e) =>
                controller?.setMaxPremoves(parseInt(e.target.value, 10))
              }
            >
              <option value="1" style={optionStyle}>
                1
              </option>
              <option value="2" style={optionStyle}>
                2
              </option>
              <option value="3" style={optionStyle}>
                3 (default)
              </option>
              <option value="5" style={optionStyle}>
                5
              </option>
            </select>
          </div>

          <div>
            <label
              className="vx-label"
              htmlFor="settings-theme"
              style={{ display: "block", marginBottom: "var(--sp-2)" }}
            >
              Theme
            </label>
            <select
              className="vx-select"
              id="settings-theme"
              value={currentTheme}
              onChange={(e) => controller?.setTheme(e.target.value)}
            >
              {Object.values(THEMES).map((th) => (
                <option key={th.id} value={th.id} style={optionStyle}>
                  {th.label} {th.id === "lacquer" ? "(default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--sp-3)",
              fontSize: "var(--size-xs)",
              color: "var(--text-faint)",
            }}
          >
            {/*
              Stated here rather than raised as an error on boot. Private
              browsing and an exhausted quota are both normal, the game plays
              exactly the same, and the only thing the player loses is the
              offer to come back to it (docs/04-game-core.md).
            */}
            {storageReady === false && (
              <p style={{ marginBottom: "var(--sp-2)" }}>
                Games are not being saved — this browser is not storing data for
                the site. Play continues normally; you will not be offered a
                resume next time.
              </p>
            )}
            <p>jchess v1.0.0</p>
            <p style={{ marginTop: "var(--sp-1)" }}>
              Stockfish engine engine GPL-3.0.{" "}
              <a
                href="/licenses/GPL-3.0.txt"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)" }}
              >
                View Licence
              </a>
            </p>
          </div>
        </div>

        <button
          className="vx-button"
          data-variant="primary"
          onClick={onClose}
          style={{ marginTop: "var(--sp-6)", width: "100%" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
