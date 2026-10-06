const { expect } = require('@playwright/test');
const shop = require('./fixtures/shop.json');

const cartButton = page => page.getByRole('button', { name: /Minicart tonen\/verbergen/ });
const cartDrawer = page => page.getByRole('region', { name: 'Winkelwagen' });

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

async function cartCount(page) {
  const label = await cartButton(page).getAttribute('aria-label');
  // e.g. "Minicart tonen/verbergen, 1 item" / "2 producten" / "Winkelwagen is leeg"
  return Number(label.match(/(\d+)\s+(?:item|product)/)?.[1] ?? 0);
}

// Adds the fixture product from its PDP and waits for the header cart count to change.
async function addProduct(page, { path = shop.product.path, option, qty } = {}) {
  await expectLoaded(await page.goto(path));
  // The option radios re-render via Alpine, so click instead of check(); the cart verifies the choice.
  if (option) await page.getByRole('radio', { name: option, exact: true }).click();
  // The first quantity box is the main one; the second belongs to the sticky add-to-cart bar.
  if (qty) await page.getByRole('main').getByRole('spinbutton', { name: 'Aantal' }).first().fill(String(qty));
  const before = await cartCount(page);
  await page.locator('#product-addtocart-button').click();
  await expect.poll(() => cartCount(page), { message: 'The cart count should increase' }).toBeGreaterThan(before);
}

// Quick-add buttons (minicart upsell, wishlist) open an options dialog: pick the first option and confirm.
async function chooseFirstOption(page) {
  const dialog = page.getByRole('dialog').filter({ visible: true })
    .filter({ has: page.getByRole('button', { name: /^\d+\s+\S+\s+€/ }) }).last();
  await expect(dialog, 'Choosing a product option should open').toBeVisible();
  await dialog.getByRole('button', { name: /^\d+\s+\S+\s+€/ }).first().click();
  await dialog.getByRole('button', { name: 'In Winkelwagen', exact: true }).click();
}

async function openCartDrawer(page) {
  await cartButton(page).click();
  await expect(cartDrawer(page)).toBeVisible();
}

// Fills the delivery step with the labelled test customer and picks a MyParcel home delivery slot.
async function fillDelivery(page) {
  const data = shop.testOrder;
  const timeSlot = page.getByRole('radio', { name: /\d{1,2}:\d{2}.*€/ }).first();
  // MyParcel on staging sometimes returns no time slots after several quick checkouts; reload once.
  for (let attempt = 1; attempt <= 2; attempt++) {
    await expectLoaded(await page.goto('/checkout/'));
    await page.locator('#guest_details-email_address').fill(data.email);
    await page.locator('#shipping-firstname').fill(data.firstname);
    await page.locator('#shipping-lastname').fill(data.lastname);
    await page.locator('#shipping-telephone').fill(data.telephone);
    await page.locator('#shipping-street').fill(data.street);
    await page.locator('#shipping-postcode').fill(data.postcode);
    await page.locator('#shipping-city').fill(data.city);
    await expect(page.getByRole('radio', { name: /Thuis of op het werk bezorgd/ }), 'MyParcel should offer home delivery')
      .toBeVisible({ timeout: 30_000 });
    if (await timeSlot.waitFor({ timeout: 20_000 }).then(() => true, () => false)) break;
  }
  await expect(timeSlot, 'MyParcel should offer a home delivery time slot').toBeVisible();
  await timeSlot.check();
}

async function goToPayment(page) {
  await fillDelivery(page);
  await page.getByRole('button', { name: 'Betaling selecteren' }).click();
  await expect(page).toHaveURL(/step\/payment/);
  await expect(page.getByRole('group', { name: 'Betaalmethode:' })).toBeVisible();
}

// Places a staging order marked as a test: TEST Playwright customer, test note, offline payment.
async function placeTestOrder(page) {
  await page.locator('#payment-method-checkmo').check();
  await page.getByRole('textbox', { name: 'Extra informatie' }).fill(shop.testOrder.label);
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/checkout\/onepage\/success/, { timeout: 60_000 });
  await expect(page.getByText(shop.successMessage)).toBeVisible();
}

// Reads an amount such as "Totaal € 9,90" from the cart page summary.
async function cartAmount(page, label) {
  const text = await page.getByRole('main').innerText();
  const match = [...text.matchAll(label)].pop();
  return match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : NaN;
}
const cartTotal = page => cartAmount(page, /(?<!sub)totaal\s*€\s*([\d.,]+)/gi);
const cartSubtotal = page => cartAmount(page, /subtotaal[^€]{0,40}€\s*([\d.,]+)/gi);

async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

module.exports = {
  shop, cartButton, cartDrawer, expectLoaded, cartCount, addProduct, chooseFirstOption, openCartDrawer,
  fillDelivery, goToPayment, placeTestOrder, cartTotal, cartSubtotal, horizontalOverflow,
};
