
import { test, expect } from '@playwright/test';

const pagesToTest = [
  '/',
  '/privacy',
  '/terms',
  '/data',
  '/security',
  '/consent',
  '/delete',
  '/contact',
  '/changelog',
];

test.describe('Link Integrity', () => {
  for (const startPath of pagesToTest) {
    test(`Check links on ${startPath}`, async ({ page, baseURL }) => {
      await page.goto(startPath);

      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.getAttribute('href'))
          .filter((h): h is string => !!h)
      );

      const internalLinks = links.filter(href => href.startsWith('/'));

      for (const href of internalLinks) {
        if (!href.startsWith('/')) continue;
        
        const url = new URL(href, baseURL).toString();
        console.log(`Checking link from ${startPath} to ${href}`);
        
        try {
          const response = await page.request.get(url);
          expect(response.ok(), `Link from ${startPath} to ${href} is broken. Status: ${response.status()}`).toBe(true);
        } catch (e) {
          console.error(`Failed to fetch ${url}`, e);
          expect(true, `Failed to fetch ${url}`).toBe(false);
        }
      }
    });
  }
});
