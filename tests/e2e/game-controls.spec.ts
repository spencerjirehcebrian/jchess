import { test, expect } from "@playwright/test";

test.describe("Game Controls E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("executes action controls: Take back, Flip board, New game", async ({
    page,
  }) => {
    // Click Flip button
    const flipButton = page.getByRole("button", { name: /^Flip board$/i });
    await expect(flipButton).toBeVisible();
    await flipButton.click();

    // Click New Game button
    const newGameButton = page.getByRole("button", { name: /^New game$/i });
    await expect(newGameButton).toBeVisible();
    await newGameButton.click();

    // Verify game reset to initial status
    await expect(page.locator("main").locator("text=Your move")).toBeVisible();

    // Take back is disabled on a fresh game: there is no human ply to undo.
    const takebackButton = page.getByRole("button", { name: /^Take back$/i });
    await expect(takebackButton).toBeVisible();
    await expect(takebackButton).toBeDisabled();
  });

  test("opens and closes settings modal panel", async ({ page }) => {
    const settingsBtn = page.getByRole("button", { name: "Settings" }).first();
    await settingsBtn.click();

    // Verify settings modal title and options
    await expect(page.getByRole("heading", { name: "SETTINGS" })).toBeVisible();
    await expect(page.getByText("Max Premoves")).toBeVisible();
    await expect(page.getByText("Theme")).toBeVisible();
    await expect(
      page.getByText("Stockfish engine engine GPL-3.0."),
    ).toBeVisible();

    // Close settings modal
    const closeBtn = page.getByRole("button", { name: "Close", exact: true });
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
    await page.getByRole("button", { name: "Settings" }).click();

    const decBtn = page.getByRole("button", { name: "Make the board smaller" });
    await expect(decBtn).toBeVisible();
    await decBtn.click();
    await expect(wrapper).toHaveCSS("max-width", "90%");

    const incBtn = page.getByRole("button", { name: "Make the board larger" });
    await incBtn.click();
    await expect(wrapper).toHaveCSS("max-width", "100%");
  });
});
