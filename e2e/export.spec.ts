
import { test, expect } from '@playwright/test';

test.describe('Data Export', () => {
  test('users should be able to request a data export', async ({ page }) => {
    await page.goto('/privacy');

    // Click the export button and check that a confirmation message is displayed.
    await page.getByRole('button', { name: 'Request Data Export' }).click();
    await expect(page.getByText('Export request successful!')).toBeVisible();
  });
});
