import { test, expect } from '@playwright/test';
import { startGame } from './helpers';

/**
 * The system line has always told players to "Press ↓ to return to the game".
 * Nothing listened for it until now, so these assert the instruction is true.
 */
test.describe('History navigation by keyboard', () => {
  /** Plays one move and waits for the engine's reply, leaving two plies. */
  async function playOnePair(page: import('@playwright/test').Page) {
    await page.goto('/');
    await startGame(page);

    const input = page.locator('input[aria-label="Enter move in algebraic notation"]');
    await input.fill('e4');
    await input.press('Enter');
    await expect(input).toHaveValue('');

    // The engine replies, so the row is complete and there is history to walk.
    await expect(page.getByText('Your move')).toBeVisible();
    return input;
  }

  test('steps back and returns to the live position', async ({ page }) => {
    await playOnePair(page);

    // The notation field holds focus, and arrows browse only when it is empty.
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('main')).toContainText('Viewing move');

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('main')).not.toContainText('Viewing move');
  });

  test('jumps to the start of the game', async ({ page }) => {
    await playOnePair(page);

    await page.keyboard.press('ArrowUp');
    await expect(page.locator('main')).toContainText('Viewing move 0');
  });

  test('leaves the caret alone while there is something typed', async ({ page }) => {
    const input = await playOnePair(page);

    // Half a move in the buffer: the arrow belongs to the text field, and
    // browsing away mid-word would discard what the player was typing.
    await input.fill('Nf');
    await page.keyboard.press('ArrowLeft');

    await expect(page.locator('main')).not.toContainText('Viewing move');
    await expect(input).toHaveValue('Nf');
  });
});
