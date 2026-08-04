import { test, expect } from "@playwright/test";
import { startGame } from "./helpers";

test.describe("Game Controls E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("executes action controls: Take back, Flip board", async ({ page }) => {
    await startGame(page);

    // Click Flip button
    const flipButton = page.getByRole("button", { name: /^Flip board$/i });
    await expect(flipButton).toBeVisible();
    await flipButton.click();

    // Take back is disabled on a fresh game: there is no human ply to undo.
    const takebackButton = page.getByRole("button", { name: /^Take back$/i });
    await expect(takebackButton).toBeVisible();
    await expect(takebackButton).toBeDisabled();
  });

  /*
   * The whole loop, once round: choose, play, concede, read the result, put it
   * away, and find the panel again with the choices still on it. The two
   * irreversible keys are never on the plate together, which is the point of
   * there being only one.
   */
  test("carries the machine from setup through a game and back", async ({
    page,
  }) => {
    await page.getByRole("group", { name: "Engine level" }).getByLabel(/^Level 4,/).click();
    await startGame(page);

    // Resigning takes two presses; the first only arms the key.
    await page.getByRole("button", { name: /^Resign$/i }).click();
    await page.getByRole("button", { name: /^Resign\?$/i }).click();

    // The result, said from where the player is sitting.
    await expect(page.getByRole("dialog", { name: "Game result" })).toBeVisible();
    await expect(page.getByText("YOU LOST")).toBeVisible();
    await expect(page.getByText("by resignation")).toBeVisible();

    // Dismissing uncovers the game rather than replacing it: the transcript is
    // still there to be walked through.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Game result" })).toHaveCount(0);

    await expect(page.getByRole("button", { name: /^Resign$/i })).toHaveCount(0);
    await page.getByRole("button", { name: /^New game$/i }).click();

    // Back on the panel, with the level it was left set to.
    await expect(page.getByRole("button", { name: /^Start game$/i })).toBeVisible();
    await expect(page.getByText("level 4 ·")).toBeVisible();
  });

  test("opens and closes settings modal panel", async ({ page }) => {
    const settingsBtn = page.getByRole("button", { name: /^Settings$/i }).first();
    await settingsBtn.click();

    // Verify settings modal title and options
    await expect(page.getByRole("heading", { name: "SETTINGS" })).toBeVisible();
    await expect(page.getByText(/Max premoves/i)).toBeVisible();
    await expect(page.getByText(/^Theme$/i)).toBeVisible();
    await expect(
      page.getByText("Stockfish engine engine GPL-3.0."),
    ).toBeVisible();

    // Close settings modal
    const closeBtn = page.getByRole("button", { name: /^Close$/i });
    await closeBtn.click();

    await expect(
      page.getByRole("heading", { name: "SETTINGS" }),
    ).not.toBeVisible();
  });

  test("resizes board via the size stepper in settings", async ({ page }) => {
    const wrapper = page.locator('canvas[aria-label="Chess board view"]').locator("..");
    await expect(wrapper).toHaveCSS("max-width", "100%");

    // Board size is set once and forgotten, so the stepper lives in settings
    // rather than holding space in the header.
    await page.getByRole("button", { name: /^Settings$/i }).click();

    const decBtn = page.getByRole("button", { name: "Make the board smaller" });
    await expect(decBtn).toBeVisible();
    await decBtn.click();
    await expect(wrapper).toHaveCSS("max-width", "90%");

    const incBtn = page.getByRole("button", { name: "Make the board larger" });
    await incBtn.click();
    await expect(wrapper).toHaveCSS("max-width", "100%");
  });
});
