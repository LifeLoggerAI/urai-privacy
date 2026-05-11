
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  const pages = [
    { name: 'Home', path: '/' },
    { name: 'Privacy', path: '/privacy' },
    { name: 'Terms', path: '/terms' },
    { name: 'Data', path: '/data' },
    { name: 'Security', path: '/security' },
    { name: 'Consent', path: '/consent' },
    { name: 'Delete', path: '/delete' },
    { name: 'Contact', path: '/contact' },
    { name: 'Changelog', path: '/changelog' },
  ];

  for (const page of pages) {
    test(`should load ${page.name} page`, async ({ page: playwrightPage }) => {
      await playwrightPage.goto(page.path);
      await expect(playwrightPage).toHaveTitle(/URAI/);
      await expect(playwrightPage.locator('h1')).toBeVisible();
    });
  }
});
