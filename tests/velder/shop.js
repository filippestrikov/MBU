const { expect } = require('@playwright/test');
const { adminLogin, adminMenu, searchGrid, openGridRow } = require('../common/magento-admin');
const site = require('./fixtures/site.json');

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

const main = page => page.getByRole('main');
// Real cart lines are in the cart form (outside the main landmark on this theme); the page also shows
// recommendation tiles with their own steppers.
const cartLines = page => page.locator('form[action*="/checkout/cart/updatePost"]').getByRole('listitem')
  .filter({ has: page.getByRole('spinbutton') });
const tileIncrease = page => main(page).getByRole('button', { name: 'Increase Quantity', exact: true });

async function cartQuantities(page) {
  await expectLoaded(await page.goto('/checkout/cart/'));
  const result = {};
  for (const line of await cartLines(page).all()) {
    // The product photo link has no text; the name link does.
    const name = (await line.getByRole('link').filter({ hasText: /\S/ }).first().innerText()).trim();
    result[name] = Number(await line.getByRole('spinbutton').inputValue());
  }
  return result;
}

// Cart traffic: add-to-cart, cart updates and the cart section reload that follows them.
const isCartRequest = request => /\/rest\/V1\/addtocart|\/checkout\/(cart|sidebar)\/\w|\/carts\/mine|sections=[^&]*cart/.test(request.url());
const cartTraffic = new WeakMap();

// Call before the cart actions of a test; `settle` then waits for the requests they caused.
function trackCartRequests(page) {
  const state = { started: 0, settled: 0, pending: 0, lastChange: Date.now() };
  const change = delta => request => {
    if (!isCartRequest(request)) return;
    if (delta > 0) state.started++;
    state.pending += delta;
    state.lastChange = Date.now();
  };
  page.on('request', change(1));
  page.on('requestfinished', change(-1));
  page.on('requestfailed', change(-1));
  cartTraffic.set(page, state);
}

// Waits until the cart requests caused by the last actions have answered. The quantity steppers send their
// request after a short debounce, so wait for new cart traffic (max 5 s: an action that saves nothing sends
// none) and then for 1 s without any cart request starting or finishing.
async function settle(page) {
  const state = cartTraffic.get(page);
  if (!state) throw new Error('Call trackCartRequests(page) before the cart actions.');
  const start = Date.now();
  await expect.poll(() => state.started > state.settled || Date.now() - start > 5_000, { timeout: 10_000, intervals: [100] }).toBe(true);
  await expect.poll(() => state.pending === 0 && Date.now() - state.lastChange > 1_000,
    { message: 'Cart requests should finish', timeout: 30_000, intervals: [250] }).toBe(true);
  state.settled = state.started;
}

async function addFromSearch(page, query) {
  await expectLoaded(await page.goto(`/catalogsearch/result/?q=${encodeURIComponent(query)}`));
  await main(page).getByRole('button', { name: /In Winkelwagen/ }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: /toegevoegd/ })).toBeVisible({ timeout: 20_000 });
}

// Removing lines on the TST storefront cart does not work (no request is sent), so test leftovers are
// removed through Magento Admin > Customers > (customer) > Shopping cart. Staging only.
async function emptyCartViaAdmin(browser, baseUse) {
  const context = await browser.newContext({ ...baseUse, storageState: undefined, viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  try {
    await adminLogin(page, { url: process.env.VELDER_ADMIN_URL, user: process.env.VELDER_ADMIN_USER, password: process.env.VELDER_ADMIN_PASSWORD });
    await adminMenu(page, 'customers', /^(All Customers|Alle klanten)$/);
    await searchGrid(page, process.env.VELDER_CUSTOMER_EMAIL);
    await openGridRow(page, process.env.VELDER_CUSTOMER_EMAIL);
    await page.getByRole('link', { name: /Shopping cart|Winkelwagen/ }).click();
    // The customer's cart grid loads when its tab opens; data rows have a Delete link.
    const cart = page.locator('#customer_cart_grid_table');
    await expect(cart, 'The customer cart should load').toBeVisible({ timeout: 60_000 });
    const rows = cart.getByRole('row').filter({ has: page.getByRole('link', { name: /Delete|Verwijder/ }) });
    // A delete sometimes does not take on the shared TST server, so retry until the grid reports no records.
    for (let attempt = 0; attempt < 10 && await rows.count(); attempt++) {
      const before = await rows.count();
      await rows.first().getByRole('link', { name: /Delete|Verwijder/ }).click();
      // Magento asks for confirmation in a modal (or a native dialog, accepted above).
      await page.getByRole('button', { name: /^(OK|Ja)$/ }).filter({ visible: true }).first().click({ timeout: 10_000 }).catch(() => {});
      await expect.poll(() => rows.count(), { timeout: 30_000 }).toBeLessThan(before).catch(() => {});
    }
    await expect(cart, 'The test customer\'s cart should be empty again').toContainText(/couldn't find any records|geen records/i);
  } finally {
    await context.close();
  }
}

function overlaps(a, b) {
  return Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
}

module.exports = {
  site, expectLoaded, main, cartLines, tileIncrease, cartQuantities, trackCartRequests, settle, addFromSearch, emptyCartViaAdmin, overlaps,
};
