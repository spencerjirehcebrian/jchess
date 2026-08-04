import { useEffect, useRef } from "react";
import { Color, Role } from "../core/types";
import { useGameStore } from "../store";
import { THEMES } from "../render/voxel/palette";
import { pieceSpriteUrl } from "../render/voxel/sprite";

export type PromotionRole = Exclude<Role, "pawn" | "king">;

const CHOICES: {
  role: PromotionRole;
  key: string;
  glyph: Record<Color, string>;
}[] = [
  { role: "queen", key: "q", glyph: { white: "♕", black: "♛" } },
  { role: "rook", key: "r", glyph: { white: "♖", black: "♜" } },
  { role: "bishop", key: "b", glyph: { white: "♗", black: "♝" } },
  { role: "knight", key: "n", glyph: { white: "♘", black: "♞" } },
];

interface PromotionPickerProps {
  color: Color;
  /** Canvas-relative pixel position of the destination square. */
  anchor: { x: number; y: number };
  onSelect: (role: PromotionRole) => void;
  onCancel: () => void;
}

/**
 * Promotion chooser shown before the move is committed. Without it, clicking
 * the last rank silently auto-queens and underpromotion is unreachable with
 * the pointer.
 */
export function PromotionPicker({
  color,
  anchor,
  onSelect,
  onCancel,
}: PromotionPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const queenRef = useRef<HTMLButtonElement | null>(null);
  const themeId = useGameStore((s) => s.theme) ?? "lacquer";
  const theme = THEMES[themeId] ?? THEMES.lacquer!;
  const palette = color === "white" ? theme.white : theme.black;

  useEffect(() => {
    queenRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      const choice = CHOICES.find((c) => c.key === e.key.toLowerCase());
      if (choice) {
        e.preventDefault();
        onSelect(choice.role);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onSelect, onCancel]);

  return (
    <div
      ref={containerRef}
      className="vx-lift"
      role="dialog"
      aria-label="Choose promotion piece"
      style={{
        position: "absolute",
        left: anchor.x,
        top: anchor.y,
        transform: "translate(-50%, -110%)",
        display: "flex",
        gap: "var(--sp-1)",
        padding: "var(--sp-1)",
        zIndex: 20,
      }}
    >
      {CHOICES.map((choice) => {
        // The choices are drawn from the same voxel grids as the board, so the
        // picker shows the piece the player is actually about to get.
        const sprite = pieceSpriteUrl(choice.role, palette, 3);
        return (
          <button
            key={choice.role}
            ref={choice.role === "queen" ? queenRef : undefined}
            type="button"
            className="vx-button"
            aria-label={`Promote to ${choice.role}`}
            onClick={() => onSelect(choice.role)}
            style={{
              width: "48px",
              minHeight: "56px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "2px",
              padding: "var(--sp-1)",
            }}
          >
            {sprite ? (
              <img
                src={sprite}
                alt=""
                style={{
                  height: "34px",
                  width: "auto",
                  imageRendering: "pixelated",
                }}
              />
            ) : (
              // A system glyph, so it is off both pixel grids by nature; sized
              // to sit where the sprite would rather than to any type scale.
              <span style={{ fontSize: "24px", lineHeight: "24px" }}>
                {choice.glyph[color]}
              </span>
            )}
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-legend)",
                fontSize: "var(--legend-xs)",
                lineHeight: "var(--lh-legend-xs)",
                color: "var(--text-faint)",
                textTransform: "uppercase",
              }}
            >
              {choice.key}
            </span>
          </button>
        );
      })}
    </div>
  );
}
