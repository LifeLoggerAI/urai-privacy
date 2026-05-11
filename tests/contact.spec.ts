
import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test('should submit the form successfully', async ({ page }) => {
    await page.goto('/contact');

    // Fill out the form
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('textarea[name="message"]', 'This is a test message.');

    // Submit the form
    await page.click('button[type="submit"]');

    // Assert that a success message is shown
    const successMessage = await page.textContent('p.success-message'); // Assuming a <p> with this class is shown on success
    expect(successMessage).toContain('Your message has been sent!');
  });
});
