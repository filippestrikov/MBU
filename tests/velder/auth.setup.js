const { test: setup, expect } = require('@playwright/test');
const site = require('./fixtures/site.json');

// Logs in once (reCAPTCHA makes a login take ~15s) and stores the session for the other tests.
// The TST customer is an internal MBU account; the session file lives in the Git-ignored .auth/.
setup('log in as the TST customer', async ({ page }) => {
  setup.setTimeout(120_000);
  await page.goto('/customer/account/login/');
  await page.getByRole('button', { name: 'Alle cookies accepteren' }).click({ timeout: 10_000 }).catch(() => {});
  await page.getByRole('textbox', { name: 'E-mail' }).fill(process.env.VELDER_CUSTOMER_EMAIL);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.VELDER_CUSTOMER_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.waitForURL(url => !url.pathname.includes('customer/account/login'), { timeout: 90_000 });
  await expect(page.getByRole('button', { name: /Mijn account/ })).toBeVisible();
  await page.context().storageState({ path: site.storageState });
});
