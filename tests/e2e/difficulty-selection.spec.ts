import { test, expect } from '@playwright/test';
import { startGame } from './helpers';

test.describe('Difficulty Selection E2E', () => {
  test('allows selecting different engine difficulty levels', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const ladder = page.getByRole('group', { name: 'Engine level' });
    await expect(ladder).toBeVisible();

    // The ladder is eight rungs, and it lives on the setup panel: picking one
    // records the choice rather than restarting anything. The engine's own row
    // reports the level from the moment it is chosen.
    await ladder.getByLabel(/^Level 1,/).click();
    await expect(page.getByText('level 1 ·')).toBeVisible();

    await ladder.getByLabel(/^Level 3,/).click();
    await expect(page.getByText('level 3 ·')).toBeVisible();

    // The game that starts is the one the ladder was left set to, and the
    // panel gives its place back to the transcript.
    await startGame(page);
    await expect(page.getByText('level 3 ·')).toBeVisible();
    await expect(ladder).toHaveCount(0);
  });
});
