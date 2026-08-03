import { useEffect, useRef } from "react";
import { Color, Role } from "../core/types";

export type PromotionRole = Exclude<Role, "pawn" | "king">;

const CHOICES: { role: PromotionRole; key: string; glyph: Record<Color, string> }[] = [
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
      role="dialog"
      aria-label="Choose promotion piece"
      style={{
        position: "absolute",
        left: anchor.x,
        top: anchor.y,
        transform: "translate(-50%, -110%)",
        display: "flex",
        gap: "4px",
        padding: "6px",
        borderRadius: "8px",
        background: "var(--surface-raised, #222)",
        border: "1px solid var(--border-strong, #555)",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
        zIndex: 20,
      }}
    >
      {CHOICES.map((choice) => (
        <button
          key={choice.role}
          ref={choice.role === "queen" ? queenRef : undefined}
          type="button"
          aria-label={`Promote to ${choice.role}`}
          onClick={() => onSelect(choice.role)}
          style={{
            width: "40px",
            height: "40px",
            fontSize: "26px",
            lineHeight: 1,
            cursor: "pointer",
            borderRadius: "6px",
            border: "1px solid var(--border, #444)",
            background: "var(--surface, #2c2c2c)",
            color: "var(--text, #eee)",
          }}
        >
          {choice.glyph[color]}
        </button>
      ))}
    </div>
  );
}
