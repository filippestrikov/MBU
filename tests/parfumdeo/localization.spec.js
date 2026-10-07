const { test, expect } = require('@playwright/test');
const { site, expectLoaded, addProduct, fillShipping, goToPayment, placeOrderButton, chooseMollieStatus } = require('./shop');

// Agreed Dutch copy comes from the Confluence page "PDI-56 - Dutch translations & transactional email texts".
const formal = /\b(u|uw|U|Uw)\b/;

test.describe('PDI-103 / PDI-116 / PDI-56 Dutch copy', () => {
  test('[PDI-103] Translate no-search-results message to Dutch', async ({ page }) => {
    await expectLoaded(await page.goto('/catalogsearch/result/?q=zzzqxnonexistingterm'));
    await expect(page.getByRole('main')).toContainText(site.copy.noSearchResults);
  });

  test('[PDI-103] Translate View X results in search', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    // The autocomplete reacts to key presses, not to a pasted value.
    const box = page.getByRole('searchbox', { name: 'Zoek' });
    await box.click();
    await box.pressSequentially(site.searchTerm, { delay: 100 });
    const suggestions = page.getByRole('link', { name: /result|resultat/i }).filter({ visible: true });
    await expect(suggestions.first(), 'The autocomplete should offer a link to all results').toBeVisible({ timeout: 15_000 });
    const text = (await suggestions.first().innerText()).trim();
    expect(text, 'The results link should be Dutch').not.toMatch(/\bView\b|\bresults\b/i);
  });

  test('[PDI-103] Use Kopen & afrekenen on orange order button', async ({ page }) => {
    await addProduct(page);
    await expectLoaded(await page.goto('/checkout/cart/'));
    const checkout = page.getByRole('main').getByRole('link', { name: /afrekenen/i }).first();
    await expect(checkout, 'The cart order button should read "Kopen & afrekenen" (PDI-56)').toHaveText(site.copy.orderButton);
  });

  test('[PDI-103] Capitalize 404 page title correctly', async ({ page }) => {
    const response = await page.goto('/playwright-test-page-that-does-not-exist');
    expect(response.status()).toBe(404);
    await expect(page.getByRole('main')).toContainText(site.copy.notFoundTitle);
  });

  test('[PDI-116] Display corrected password-reset request message', async ({ page }) => {
    // Unregistered address only: a registered one would e-mail a real customer (TST and PRD share accounts).
    await expectLoaded(await page.goto('/customer/account/forgotpassword/'));
    await page.getByRole('textbox', { name: /E-mailadres/ }).fill('playwright-test-reset@example.com');
    await page.getByRole('main').getByRole('button').filter({ hasText: /herstel|reset|verstuur|versturen|wachtwoord/i }).first().click();
    await expect(page.getByRole('alert').first()).toContainText(site.copy.passwordResetMessage);
  });

  test('[PDI-116] Use informal je/jij wording in forgot-password frontend copy', async ({ page }) => {
    await expectLoaded(await page.goto('/customer/account/forgotpassword/'));
    const text = await page.getByRole('main').innerText();
    expect(text, 'Forgot-password page should use informal Dutch (je/jij, not u/uw)').not.toMatch(formal);
    expect(text).not.toMatch(/\b(Forgot|password|Reset My Password|Please enter)\b/);
  });

  test('[PDI-103] Show Dutch validation when guest checkout address is empty', async ({ page }) => {
    await addProduct(page);
    await expectLoaded(await page.goto('/checkout/'));
    await page.getByRole('button', { name: 'Verder naar overzicht & betalen' }).click();
    const messages = page.locator('#maincontent').getByText(/verplicht|required/i);
    await expect(messages.first(), 'Required-field messages should appear').toBeVisible();
    for (const message of await messages.allInnerTexts()) {
      expect.soft(message, 'Validation should be Dutch').not.toMatch(/required field|This is a/i);
    }
  });

  test('[PDI-142] Display Dutch out-of-stock notification in cart', async () => {
    test.skip(true, 'Needs an out-of-stock product that is still in a cart on dev (fixture to be agreed).');
  });
});

test.describe('PDI-135 / PDI-58 failed payment (Mollie test mode)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('[PDI-135] Display informal Dutch failed-payment message', async ({ page }) => {
    // Places a TEST order on dev and fails it in Mollie test mode; the order is cancelled by Magento.
    await addProduct(page);
    await fillShipping(page);
    await goToPayment(page);
    await page.locator('#payment-method-mollie_methods_ideal').check();
    await page.getByRole('checkbox', { name: /akkoord met de algemene voorwaarden/i }).check();
    await placeOrderButton(page).click();
    await page.waitForURL(/mollie\.com/, { timeout: 60_000 });
    await chooseMollieStatus(page, /failed|mislukt/i);
    await page.waitForURL(/mbu\.dev/, { timeout: 60_000 });
    const message = page.getByRole('alert').filter({ hasText: /mislukt|failed/i }).first();
    await expect(message).toBeVisible();
    await expect(message).toContainText(site.copy.failedPayment);
  });
});

