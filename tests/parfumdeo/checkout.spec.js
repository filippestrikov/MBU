const { test, expect } = require('@playwright/test');
const { site, expectLoaded, addProduct, fillShipping, goToPayment, placeOrderButton, chooseMollieStatus } = require('./shop');

// Hyvä Checkout steps change without full page loads; flows need more than the default 30s.
test.describe.configure({ timeout: 150_000 });

const shippingRadios = page => page.getByRole('group', { name: 'Verzendmethodes' }).getByRole('radio');
const paymentRadio = (page, value) => page.locator(`#payment-method-${value}`);

test.describe('PDI-68 / PDI-34 shipping step', () => {
  test('[PDI-68] Offer Trunkrs first, then PostNL, DHL and DPD', async ({ page }) => {
    await addProduct(page);
    await expectLoaded(await page.goto('/checkout/'));
    const names = (await shippingRadios(page).evaluateAll(radios => radios.map(r => r.labels?.[0]?.innerText || r.getAttribute('aria-label') || ''))).map(n => n.replace(/\s+/g, ' ').trim());
    const labels = (await page.getByRole('group', { name: 'Verzendmethodes' }).innerText()).replace(/\s+/g, ' ');
    expect(labels, 'Trunkrs evening delivery should be offered first at € 5,95').toMatch(new RegExp(`^.*?${site.shipping.firstMethod}.*?${site.shipping.firstPrice.replace(/\s/g, '\\s?')}`));
    for (const carrier of site.shipping.expectedCarriers) {
      expect.soft(labels, `${carrier} should be offered (Confluence PDI-68)`).toContain(carrier);
    }
    expect(names.length).toBeGreaterThan(0);
  });

  test('[PDI-34] Display Verwachte verzenddatum on a white background', async ({ page }) => {
    await addProduct(page);
    await expectLoaded(await page.goto('/checkout/'));
    const heading = page.getByRole('heading', { name: 'Verwachte verzenddatum' });
    await expect(heading).toBeVisible();
    const background = await heading.evaluate(el => {
      for (let node = el; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'none';
    });
    expect(background, 'The block should sit on a white background').toBe('rgb(255, 255, 255)');
  });

  test('[PDI-103] Handle province selection correctly', async ({ page }) => {
    await addProduct(page);
    await expectLoaded(await page.goto('/checkout/'));
    await page.locator('#shipping-country_id').selectOption({ label: 'Portugal' });
    const region = page.locator('#shipping-region');
    await expect(region, 'A province selector should appear for Portugal').toBeVisible();
    const options = await region.locator('option').allInnerTexts();
    expect(options.length, 'Provinces should be listed').toBeGreaterThan(2);
    await region.selectOption({ index: 1 });
    await expect(region).not.toHaveValue('');
  });
});

test.describe('PDI-103 / PDI-122 / PDI-41 payment step', () => {
  test.beforeEach(async ({ page }) => {
    await addProduct(page);
    await fillShipping(page);
    await goToPayment(page);
  });

  test('[PDI-103] Show Terms and Conditions link in checkout', async ({ page }) => {
    const link = page.getByRole('group', { name: 'Algemene Voorwaarden' }).getByRole('link', { name: /algemene voorwaarden/i });
    await expect(page.getByRole('checkbox', { name: /akkoord met de algemene voorwaarden/i })).toBeVisible();
    await expect(link).toHaveAttribute('href', /algemene-voorwaarden/);
    await expect(link, 'The terms should open in a new tab (PDI-100)').toHaveAttribute('target', '_blank');
  });

  test('[PDI-103] Provide a way back to the beginning of checkout', async ({ page }) => {
    await page.getByRole('button', { name: 'Terug naar verzending' }).click();
    await expect(page.getByRole('button', { name: 'Verder naar overzicht & betalen' })).toBeVisible();
    await expect(page.locator('#shipping-firstname')).toHaveValue(site.testOrder.firstname);
  });

  test('[PDI-103] Do not freeze checkout when navigating back', async ({ page }) => {
    for (let round = 1; round <= 3; round++) {
      await page.getByRole('button', { name: 'Terug naar verzending' }).click();
      await expect(page.getByRole('button', { name: 'Verder naar overzicht & betalen' }), `Round ${round}: back to shipping`).toBeVisible();
      await goToPayment(page);
    }
  });

  test('[PDI-103] Do not keep iDEAL selected when gift card payment is chosen', async ({ page }) => {
    await paymentRadio(page, 'mollie_methods_ideal').check();
    await page.locator('#payment-method-coupon-code-option, #coupon-code-option, input[value="coupon_code"]').first().check();
    await expect(paymentRadio(page, 'mollie_methods_ideal'), 'iDEAL should be deselected').not.toBeChecked();
  });

  test('[PDI-103] Use radio-style selection for mutually exclusive payment methods', async ({ page }) => {
    const types = await page.locator('input[name="payment-method-option"]').evaluateAll(inputs => inputs.map(i => i.type));
    expect(types.length).toBeGreaterThan(1);
    expect(new Set(types), 'All payment options (incl. gift card) should be one radio group').toEqual(new Set(['radio']));
  });
});

test.describe('PDI-139 guest checkout (Mollie test mode)', () => {
  test('[PDI-139] Complete guest checkout after patch', async ({ page }) => {
    // Places a paid TEST order on dev through Mollie test mode.
    await addProduct(page);
    await fillShipping(page);
    await goToPayment(page);
    await paymentRadio(page, 'mollie_methods_ideal').check();
    await page.getByRole('checkbox', { name: /akkoord met de algemene voorwaarden/i }).check();
    await placeOrderButton(page).click();
    await page.waitForURL(/mollie\.com/, { timeout: 60_000 });
    await chooseMollieStatus(page, /paid|betaald/i);
    await page.waitForURL(/checkout\/onepage\/success|success/, { timeout: 90_000 });
    await expect(page.getByRole('main')).toContainText(/bedankt|bestelling/i);
  });
});
