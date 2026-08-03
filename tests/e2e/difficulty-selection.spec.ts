import { test, expect } from '@playwright/test';

test.describe('Difficulty Selection E2E', () => {
  test('allows selecting different engine difficulty levels', async ({ page }) => {
    await page.goto('/');

    // Wait for engine initialization
    await page.waitForTimeout(500);

    // Check level 1 button exists
    const level1Btn = page.getByRole('button', { name: /Level 1 · Beginner/i });
    await expect(level1Btn).toBeVisible();

    await level1Btn.click();

    // Verify header badge updates to level 1
    await expect(page.locator('header')).toContainText('level 1');

    // Select Level 3
    const level3Btn = page.getByRole('button', { name: /Level 3 · Club/i });
    await level3Btn.click();
    await expect(page.locator('header')).toContainText('level 3');
  });
});
