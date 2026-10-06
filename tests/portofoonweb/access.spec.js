const { test, expect } = require('@playwright/test');

// Portofoonweb TST sits behind Cloudflare/Botstopper. Until the test machine is let through
// (see docs/portofoonweb-coverage.md), every browser test would hit a verification page.
// These two tests make that blocker visible in every run.

test('[PW] Storefront is reachable for automated tests (no bot verification page)', async ({ page }) => {
  const response = await page.goto('/');
  const title = await page.title();
  expect(title, 'Cloudflare/Botstopper should let the QA test browser through on TST').not.toMatch(/verification/i);
  expect(response.status(), 'The TST homepage should load').toBe(200);
});

test('[PW-7] Open English TST store view on the .com test domain', async ({ page }) => {
  const response = await page.goto('https://tst-portofoonweb-com.mbu.dev/');
  expect(await page.title(), 'Blocked by bot verification; see the access test').not.toMatch(/verification/i);
  expect(response.status()).toBe(200);
  expect(new URL(page.url()).hostname, 'The .com test domain should not redirect to the NL store').toBe('tst-portofoonweb-com.mbu.dev');
  await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
});
