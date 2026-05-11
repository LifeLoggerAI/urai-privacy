
import { test, expect } from '@playwright/test';

test.describe('Consent Management', () => {
  test('users should be able to view and update their consent settings', async ({ page }) => {
    await page.goto('/privacy');

    // Check that the consent categories are visible.
    await expect(page.getByText('marketing-emails')).toBeVisible();
    await expect(page.getByText('product-recommendations')).toBeVisible();
    await expect(page.getByText('research-participation')).toBeVisible();

    // Check that the consent toggles can be updated.
    const marketingEmailsToggle = page.getByLabel('marketing-emails');
    await marketingEmailsToggle.check();
    await expect(marketingEmailsToggle).toBeChecked();
    await marketingEmailsToggle.uncheck();
    await expect(marketingEmailsToggle).not.toBeChecked();
  });
});
