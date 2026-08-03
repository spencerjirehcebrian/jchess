import { test, expect } from '@playwright/test';

test.describe('App Initialization E2E', () => {
  test('loads jchess application and renders primary UI elements', async ({ page }) => {
    await page.goto('/');

    // Verify header title
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toHaveText(/jchess/i);

    // Verify initial status bar text
    const statusBar = page.locator('main').locator('text=Your move');
    await expect(statusBar).toBeVisible();

    // Verify 3D board canvas element exists
    const canvas = page.locator('canvas[aria-label="Chess board view"]');
    await expect(canvas).toBeVisible();

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
