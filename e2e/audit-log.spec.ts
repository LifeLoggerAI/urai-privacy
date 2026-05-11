
import { test, expect } from '@playwright/test';

test.describe('Audit Log', () => {
  test('users should be able to view their audit log', async ({ page }) => {
    await page.goto('/privacy');

    // Check that the audit log is visible and contains at least one event.
    await expect(page.getByText('Audit Log')).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCountGreaterThan(0);
  });
});
