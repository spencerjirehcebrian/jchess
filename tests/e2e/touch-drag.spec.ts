import { test, expect } from "@playwright/test";
import { startGame } from "./helpers";

/**
 * Drag-to-move was only ever verified with synthetic mouse events. This is the
 * regression that a finger can move a piece at all — the feel of it is not
 * something a browser test can see.
 *
 * The events are dispatched by hand rather than through `page.touchscreen`,
 * which can tap but cannot express a drag. Squares live in a WebGL scene, so
 * their screen positions come from the renderer's own projection, exposed on
 * the canvas in dev builds.
 */

const E2 = 12;
const E4 = 28;

test.describe("Touch drag", () => {
  test("a finger can drag a pawn from e2 to e4", async ({ page }) => {
    await page.goto("/");
    await startGame(page);

    const canvas = page.locator('canvas[aria-label="Chess board view"]');
    await expect(canvas).toBeVisible();

    const moved = await canvas.evaluate(
      async (el, { from, to }) => {
        const c = el as HTMLCanvasElement & {
          __squareToScreen?: (sq: number) => { x: number; y: number };
        };
        if (!c.__squareToScreen) return "no-projection";

        const rect = c.getBoundingClientRect();
        const at = (sq: number) => {
          const p = c.__squareToScreen!(sq);
          return { x: rect.left + p.x, y: rect.top + p.y };
        };

        const fire = (type: string, x: number, y: number) => {
          c.dispatchEvent(
            new PointerEvent(type, {
              pointerId: 1,
              pointerType: "touch",
              isPrimary: true,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              button: 0,
              buttons: type === "pointerup" ? 0 : 1,
            }),
          );
        };

        const start = at(from);
        const end = at(to);

        fire("pointerdown", start.x, start.y);

        // Stepped, so the drag crosses the touch threshold the way a finger
        // does rather than teleporting past it in one event.
        const steps = 8;
        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps;
          fire(
            "pointermove",
            start.x + (end.x - start.x) * t,
            start.y + (end.y - start.y) * t,
          );
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }

        fire("pointerup", end.x, end.y);
        return "dispatched";
      },
      { from: E2, to: E4 },
    );

    expect(moved).toBe("dispatched");

    await expect(page.locator('[aria-label="Move list"]')).toContainText("e4");
  });
});
