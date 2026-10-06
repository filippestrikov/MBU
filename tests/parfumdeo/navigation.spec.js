const { test, expect } = require('@playwright/test');
const { site, expectLoaded } = require('./shop');

// Expectations from the Confluence page "PDI-23 - Layered navigation & SEO filter URLs (Mirasvit)".
const sidebar = page => page.getByRole('main').locator('aside, [class*="sidebar"], [class*="layered"]').first();
const filterButtons = page => page.getByRole('main').getByRole('button', { name: / filter$/ });

async function openFilter(page, name) {
  const button = page.getByRole('main').getByRole('button', { name: `${name} filter` });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  return button.locator('xpath=ancestor::*[self::div or self::li][1]');
}

test.describe('PDI-23 / PDI-103 layered navigation', () => {
  test('[PDI-103] Remove Product type filter', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    const names = (await filterButtons(page).allInnerTexts()).map(n => n.trim());
    expect(names.length, 'The category should show filters').toBeGreaterThan(0);
    expect(names.join(' | '), 'Product type filter should be removed (PDI-83)').not.toMatch(/product\s*type/i);
  });

  test('[PDI-103] Sort filter values alphabetically', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    for (const name of ['Merk']) {
      const panel = await openFilter(page, name);
      const values = (await panel.getByRole('link').allInnerTexts()).map(v => v.replace(/\(\d+\)|\d+$/g, '').trim()).filter(Boolean);
      expect(values.length, `${name} should list values`).toBeGreaterThan(2);
      const sorted = [...values].sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }));
      expect.soft(values, `${name} values should be A–Z`).toEqual(sorted);
    }
  });

  test('[PDI-103] Use readable attribute values in URLs', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    const panel = await openFilter(page, 'Merk');
    const hrefs = await panel.getByRole('link').evaluateAll(links => links.map(l => l.getAttribute('href')).filter(Boolean));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs.slice(0, 20)) {
      expect.soft(href, 'Filter URLs should not use option ids (?attr=123)').not.toMatch(/[?&][a-z_]+=\d+(&|$)/i);
      expect.soft(href, 'Filter URLs should not get a _1 suffix').not.toMatch(/_1(\/|\.html|$|&)/);
    }
  });

  test('[PDI-23] Display category filter levels deeper than level 3', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    const panel = await openFilter(page, 'Categorie');
    const links = panel.getByRole('link');
    await expect(links.first(), 'The category filter should list subcategories').toBeVisible();
    await links.first().click();
    await page.waitForLoadState('load');
    await expect(page.getByRole('main').getByRole('button', { name: 'Categorie filter' }), 'Deeper levels should still offer a category filter').toBeVisible();
  });

  test('[PDI-103] Center and visually normalize pagination', async ({ page }) => {
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${site.searchTerm}`));
    const nav = page.getByRole('navigation', { name: 'pagination' }).last();
    await nav.scrollIntoViewIfNeeded();
    const [navBox, list] = await Promise.all([nav.boundingBox(), nav.locator('ul, ol').first().boundingBox()]);
    const listBox = list ?? navBox;
    const products = await page.getByRole('main').locator('ol.products, ul.products, [class*="product-grid"], .products-grid').first().boundingBox();
    const area = products ?? navBox;
    const offset = Math.abs((listBox.x + listBox.width / 2) - (area.x + area.width / 2));
    expect(offset, 'Pagination should be centred under the products').toBeLessThan(40);
  });
});
