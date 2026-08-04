import { test, expect } from "@playwright/test";
import { startGame } from "./helpers";

/**
 * A reload used to be a question: a dialog offering the last game back. The
 * answer was almost always yes, so it is not asked any more — an unfinished
 * game simply comes back, clock and all.
 */
test.describe("Coming back to a game", () => {
  test("puts an unfinished game back without asking", async ({ page }) => {
    await page.goto("/");
    await startGame(page);

    const input = page.locator(
      'input[aria-label="Enter move in algebraic notation"]',
    );
    await input.fill("e4");
    await input.press("Enter");
    // Wait for the engine's reply, so there is a completed row to recognise.
    await expect(page.getByText("Your move")).toBeVisible();
    const transcript = await page
      .locator('[aria-label="Move list"]')
      .textContent();

    // The write is debounced; give it the window it asks for.
    await page.waitForTimeout(900);
    await page.reload();

    // No question, and the game is already on the board.
    await expect(page.locator('[aria-label="Move list"]')).toContainText("e4");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Start game$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Resign$/i })).toBeVisible();
    expect(
      await page.locator('[aria-label="Move list"]').textContent(),
    ).toBe(transcript);
  });

  test("brings the clock back where it was left", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Time control").selectOption("3+2");
    await startGame(page);

    const input = page.locator(
      'input[aria-label="Enter move in algebraic notation"]',
    );
    await input.fill("e4");
    await input.press("Enter");
    await expect(page.getByText("Your move")).toBeVisible();

    const clocks = page.locator("main").getByText(/^\d+:\d{2}$/);
    await expect(clocks).toHaveCount(2);

    await page.waitForTimeout(900);
    await page.reload();

    // Both clocks are back. A resumed game used to come back untimed — the
    // PGN carries no time — so the readouts existing at all is the point.
    await expect(page.locator('[aria-label="Move list"]')).toContainText("e4");
    await expect(clocks).toHaveCount(2);
  });
});
