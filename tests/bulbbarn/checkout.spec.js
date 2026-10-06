const { test, expect } = require('@playwright/test');
const { shop, addProduct, fillDelivery, goToPayment, placeTestOrder } = require('./shop');

// Full checkout flows on staging (MyParcel widget, Magewire steps) need more than the default 30s.
test.describe.configure({ timeout: 120_000 });

const idealOption = page => page.locator('label').filter({ has: page.locator('#payment-method-mollie_methods_ideal') });
const idealLogo = page => idealOption(page).getByRole('img').first();

async function openPayment(page) {
  await addProduct(page);
  await goToPayment(page);
}

// The logo must be visible, reasonably sized, inside its option and clear of the label text.
async function expectIdealLogoLayout(page) {
  await idealLogo(page).scrollIntoViewIfNeeded();
  await expect(idealLogo(page)).toBeVisible();
  const problems = await idealOption(page).evaluate(option => {
    const logo = option.querySelector('[role="img"], img');
    const label = [...option.querySelectorAll('p')].find(p => p.textContent.trim());
    const box = el => el.getBoundingClientRect();
    const [l, o] = [box(logo), box(option)];
    const issues = [];
    if (l.width < 24 || l.height < 16) issues.push(`logo too small (${l.width}x${l.height})`);
    if (l.left < o.left - 1 || l.right > o.right + 1 || l.top < o.top - 1 || l.bottom > o.bottom + 1) issues.push('logo outside option');
    if (l.right > document.documentElement.clientWidth) issues.push('logo clipped by viewport');
    if (label) {
      const t = box(label);
      if (l.left < t.right - 1 && l.right > t.left + 1 && l.top < t.bottom - 1 && l.bottom > t.top + 1) issues.push('logo overlaps label');
    }
    return issues;
  });
  expect(problems, 'The iDEAL logo should fit cleanly in its payment option').toEqual([]);
}

test.describe('BBM2-69 Ideal-WERO logo', () => {
  test('[BBM2-69] Display Ideal-WERO logo instead of legacy iDEAL logo', async ({ page }) => {
    await openPayment(page);
    const radio = page.locator('#payment-method-mollie_methods_ideal');
    await expect(radio).toBeVisible();
    await expect(radio, 'The iDEAL option should carry the iDEAL | Wero branding').toHaveAccessibleName(/wero/i);
  });

  for (const viewport of [{ width: 1366, height: 786 }, { width: 1920, height: 1024 }]) {
    test(`[BBM2-69] Render Ideal-WERO logo correctly on desktop (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openPayment(page);
      await expectIdealLogoLayout(page);
    });
  }

  test('[BBM2-69] Render Ideal-WERO logo correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPayment(page);
    await expectIdealLogoLayout(page);
  });

  test('[BBM2-69] Render Ideal-WERO logo correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openPayment(page);
    await expectIdealLogoLayout(page);
  });

  test('[BBM2-69] Keep payment option functional after logo replacement', async ({ page }) => {
    await openPayment(page);
    await idealOption(page).getByRole('radio').check();
    await expect(idealOption(page).getByRole('radio')).toBeChecked();
    await expect(page.getByRole('button', { name: 'Place Order' })).toBeEnabled();
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  });
});

test.describe('BBM2-73 / BBM2-74 / BBM2-76 payment and shipping', () => {
  for (const ticket of ['BBM2-73', 'BBM2-74']) {
    const title = ticket === 'BBM2-73' ? 'Verify Mollie payment integration in checkout' : 'Verify Mollie payment methods on staging';
    test(`[${ticket}] ${title}`, async ({ page }) => {
      await openPayment(page);
      for (const [value, label] of Object.entries(shop.mollieMethods)) {
        const radio = page.locator(`#payment-method-${value}`);
        await expect.soft(page.locator(`#payment-method-option-${value}`), `${label} should be offered`).toContainText(label);
        await radio.check();
        await expect.soft(radio, `${label} should be selectable`).toBeChecked();
      }
      await expect(page.getByRole('main').getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    });
  }

  test('[BBM2-73] Verify MyParcel shipping integration in checkout', async ({ page }) => {
    await openPayment(page);
    await expect(page.getByText(/Shipping & Handling \(MyParcel/)).toBeVisible();
    await placeTestOrder(page);
  });

  test('[BBM2-74] Verify MyParcel shipping methods and checkout compatibility', async ({ page }) => {
    await addProduct(page);
    await fillDelivery(page);
    await expect(page.getByRole('radio', { name: /Thuis of op het werk bezorgd/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Ophalen bij een PostNL locatie/ })).toBeVisible();
    await page.getByRole('button', { name: 'Betaling selecteren' }).click();
    await expect(page).toHaveURL(/step\/payment/);
    await placeTestOrder(page);
  });

  test('[BBM2-76] Place order successfully after MyParcel serialization fix', async ({ page }) => {
    await openPayment(page);
    await placeTestOrder(page);
    await expect(page.getByRole('row', { name: /Betaalmethode/ })).toContainText('Check / Money order');
    await expect(page.getByText(shop.product.name)).toBeVisible();
  });
});
