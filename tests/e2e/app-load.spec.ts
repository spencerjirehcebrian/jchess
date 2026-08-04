import { test, expect } from '@playwright/test';
import { startGame } from './helpers';

test.describe('App Initialization E2E', () => {
  test('opens on the setup panel with nothing yet started', async ({ page }) => {
    await page.goto('/');

    // Verify header title
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toHaveText(/jchess/i);

    // Verify 3D board canvas element exists
    const canvas = page.locator('canvas[aria-label="Chess board view"]');
    await expect(canvas).toBeVisible();

    // The choices the Start key is about to consume: strength, time, side.
    await expect(page.getByRole('group', { name: 'Engine level' })).toBeVisible();
    await expect(page.getByLabel('Time control')).toBeVisible();
    await expect(page.getByRole('button', { name: /^White$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Random$/i })).toBeVisible();

    // One key carries the machine between its states, and here it says Start.
    await expect(page.getByRole('button', { name: /^Start game$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resign$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^New game$/i })).toHaveCount(0);

    // No game means no transcript standing in for one.
    await expect(page.getByText('Play a move to begin')).toHaveCount(0);
  });

  test('shows the board and transcript once a game is started', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    // Verify initial status bar text
    const statusBar = page.locator('main').locator('text=Your move');
    await expect(statusBar).toBeVisible();

    // Verify notation input box exists with its hint. The hint is painted in
    // an overlay rather than set as a native placeholder, because the field
    // also renders a block caret and an inline ghost completion over the same
    // text run.
    const input = page.locator('input[aria-label="Enter move in algebraic notation"]');
    await expect(input).toBeVisible();
    await expect(page.getByText('e4, Nf3', { exact: true })).toBeVisible();

    // Verify move list is present
    await expect(page.getByText('Play a move to begin')).toBeVisible();
  });
});
