
import { test, expect } from '@playwright/test';

const pages = [
  '/',
  '/privacy-policy',
  '/data-rights',
  '/data-death-protocol',
  '/consent-tiers',
  '/compliance',
  '/security',
  '/transparency-ledger',
  '/governance',
  '/contact',
];

for (const page of pages) {
  test(`Page ${page} should load`, async ({ page: testPage }) => {
    await testPage.goto(page);
    const response = await testPage.waitForNavigation();
    expect(response?.status()).toBe(200);
  });
}
