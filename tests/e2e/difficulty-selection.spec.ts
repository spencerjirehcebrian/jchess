import { test, expect } from '@playwright/test';

test.describe('Difficulty Selection E2E', () => {
  test('allows selecting different engine difficulty levels', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const ladder = page.getByRole('group', { name: 'Engine level' });
    await expect(ladder).toBeVisible();

    // The ladder is eight rungs; picking one starts a new game at that level
    // and the engine's own row reports it.
    await ladder.getByLabel(/^Level 1,/).click();
    await expect(page.getByText('level 1 ·')).toBeVisible();

    await ladder.getByLabel(/^Level 3,/).click();
    await expect(page.getByText('level 3 ·')).toBeVisible();
  });
});
