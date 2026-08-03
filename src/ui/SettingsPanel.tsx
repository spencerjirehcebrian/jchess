interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
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
              defaultValue="3"
              style={{
                width: "100%",
                padding: "var(--sp-2)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius)",
              }}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3 (default)</option>
              <option value="5">5</option>
            </select>
          </div>

          <div>
            <label
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
              defaultValue="oxide"
              style={{
                width: "100%",
                padding: "var(--sp-2)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius)",
              }}
            >
              <option value="oxide">Oxide (default)</option>
              <option value="monochrome">Monochrome</option>
              <option value="forest">Forest</option>
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
            <p>Voxel Chess v1.0.0</p>
            <p style={{ marginTop: "var(--sp-1)" }}>
              Stockfish engine engine GPL-3.0.{" "}
              <a href="/licenses/GPL-3.0.txt" target="_blank" rel="noreferrer">
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
