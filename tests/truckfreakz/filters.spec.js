const { test, expect } = require('@playwright/test');
const { site, expectLoaded, main, filterBlock, hasFilters, expectNoHorizontalScroll } = require('./shop');

// Product tiles are the list items with an "Add to Cart" button.
const products = page => main(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: /Add to Cart/i }) });
const toolbarCount = async page => Number((await page.locator('#toolbar-amount').first().innerText()).match(/(\d+)\s*$/)?.[1]);
// Filter option links end with their product count, e.g. "Red 12" or "Red 12 items".
const optionName = text => text.replace(/\s*\d+\s*(items?)?\s*$/i, '').trim();

async function openAllFilterGroups(page) {
  for (const tab of await filterBlock(page).getByRole('tab').all()) {
    if ((await tab.getAttribute('aria-expanded')) !== 'true') await tab.click();
  }
}

test.describe('TD-10 Layered navigation', () => {
  test('[TD-10] Display layered navigation on category page', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    await expect(products(page).first()).toBeVisible();
    await expect(filterBlock(page), 'The filter sidebar should be shown on the category page').toBeVisible();
  });

  test('[TD-10] Display layered navigation on search results page', async ({ page }) => {
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${site.searchTerm}`));
    await expect(products(page).first()).toBeVisible();
    await expect(filterBlock(page), 'The filter sidebar should be shown on search results').toBeVisible();
  });

  test('[TD-10] Keep hardcoded subcategory area and restored filter structure compatible', async ({ page }) => {
    await expectLoaded(await page.goto(site.category));
    // The hardcoded subcategory area: image links to each subcategory, before the product grid.
    const subcategory = main(page).getByRole('link', { name: site.subcategory }).first();
    await expect(subcategory).toBeVisible();
    await expect(products(page).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    if (await hasFilters(page)) {
      const sidebar = await filterBlock(page).boundingBox();
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
    await openAllFilterGroups(page);
  });

  test('[TD-10] Filter products by configured attributes', async ({ page }) => {
    const before = await toolbarCount(page);
    const option = filterBlock(page).getByRole('tabpanel').filter({ hasNot: page.getByRole('slider') }).getByRole('link').first();
    const value = optionName(await option.innerText());
    await option.click();
    await expect(page.getByRole('heading', { name: 'Now Shopping by' }), 'The active filter should be listed').toBeVisible();
    await expect(filterBlock(page)).toContainText(value);
    await expect.poll(() => toolbarCount(page)).toBeLessThanOrEqual(before);
  });

  test('[TD-10] Use inline search inside configured filters', async ({ page }) => {
    const search = filterBlock(page).getByRole('textbox').first();
    const items = filterBlock(page).getByRole('tabpanel').filter({ has: search }).getByRole('link').filter({ visible: true });
    const query = optionName(await items.first().innerText()).slice(0, 3);
    await search.fill(query);
    await expect(items.first()).toBeVisible();
    for (const item of await items.all()) await expect(item).toContainText(new RegExp(query, 'i'));
  });

  test('[TD-10] Use price range slider to filter products', async ({ page }) => {
    const handle = filterBlock(page).getByRole('slider').last();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page).toHaveURL(/price=/);
    const max = Number(new URL(page.url()).searchParams.get('price').split('-')[1]);
    for (const price of await products(page).locator('[data-price-type="finalPrice"]').all()) {
      expect(Number(await price.getAttribute('data-price-amount'))).toBeLessThanOrEqual(max * (1 + site.vatRate) + 0.01);
    }
  });

  test('[TD-10] Show only attributes with assigned/indexed product data', async ({ page }) => {
    const options = await filterBlock(page).getByRole('tabpanel').getByRole('link').allInnerTexts();
    expect(options.length, 'The filters should list values').toBeGreaterThan(0);
    for (const text of options) {
      expect(Number(text.match(/(\d+)\s*(items?)?\s*$/i)?.[1] ?? 0), `${optionName(text)} should have products`).toBeGreaterThan(0);
    }
  });
});
