import { test, expect } from '@playwright/test';
import { startGame } from './helpers';

test.describe('Notation Input and Move Execution E2E', () => {
  /*
   * Playing white, the first move is the Start key. The board and the field
   * are both live on the setup panel, and making a move is a clearer way of
   * saying "begin" than pressing a button that only gets you to the same
   * place — so it starts the game and lands the move in one gesture.
   */
  test('starts the game on the first move typed as white', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Start game$/i })).toBeVisible();

    const input = page.locator('input[aria-label="Enter move in algebraic notation"]');
    await input.fill('e4');
    await input.press('Enter');

    await expect(page.locator('[aria-label="Move list"]')).toContainText('e4');
    // The panel is gone and the key has become the one that ends a game.
    await expect(page.getByRole('button', { name: /^Start game$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Resign$/i })).toBeVisible();
  });

  test('executes moves via SAN input field', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    const input = page.locator('input[aria-label="Enter move in algebraic notation"]');
    await input.fill('e4');
    await input.press('Enter');

    // Input should clear after successful move
    await expect(input).toHaveValue('');

    // Move list should contain 1. e4
    await expect(page.locator('main')).toContainText('1.');
    await expect(page.locator('main')).toContainText('e4');
  });

  test('handles invalid move input without applying move', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    const input = page.locator('input[aria-label="Enter move in algebraic notation"]');
    await input.fill('e9');
    await input.press('Enter');

    // Invalid move should leave input text unchanged
    await expect(input).toHaveValue('e9');
    await expect(page.getByText('Play a move to begin')).toBeVisible();
  });
});
