const { test, expect } = require('@playwright/test');
const { site, expectLoaded, main, filterBlock, hasFilters, expectNoHorizontalScroll } = require('./shop');

const products = page => main(page).locator('.product-item');
const toolbarCount = async page => Number((await main(page).locator('.toolbar-amount').first().innerText()).match(/(\d+)\s*$/)?.[1]);

test.describe('TD-10 Layered navigation', () => {
  test('[TD-10] Display layered navigation on category page', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    await expect(products(page).first()).toBeVisible();
    await expect(filterBlock(page).first(), 'The filter sidebar should be shown on the category page').toBeVisible();
  });

  test('[TD-10] Display layered navigation on search results page', async ({ page }) => {
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${site.searchTerm}`));
    await expect(products(page).first()).toBeVisible();
    await expect(filterBlock(page).first(), 'The filter sidebar should be shown on search results').toBeVisible();
  });

  test('[TD-10] Keep hardcoded subcategory area and restored filter structure compatible', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    const subcategories = main(page).locator('.collection-subcat');
    await expect(subcategories).toBeVisible();
    await expect(products(page).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    if (await hasFilters(page)) {
      const sidebar = await filterBlock(page).first().boundingBox();
      const grid = await products(page).first().boundingBox();
      expect(sidebar.x + sidebar.width, 'Filters should not overlap the product grid').toBeLessThanOrEqual(grid.x + 1);
    }
  });
});

// These cases need the filter sidebar; they run once layered navigation is visible on TST.
test.describe('TD-10 Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    test.skip(!(await hasFilters(page)), 'Layered navigation is not shown on TST (see "Display layered navigation on category page").');
  });

  test('[TD-10] Filter products by configured attributes', async ({ page }) => {
    const before = await toolbarCount(page);
    const group = filterBlock(page).locator('.filter-options-item').filter({ hasNot: page.locator('[data-mst-nav-slider], .mst-nav__slider') }).first();
    await group.locator('.filter-options-title').click();
    const option = group.locator('.filter-options-content a, .filter-options-content input').first();
    const value = (await option.innerText().catch(() => '')).replace(/\s*\d+\s*$/, '').trim();
    await option.click();
    await expect(page.locator('.filter-current, .mst-nav__state').first()).toContainText(value);
    await expect.poll(() => toolbarCount(page)).toBeLessThanOrEqual(before);
  });

  test('[TD-10] Use inline search inside configured filters', async ({ page }) => {
    const search = filterBlock(page).locator('input[type="text"], input[type="search"]').first();
    await search.locator('xpath=ancestor::*[contains(@class,"filter-options-item")]').locator('.filter-options-title').click();
    const items = search.locator('xpath=ancestor::*[contains(@class,"filter-options-content")]').locator('li, .item').filter({ visible: true });
    const first = (await items.first().innerText()).replace(/\s*\d+\s*$/, '').trim();
    await search.fill(first.slice(0, 3));
    for (const item of await items.all()) await expect(item).toContainText(new RegExp(first.slice(0, 3), 'i'));
  });

  test('[TD-10] Use price range slider to filter products', async ({ page }) => {
    const slider = filterBlock(page).locator('[data-mst-nav-slider], .mst-nav__slider, .ui-slider').first();
    await slider.locator('xpath=ancestor::*[contains(@class,"filter-options-item")]').locator('.filter-options-title').click();
    const handle = slider.locator('.ui-slider-handle, [role="slider"]').last();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page).toHaveURL(/price=/);
    const max = Number(new URL(page.url()).searchParams.get('price').split('-')[1]);
    for (const price of await main(page).locator('.product-item [data-price-type="finalPrice"]').all()) {
      expect(Number(await price.getAttribute('data-price-amount'))).toBeLessThanOrEqual(max * (1 + site.vatRate) + 0.01);
    }
  });

  test('[TD-10] Show only attributes with assigned/indexed product data', async ({ page }) => {
    for (const option of await filterBlock(page).locator('.filter-options-content .count').all()) {
      expect(Number((await option.innerText()).replace(/\D/g, '')), 'Filter values should have products').toBeGreaterThan(0);
    }
  });
});
