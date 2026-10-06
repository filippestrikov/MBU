const { test, expect } = require('@playwright/test');
const { site, storeBase, expectLoaded, expectNoHorizontalScroll } = require('./shop');

// Coming Soon uses Magento's maintenance page (approved option 3 on TD-29). Public visitors get it
// instead of the shop; whitelisted IPs get the shop. The page itself is served at /errors/503.php,
// so its content can be checked from any IP.
const { comingSoon } = site;

async function openComingSoon(page, code = 'en') {
  const response = await page.goto(storeBase(code) + comingSoon.path);
  expect(response.status(), 'Maintenance page answers 503 (temporarily unavailable)').toBe(503);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test.describe('TD-29 Coming Soon page', () => {
  test('[TD-29] Do not use confusing Error meta title on Coming Soon page', async ({ page }) => {
    await openComingSoon(page);
    await expect(page).not.toHaveTitle(/error/i);
    await expect(page).toHaveTitle(/TruckFreakz/i);
  });

  test('[TD-29] Display launch date and email element on Coming Soon page', async ({ page }) => {
    await openComingSoon(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(comingSoon.heading, 'i'));
    await expect(page.locator('time')).toHaveText(comingSoon.launch);
    await expect(page.getByRole('link', { name: comingSoon.email })).toHaveAttribute('href', `mailto:${comingSoon.email}`);
    await expect(page.getByRole('img', { name: 'TruckFreakz' })).toBeVisible();
  });

  for (const name of ['desktop1920', 'desktop1366', 'tablet', 'mobile']) {
    test(`[TD-29] Render Coming Soon page responsively (${name})`, async ({ page }) => {
      await page.setViewportSize(site.viewports[name]);
      await openComingSoon(page);
      await expectNoHorizontalScroll(page);
      for (const element of [page.getByRole('img', { name: 'TruckFreakz' }), page.getByRole('heading', { level: 1 }), page.locator('time'), page.getByRole('link', { name: comingSoon.email })]) {
        await expect(element).toBeInViewport();
      }
      const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
      expect(heading.x, 'Heading should not be clipped on the left').toBeGreaterThanOrEqual(0);
      expect(heading.x + heading.width, 'Heading should not be clipped on the right').toBeLessThanOrEqual(site.viewports[name].width);
    });
  }

  test('[TD-29] Keep Coming Soon behavior across required store languages', async ({ page }) => {
    for (const [code, store] of Object.entries(site.stores)) {
      await openComingSoon(page, code);
      await expect.soft(page.locator('time'), `${code}: launch date`).toBeVisible();
      await expect.soft(page.locator('html'), `${code}: Coming Soon page should be in the store language`).toHaveAttribute('lang', store.lang);
    }
  });

  test('[TD-29] Allow whitelisted IP to access the normal webshop', async ({ page }) => {
    test.setTimeout(240_000);
    test.info().annotations.push({ type: 'note', description: 'The test runner gets the normal shop; that means its IP is whitelisted or Coming Soon mode is off. Public (non-whitelisted) access needs a check from an outside IP.' });
    for (const code of Object.keys(site.stores)) {
      const base = storeBase(code);
      for (const path of ['/', site.category, site.stores[code].configurable, '/checkout/cart/', '/customer/account/login/']) {
        if (code !== 'en' && path === site.category) continue;
        await expectLoaded(await page.goto(base + path));
        await expect.soft(page.getByRole('heading', { name: new RegExp(comingSoon.heading, 'i') }), `${code} ${path}`).toHaveCount(0);
      }
    }
  });
});
