const { test, expect, devices } = require('@playwright/test');
const { site, expectLoaded } = require('./shop');

// Uses the dev customer account. The access sheet shows it is the same account as on PRD,
// so tests only read data and never change addresses, passwords or orders.
test.skip(!process.env.PARFUMDEO_CUSTOMER_EMAIL, 'Needs PARFUMDEO_CUSTOMER_EMAIL/PASSWORD in .env.');
test.describe.configure({ mode: 'serial' });

async function logIn(page) {
  await expectLoaded(await page.goto('/customer/account/login/'));
  await page.getByRole('textbox', { name: /e-mail/i }).first().fill(process.env.PARFUMDEO_CUSTOMER_EMAIL);
  await page.getByRole('textbox', { name: /wachtwoord/i }).first().fill(process.env.PARFUMDEO_CUSTOMER_PASSWORD);
  await page.getByRole('main').getByRole('button', { name: /inloggen|log in/i }).first().click();
  await expect(page).toHaveURL(/customer\/account\/?($|\?|index)/);
}

async function logOut(page) {
  await expectLoaded(await page.goto('/customer/account/logout/'));
  await expectLoaded(await page.goto('/'));
  await expect(page.getByRole('link', { name: 'Inloggen' })).toBeVisible();
}

test.describe('PDI-139 account and session', () => {
  test('[PDI-139] Log in and log out after the security patch', async ({ page }) => {
    await logIn(page);
    await expectLoaded(await page.goto('/'));
    await expect(page.getByRole('link', { name: 'Inloggen' }), 'Logged-in customers should not see Inloggen').toHaveCount(0);
    await logOut(page);
  });

  test('[PDI-139] Keep customer session persistent during normal navigation', async ({ page }) => {
    await logIn(page);
    for (const path of ['/', site.category, site.product.path, '/checkout/cart/', '/customer/account/']) {
      await expectLoaded(await page.goto(path));
      await expect(page.getByRole('link', { name: 'Inloggen' }), `${path} should keep the session`).toHaveCount(0);
    }
    await page.reload();
    await expect(page).toHaveURL(/customer\/account/);
  });

  test('[PDI-139] Display My Account customer data correctly', async ({ page }) => {
    await logIn(page);
    await expect(page.getByRole('main')).toContainText(process.env.PARFUMDEO_CUSTOMER_EMAIL);
  });

  test('[PDI-139] Display order history after patch', async ({ page }) => {
    await logIn(page);
    await expectLoaded(await page.goto('/sales/order/history/'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(/exception|error/i);
  });

  test('[PDI-139] Manage customer addresses after patch (read-only)', async ({ page }) => {
    await logIn(page);
    await expectLoaded(await page.goto('/customer/address/'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('[PDI-141] Align Allow shopping assistance checkbox with the other account checkboxes', async ({ page }) => {
    await logIn(page);
    await expectLoaded(await page.goto('/customer/account/edit/'));
    const assistance = page.getByRole('checkbox', { name: new RegExp(site.copy.shoppingAssistance) });
    await expect(assistance).toBeVisible();
    // The three account-setting checkboxes (the reorder list further down has its own checkboxes).
    const settings = [/E-mailadres wijzigen/, /Wachtwoord wijzigen/, new RegExp(site.copy.shoppingAssistance)];
    const lefts = [];
    for (const name of settings) lefts.push(Math.round((await page.getByRole('checkbox', { name }).boundingBox()).x));
    expect(lefts.length, 'The edit page should show several checkboxes').toBeGreaterThan(1);
    expect(Math.max(...lefts) - Math.min(...lefts), 'All checkboxes should share the same left edge').toBeLessThanOrEqual(2);
  });

  test('[PDI-103] Use informal je wording in gift-card account area', async ({ page }) => {
    await logIn(page);
    await expectLoaded(await page.goto('/customer/account/'));
    const link = page.getByRole('link', { name: /cadeau/i }).first();
    await expect(link).toBeVisible();
    await link.click();
    const text = await page.getByRole('main').innerText();
    expect(text, 'Gift card area should use informal Dutch').not.toMatch(/\b(u|uw)\b/);
  });
});

test.describe('PDI-103 mobile login', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('[PDI-103] Log in after logout without mobile error', async ({ page }) => {
    await logIn(page);
    await logOut(page);
    await logIn(page);
    await expect(page.getByRole('alert').filter({ hasText: /fout|error|ongeldig|invalid/i })).toHaveCount(0);
  });
});
