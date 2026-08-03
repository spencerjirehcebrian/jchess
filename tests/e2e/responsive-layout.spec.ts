import { test, expect } from "@playwright/test";

test.describe("Responsive Layout E2E", () => {
  test("renders properly on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.locator("h1")).toHaveText(/Voxel Chess/i);
    await expect(
      page.locator('canvas[aria-label="Chess board view"]'),
    ).toBeVisible();
  });

  test("renders properly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await expect(page.locator("h1")).toHaveText(/Voxel Chess/i);
    await expect(
      page.locator('canvas[aria-label="Chess board view"]'),
    ).toBeVisible();
  });
});
