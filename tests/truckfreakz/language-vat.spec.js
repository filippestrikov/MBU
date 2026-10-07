const { test, expect } = require('@playwright/test');
const { site, storeBase, expectLoaded, priceBox, pdpPrices, openMobileMenu } = require('./shop');

const languageButton = page => page.getByRole('banner').getByRole('button', { name: /English|Nederlands|Deutsch|Francais/ });
const storeLink = (page, code) => page.locator(`a[href*="___store/${code}/"]`).filter({ visible: true }).first();

test.describe('TD-8 Language / Region / VAT selector', () => {
  for (const code of ['nl', 'de', 'fr']) {
    test(`[TD-8] Switch storefront language using Magento store-view selector (${code})`, async ({ page }) => {
      await expectLoaded(await page.goto('/'));
      await languageButton(page).click();
      await page.getByRole('banner').getByRole('link', { name: site.stores[code].language, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`^${storeBase(code)}`));
      await expect(page.locator('html')).toHaveAttribute('lang', site.stores[code].lang);
      await expect(languageButton(page)).toContainText(site.stores[code].language);
    });
  }

  test('[TD-8] Switch region/currency when configured', async ({ page }) => {
    // Not applicable while every store view sells in EUR; this check fails once another currency appears.
    for (const [code, store] of Object.entries(site.stores)) {
      await expectLoaded(await page.goto(storeBase(code) + store.configurable));
      await expect.soft(priceBox(page), `${code} prices in EUR`).toContainText('€');
      await expect.soft(page.locator('meta[content="EUR"]').first(), `${code} currency`).toBeAttached();
    }
  });

  for (const name of ['tablet', 'mobile']) {
    test(`[TD-8] Render selector modal/header responsively (${name})`, async ({ page }) => {
      await page.setViewportSize(site.viewports[name]);
      await expectLoaded(await page.goto('/'));
      // Page-wide overflow is covered by the TD-24 responsive homepage checks; here only the header counts.
      const header = await page.getByRole('banner').boundingBox();
      expect(header.x + header.width, 'Header should fit the viewport').toBeLessThanOrEqual(site.viewports[name].width + 1);
      // Below desktop width the language switcher sits at the bottom of the hamburger menu and shows flags.
      await openMobileMenu(page);
      // includeHidden: the open menu container keeps aria-hidden="true" (accessibility finding).
      await page.getByRole('button', { name: site.stores.en.language, includeHidden: true }).filter({ visible: true }).last().click();
      for (const code of ['nl', 'de', 'fr']) {
        await expect(storeLink(page, code), `${code} flag should be visible`).toBeInViewport();
      }
      await storeLink(page, 'nl').click();
      await expect(page).toHaveURL(new RegExp(`^${storeBase('nl')}`));
    });
  }

  // TD-8 is parked as "After Launch": no combined selector or Incl./Excl. VAT toggle on TST yet.
  // Prices currently show excl. VAT with the incl. VAT amount as a note (TD-15).
  test('[TD-8] Current price display shows excl. VAT with incl. VAT note', async ({ page }) => {
    await expectLoaded(await page.goto(site.simple.path));
    const { excl, incl } = await pdpPrices(page);
    expect(incl).toBeGreaterThan(excl);
  });

  for (const title of [
    'Display combined Language / Region / VAT control in header',
    'Switch prices to Including VAT mode',
    'Switch prices to Excluding VAT mode',
    'Update product card prices dynamically after VAT toggle',
    'Update PDP prices dynamically after VAT toggle',
  ]) {
    test.fixme(`[TD-8] ${title}`, async () => {
      // TD-8 status "After Launch" (2026-09-29): the VAT switcher is not built yet.
    });
  }
});
