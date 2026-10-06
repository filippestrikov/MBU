const { test, expect } = require('@playwright/test');
const { shop, cartDrawer, cartCount, expectLoaded, addProduct, chooseFirstOption, openCartDrawer } = require('./shop');

const productList = page => page.getByRole('region', { name: 'Productlijst' });
const productNames = page => productList(page).getByRole('listitem').getByRole('link').filter({ hasText: /\S/ });

// A flag on window survives AJAX updates but disappears on a full page load.
async function markPage(page) {
  await page.evaluate(() => { window.__noReload = true; });
}

async function expectNoReload(page, scrolledTo) {
  expect(await page.evaluate(() => window.__noReload === true), 'Only the product list should refresh, not the whole page').toBe(true);
  expect(await page.evaluate(() => window.scrollY), 'The scroll position should be kept').toBeGreaterThan(scrolledTo / 2);
}

async function scrollToMiddle(page) {
  await productList(page).getByRole('listitem').nth(8).scrollIntoViewIfNeeded();
  return page.evaluate(() => window.scrollY);
}

test.describe('BBM2-73 Backend feedback', () => {
  test('[BBM2-73] Show notifications promptly and clear them correctly', async ({ page }) => {
    await addProduct(page);
    const notice = page.getByText(shop.addedMessage).first();
    if (await notice.isVisible()) {
      await expectLoaded(await page.goto('/'));
      await expect(page.getByText(shop.addedMessage), 'The notification should not persist on the next page').toHaveCount(0);
    } else {
      await expect(cartDrawer(page), 'Without a notification, the minicart should confirm the add').toBeVisible();
    }
  });

  test('[BBM2-73] Display required product information in search results', async ({ page }) => {
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${shop.searchTerm}`));
    const cards = productList(page).getByRole('listitem');
    await expect(cards).not.toHaveCount(0);
    for (const card of (await cards.all()).slice(0, 6)) {
      await expect(card.getByRole('img').first()).toBeVisible();
      await expect(card.getByRole('link').last()).toHaveText(/\S/);
      await expect(card).toContainText(/€\s?\d/);
    }
  });

  test('[BBM2-73] Apply Sort By without full-page reload', async ({ page }) => {
    await expectLoaded(await page.goto(shop.category));
    const scrolledTo = await scrollToMiddle(page);
    const before = await productNames(page).allInnerTexts();
    await markPage(page);
    await page.getByRole('button', { name: 'Sorteer op' }).click();
    await page.getByRole('button', { name: 'Product Naam' }).click();
    await expect.poll(() => productNames(page).allInnerTexts(), { message: 'The sort order should change' }).not.toEqual(before);
    await expectNoReload(page, scrolledTo);
  });

  test('[BBM2-73] Apply standard filters without full-page reload', async ({ page }) => {
    await expectLoaded(await page.goto(shop.category));
    const scrolledTo = await scrollToMiddle(page);
    const before = await productNames(page).allInnerTexts();
    await markPage(page);
    await page.getByRole('button', { name: 'Kleur' }).click();
    await page.getByRole('radiogroup', { name: 'color' }).getByRole('link').first().click();
    await expect.poll(() => productNames(page).allInnerTexts(), { message: 'The filter should change the products' }).not.toEqual(before);
    await expectNoReload(page, scrolledTo);
  });

  test('[BBM2-73] Apply filters from All filters without full-page reload', async ({ page }) => {
    await expectLoaded(await page.goto(shop.category));
    const scrolledTo = await scrollToMiddle(page);
    const before = await productNames(page).allInnerTexts();
    await markPage(page);
    await page.getByRole('button', { name: 'Filters openen' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Filters' });
    await dialog.getByRole('button', { name: 'Kleur' }).click();
    await dialog.getByRole('radiogroup', { name: 'color' }).getByRole('link').first().click();
    await expect(dialog.getByRole('button', { name: /Apply Filters/ })).toBeEnabled();
    await dialog.getByRole('button', { name: /Apply Filters/ }).click();
    await expect.poll(() => productNames(page).allInnerTexts(), { message: 'The filter should change the products' }).not.toEqual(before);
    await expectNoReload(page, scrolledTo);
  });

  test('[BBM2-73] Open minicart instead of showing add-to-cart notification on PDP', async ({ page }) => {
    await addProduct(page);
    await expect(cartDrawer(page), 'The minicart should open after adding to cart').toBeVisible();
    await expect(page.getByText(shop.addedMessage), 'The add-to-cart notification should not be shown').toHaveCount(0);
  });

  test('[BBM2-73] Keep minicart open when adding an upsell product', async ({ page }) => {
    await addProduct(page);
    await openCartDrawer(page);
    const before = await cartCount(page);
    await cartDrawer(page).getByRole('button', { name: /^Toevoegen aan winkelwagen/ }).first().click();
    await chooseFirstOption(page);
    await expect.poll(() => cartCount(page), { message: 'The upsell product should be added' }).toBeGreaterThan(before);
    await expect(cartDrawer(page), 'The minicart should stay open').toBeVisible();
  });
});
