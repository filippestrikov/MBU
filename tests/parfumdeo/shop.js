const { expect } = require('@playwright/test');
const site = require('./fixtures/site.json');

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

const cartButton = page => page.getByRole('button', { name: /Toggle minicart|minicart|Winkelwagen/i }).first();

async function addProduct(page, path = site.product.path) {
  await expectLoaded(await page.goto(path));
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.getByRole('main').getByRole('button', { name: 'In Winkelwagen', exact: true }).click();
  // Either the "toegevoegd" message or the minicart counter confirms the add.
  await expect(page.getByRole('alert').filter({ hasText: /toegevoegd/ })
    .or(page.getByRole('button', { name: /[1-9]\d* product/ })).first()).toBeVisible({ timeout: 20_000 });
}

// Magewire re-renders the form after each field update and can wipe a field that was filled
// meanwhile, so fill, leave the field, wait for the update and re-fill if the value was lost.
async function fillStable(page, selector, value) {
  const field = page.locator(selector);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await field.fill(value);
    await field.press('Tab');
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    if ((await field.inputValue()) === value) return;
  }
  await expect(field, `${selector} should keep its value`).toHaveValue(value);
}

// Fills the guest shipping step with the labelled test customer (manual address entry).
async function fillShipping(page, method = '#shipping-method-mbutrunkrs') {
  const data = site.testOrder;
  await expectLoaded(await page.goto('/checkout/'));
  await fillStable(page, '#guest_details-email_address', data.email);
  await fillStable(page, '#shipping-firstname', data.firstname);
  await fillStable(page, '#shipping-lastname', data.lastname);
  await page.locator('#shipping-aac_manual_completion').check();
  await expect(page.locator('#shipping-street-0')).toBeEnabled();
  await fillStable(page, '#shipping-street-0', data.street);
  await fillStable(page, '#shipping-street-1', data.houseNumber);
  await fillStable(page, '#shipping-postcode', data.postcode);
  await fillStable(page, '#shipping-city', data.city);
  await fillStable(page, '#shipping-telephone', data.telephone);
  await page.locator(method).check();
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  // A last check: earlier fields can still be cleared by a late re-render.
  for (const [selector, value] of [['#shipping-firstname', data.firstname], ['#shipping-lastname', data.lastname], ['#shipping-street-0', data.street]]) {
    if ((await page.locator(selector).inputValue()) !== value) await fillStable(page, selector, value);
  }
}

const placeOrderButton = page => page.getByRole('button', { name: 'Bestelling plaatsen' });

// The first click on "Verder naar overzicht & betalen" is sometimes ignored while the shipping
// step is still saving; retry a few times (see docs/parfumdeo-coverage.md).
async function goToPayment(page) {
  const data = site.testOrder;
  for (let attempt = 1; attempt <= 4 && !(await placeOrderButton(page).isVisible()); attempt++) {
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    // Re-fill anything a late re-render wiped before trying again.
    for (const [selector, value] of [['#shipping-firstname', data.firstname], ['#shipping-lastname', data.lastname], ['#shipping-street-0', data.street], ['#shipping-postcode', data.postcode], ['#shipping-telephone', data.telephone]]) {
      if (await page.locator(selector).isVisible() && (await page.locator(selector).inputValue()) !== value) await fillStable(page, selector, value);
    }
    await page.getByRole('button', { name: 'Verder naar overzicht & betalen' }).click();
    await placeOrderButton(page).waitFor({ timeout: 20_000 }).catch(() => {});
  }
  await expect(placeOrderButton(page), 'The payment step should open').toBeVisible();
  await expect(page.getByRole('heading', { name: 'Betaalmethode' })).toBeVisible();
}

// Mollie test-mode checkout page: optional issuer list, then a status choice and Continue.
async function chooseMollieStatus(page, status) {
  const issuer = page.getByRole('button', { name: /ABN|ING|Rabobank|bank/i }).first();
  if (await issuer.isVisible({ timeout: 5_000 }).catch(() => false)) await issuer.click();
  await page.getByRole('radio', { name: status }).or(page.getByLabel(status)).first().check();
  await page.getByRole('button', { name: /continue|doorgaan|verder/i }).click();
}

async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

module.exports = { site, expectLoaded, cartButton, addProduct, fillShipping, goToPayment, placeOrderButton, chooseMollieStatus, horizontalOverflow };
