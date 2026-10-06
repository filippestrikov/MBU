const { test, expect } = require('@playwright/test');
const { site, expectLoaded, main, cartLines, tileIncrease, cartQuantities, addFromSearch, emptyCartViaAdmin } = require('./shop');

// V2-43 / V2-66 / V2-67 cart quantities and V2-9 / V2-73 checkout, in ONE file so they never run in parallel
// against the same customer cart. Uses the logged-in TST customer (internal MBU account). Each test starts
// from an empty cart; leftovers are removed via Magento Admin. Tests run one after another (default mode),
// so one failure does not skip the rest.
test.describe.configure({ timeout: 240_000 });

test.beforeEach(async ({ browser }, testInfo) => { await emptyCartViaAdmin(browser, testInfo.project.use); });
test.afterAll(async ({ browser }, testInfo) => { await emptyCartViaAdmin(browser, testInfo.project.use); });

// Clicks "+" on the homepage tile at `index` `times` times as fast as possible.
async function rapidPlus(page, index, times) {
  // Only tiles currently shown in the slider are clickable.
  const plus = tileIncrease(page).filter({ visible: true }).nth(index);
  await plus.scrollIntoViewIfNeeded();
  for (let i = 0; i < times; i++) await plus.click({ delay: 0 });
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

async function cartWithOneProduct(page) {
  await expectLoaded(await page.goto('/'));
  await rapidPlus(page, 0, 1);
  await settle(page);
  await expectLoaded(await page.goto('/checkout/cart/'));
  await expect(cartLines(page)).toHaveCount(1);
  return cartLines(page).first();
}

test.describe('V2-67 product lists and slider', () => {
  test('[V2-67] Verify 5 rapid clicks on \'+\' from a homepage/category slider add exactly 5 to the cart', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    await rapidPlus(page, 0, 5);
    await settle(page);
    const quantities = await cartQuantities(page);
    expect(Object.values(quantities), `Cart should hold exactly 5 of one product: ${JSON.stringify(quantities)}`).toEqual([5]);
  });

  test('[V2-67] Verify an older request finishing late does not overwrite a newer cart state', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    await rapidPlus(page, 0, 1);
    await rapidPlus(page, 1, 3);
    await settle(page);
    const quantities = await cartQuantities(page);
    expect(Object.values(quantities).sort(), `Product A (1) and B (3) should both be in the cart: ${JSON.stringify(quantities)}`).toEqual([1, 3]);
  });
});

test.describe('V2-66 cart page', () => {
  for (const [how, finish] of [
    ['on blur (click outside field)', async page => { await page.locator('body').click({ position: { x: 5, y: 400 } }); }],
    ['on Enter', async (page, field) => { await field.press('Enter'); }],
    ['on Tab', async (page, field) => { await field.press('Tab'); }],
  ]) {
    test(`[V2-66] Verify typed quantity saves ${how}`, async ({ page }) => {
      const line = await cartWithOneProduct(page);
      const field = line.getByRole('spinbutton');
      await field.fill('4');
      await finish(page, field);
      await settle(page);
      expect(Object.values(await cartQuantities(page)), 'The typed quantity should be saved').toEqual([4]);
    });
  }

  test('[V2-66] Verify final quantity is correct after several quick updates to the same product', async ({ page }) => {
    const line = await cartWithOneProduct(page);
    const plus = line.getByRole('button', { name: /increase quantity|verhogen/i });
    for (let i = 0; i < 5; i++) await plus.click({ delay: 0 });
    await settle(page);
    expect(Object.values(await cartQuantities(page)), '1 + 5 quick clicks should give 6').toEqual([6]);
  });

  test('[V2-66] Verify drawer and cart page stay in sync after a drawer update', async ({ page }) => {
    await cartWithOneProduct(page);
    await page.getByRole('link', { name: 'Winkelwagen' }).first().click();
    const drawerQty = page.locator('li.minicart-item').getByRole('spinbutton').first();
    await expect(drawerQty).toBeVisible();
    await drawerQty.fill('3');
    await drawerQty.press('Tab');
    await settle(page);
    expect(Object.values(await cartQuantities(page)), 'The cart page should show the quantity set in the drawer').toEqual([3]);
  });
});

const euros = text => Number((text.match(/€\s*([\d.]+,\d{2})/) || [])[1]?.replace(/\./g, '').replace(',', '.') ?? NaN);

// Regression checklist #5 / V2-9 / V2-73: places a TEST order on TST (allowed by the client team) with the
// order reference "TEST Playwright – …". Item prices and totals must not be 0.
test.describe('V2-73 checkout and order', () => {
  test('[V2-73] Verify the price shown at checkout equals the product price (non-zero)', async ({ page }) => {
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${site.priceUnitProduct.sku}`));
    const productPrice = euros(await main(page).getByText(/€\s*[\d.,]+/).first().innerText());
    expect(productPrice, 'The product should have a price').toBeGreaterThan(0);
    await main(page).getByRole('button', { name: /In Winkelwagen/ }).first().click();
    await expect(page.getByRole('alert').filter({ hasText: /toegevoegd/ })).toBeVisible({ timeout: 20_000 });
    await expectLoaded(await page.goto('/checkout/'));
    await expect(page.getByRole('heading', { name: 'Bestelling afronden' })).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const text = await page.getByRole('main').innerText();
    const amounts = [...text.matchAll(/€\s*([\d.]+,\d{2})/g)].map(m => Number(m[1].replace(/\./g, '').replace(',', '.')));
    expect.soft(amounts, `Checkout should show the product price € ${productPrice} (amounts found: ${amounts.join(', ')})`).toContain(productPrice);
    await expect(page.locator('input[name="payment[method]"][value="free"], #free'), 'A priced order should not fall back to the zero-total "free" payment method').toHaveCount(0);
  });

  test('[V2-73] Run the Velder regression checklist - Checkout & order item (TST)', async ({ page }) => {
    await addFromSearch(page, site.priceUnitProduct.sku);
    await expectLoaded(await page.goto('/checkout/'));
    await expect(page.getByRole('heading', { name: 'Bestelling afronden' })).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.locator('input[name="reference"]').fill(site.testOrder.reference);
    // A delivery date is required; pick the first selectable day (searching three months ahead).
    await page.getByRole('button', { name: 'Andere bezorgdatum' }).click();
    const freeDays = page.locator('.ui-datepicker-calendar td:not(.ui-state-disabled):not(.ui-datepicker-unselectable) a');
    for (let month = 0; month < 3 && !(await freeDays.count()); month++) await page.locator('.ui-datepicker-next').click();
    expect(await freeDays.count(), 'At least one delivery date should be selectable in the next three months').toBeGreaterThan(0);
    await freeDays.first().click();
    await page.getByRole('button', { name: 'Bestelling afronden' }).click();
    await page.waitForURL(/success/, { timeout: 120_000 });
    await expect(page.getByRole('main')).toContainText(/bedankt|bestelling/i);
    // The newest order in "Mijn bestellingen" must have a non-zero total.
    await expectLoaded(await page.goto('/sales/order/history/'));
    const newest = main(page).getByRole('row').nth(1);
    const total = euros(await newest.innerText());
    expect(total, `The new order should have a non-zero total (row: ${(await newest.innerText()).replace(/\s+/g, ' ')})`).toBeGreaterThan(0);
  });
});
