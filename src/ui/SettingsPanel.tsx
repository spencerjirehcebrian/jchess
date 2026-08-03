import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { THEMES } from "../render/voxel/palette";

interface SettingsPanelProps {
  controller?: GameController | null;
  onClose: () => void;
}

export function SettingsPanel({ controller, onClose }: SettingsPanelProps) {
  const currentTheme = useGameStore((s) => s.theme) ?? "oxide";
  const currentMaxPremoves = useGameStore((s) => s.maxPremoves) ?? 3;
  const currentBoardSize = useGameStore((s) => s.boardSize) ?? "normal";

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
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
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
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--size-lg)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              cursor: "pointer",
              color: "var(--text-dim)",
              fontSize: "var(--size-lg)",
            }}
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
          <div>
            <label
              htmlFor="settings-board-size"
              style={{
                display: "block",
                fontSize: "var(--size-sm)",
                color: "var(--text-dim)",
                marginBottom: "var(--sp-1)",
              }}
            >
              Board Size
            </label>
            <select
              id="settings-board-size"
              value={currentBoardSize}
              onChange={(e) =>
                controller?.setBoardSize(
                  e.target.value as "compact" | "normal" | "large" | "full",
                )
              }
              style={{
                width: "100%",
                padding: "var(--sp-2)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius)",
              }}
            >
              <option value="compact" style={optionStyle}>
                Compact (600px max)
              </option>
              <option value="normal" style={optionStyle}>
                Normal (720px max)
              </option>
              <option value="large" style={optionStyle}>
                Large (900px max)
              </option>
              <option value="full" style={optionStyle}>
                Full (Maximum / Widescreen)
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-max-premoves"
              style={{
                display: "block",
                fontSize: "var(--size-sm)",
                color: "var(--text-dim)",
                marginBottom: "var(--sp-1)",
              }}
            >
              Max Premoves
            </label>
            <select
              id="settings-max-premoves"
              value={currentMaxPremoves}
              onChange={(e) =>
                controller?.setMaxPremoves(parseInt(e.target.value, 10))
              }
              style={{
                width: "100%",
                padding: "var(--sp-2)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius)",
              }}
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
              htmlFor="settings-theme"
              style={{
                display: "block",
                fontSize: "var(--size-sm)",
                color: "var(--text-dim)",
                marginBottom: "var(--sp-1)",
              }}
            >
              Theme
            </label>
            <select
              id="settings-theme"
              value={currentTheme}
              onChange={(e) => controller?.setTheme(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--sp-2)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius)",
              }}
            >
              {Object.values(THEMES).map((th) => (
                <option key={th.id} value={th.id} style={optionStyle}>
                  {th.label} {th.id === "oxide" ? "(default)" : ""}
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
          onClick={onClose}
          style={{
            marginTop: "var(--sp-6)",
            width: "100%",
            padding: "var(--sp-2)",
            background: "var(--accent)",
            color: "var(--bg)",
            fontWeight: "bold",
            borderRadius: "var(--radius)",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
