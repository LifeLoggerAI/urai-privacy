
import { test, expect } from '@playwright/test';

test.describe('Data Deletion', () => {
  test('users should be able to request data deletion', async ({ page }) => {
    await page.goto('/privacy');

    // Click the deletion button and confirm the deletion.
    await page.getByRole('button', { name: 'Request Data Deletion' }).click();
    await page.getByRole('button', { name: 'Yes, Delete My Data' }).click();

    // Check that a confirmation message is displayed.
    await expect(page.getByText('Deletion request successful!')).toBeVisible();
  });
});
