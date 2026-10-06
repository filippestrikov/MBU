const { expect } = require('@playwright/test');
const site = require('./fixtures/site.json');

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

const main = page => page.getByRole('main');
// Real cart lines live in the cart form; the page also shows recommendation tiles with their own steppers.
const cartLines = page => page.locator('form.form-cart > ul > li, form.form-cart ul.cart-items > li')
  .filter({ has: page.getByRole('spinbutton') });
const tileIncrease = page => main(page).getByRole('button', { name: 'Increase Quantity', exact: true });

async function cartQuantities(page) {
  await expectLoaded(await page.goto('/checkout/cart/'));
  const result = {};
  for (const line of await cartLines(page).all()) {
    const name = (await line.locator('strong').getByRole('link').first().innerText()).trim();
    result[name] = Number(await line.getByRole('spinbutton').inputValue());
  }
  return result;
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
    await page.goto(process.env.VELDER_ADMIN_URL);
    await page.getByRole('textbox', { name: /username|gebruikersnaam/i }).fill(process.env.VELDER_ADMIN_USER);
    await page.getByRole('textbox', { name: /password|wachtwoord/i }).fill(process.env.VELDER_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|inloggen|aanmelden/i }).click();
    await page.locator('#nav').waitFor({ timeout: 60_000 });
    const href = await page.locator('#nav > li').filter({ hasText: /Customers|Klanten/ }).first()
      .locator('a').filter({ hasText: /^\s*(All Customers|Alle klanten)\s*$/ }).first().getAttribute('href');
    await page.goto(href);
    const grid = page.locator('.admin__data-grid-wrap').filter({ visible: true }).first();
    await grid.locator('tbody tr.data-row').first().waitFor({ timeout: 60_000 });
    const search = page.getByRole('textbox', { name: /Search by keyword|Zoeken op trefwoord/i }).filter({ visible: true }).first();
    await search.fill(process.env.VELDER_CUSTOMER_EMAIL);
    await search.press('Enter');
    const customer = grid.locator('tbody tr.data-row').filter({ hasText: process.env.VELDER_CUSTOMER_EMAIL }).first();
    await expect(customer).toBeVisible({ timeout: 30_000 });
    await page.goto(await customer.getByRole('link', { name: /Edit|Bewerken/, includeHidden: true }).getAttribute('href'));
    await page.locator('.admin__page-nav-item, [role=tab]').filter({ hasText: /Shopping cart|Winkelwagen/ }).first().click();
    const rows = page.locator('table tbody tr').filter({ visible: true }).filter({ has: page.getByRole('link', { name: /Delete|Verwijder/ }) });
    await page.waitForTimeout(4_000);
    for (let i = 0; i < 30 && await rows.count(); i++) {
      await rows.first().getByRole('link', { name: /Delete|Verwijder/ }).click();
      const ok = page.getByRole('button', { name: /^(OK|Ja)$/ }).filter({ visible: true }).first();
      if (await ok.isVisible({ timeout: 3_000 }).catch(() => false)) await ok.click();
      await page.waitForTimeout(3_000);
    }
    expect(await rows.count(), 'The test customer\'s cart should be empty again').toBe(0);
  } finally {
    await context.close();
  }
}

function overlaps(a, b) {
  return Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
}

module.exports = { site, expectLoaded, main, cartLines, tileIncrease, cartQuantities, addFromSearch, emptyCartViaAdmin, overlaps };
