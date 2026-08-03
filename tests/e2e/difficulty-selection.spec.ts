import { test, expect } from '@playwright/test';

test.describe('Difficulty Selection E2E', () => {
  test('allows selecting different engine difficulty levels', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const select = page.getByLabel('Engine Level');
    await expect(select).toBeVisible();

    await select.selectOption('1');
    await expect(page.locator('header')).toContainText('level 1');

    await select.selectOption('3');
    await expect(page.locator('header')).toContainText('level 3');
  });
});
