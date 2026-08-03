import { test, expect } from '@playwright/test';

test.describe('Notation Input and Move Execution E2E', () => {
  test('executes moves via SAN input field', async ({ page }) => {
    await page.goto('/');

    // Wait for engine setup to finish and human turn to begin
    await expect(page.getByText('Your move')).toBeVisible();

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

    // Wait for human turn
    await expect(page.getByText('Your move')).toBeVisible();

    const input = page.locator('input[aria-label="Enter move in algebraic notation"]');
    await input.fill('e9');
    await input.press('Enter');

    // Invalid move should leave input text unchanged
    await expect(input).toHaveValue('e9');
    await expect(page.getByText('Play a move to begin')).toBeVisible();
  });
});
