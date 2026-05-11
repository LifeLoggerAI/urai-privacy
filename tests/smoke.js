
const { test, expect } = require("@playwright/test");

test.describe("Public Pages", () => {
  test("/privacy should load", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1")).toHaveText("Privacy Policy");
  });

  test("/terms should load", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1")).toHaveText("Terms of Service");
  });

  test("/cookies should load", async ({ page }) => {
    await page.goto("/cookies");
    await expect(page.locator("h1")).toHaveText("Cookie Policy");
  });
});

test.describe("Portal", () => {
  test("/portal should redirect to login when unauthenticated", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL("/login");
  });
});
