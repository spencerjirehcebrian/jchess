import { expect, type Page } from "@playwright/test";

/**
 * Gets a game onto the board.
 *
 * The app opens on the setup panel now — there is no game until one is asked
 * for — so every spec that needs a position to play with starts here rather
 * than assuming the board is live on load.
 *
 * White is the default because it is the only side that leaves the player to
 * move immediately; picking black hands the first move to the engine, which is
 * a wait, not a state worth making every test sit through.
 */
export async function startGame(
  page: Page,
  options: { color?: "White" | "Black" | "Random" } = {},
): Promise<void> {
  if (options.color) {
    await page
      .getByRole("button", { name: new RegExp(`^${options.color}$`, "i") })
      .click();
  }

  await page.getByRole("button", { name: /^Start game$/i }).click();

  if (!options.color || options.color === "White") {
    await expect(page.getByText("Your move")).toBeVisible();
  }
}
