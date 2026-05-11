
import { test, expect } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test('the privacy dashboard should be responsive on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/privacy');

    // Check that the main heading is visible.
    await expect(page.getByRole('heading', { name: 'Privacy Dashboard' })).toBeVisible();

    // Check that the consent manager is visible.
    await expect(page.getByText('Consent Management')).toBeVisible();
  });
});
