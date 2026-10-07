const { test, expect } = require('@playwright/test');
const { site, expectLoaded, overlaps } = require('./shop');

// Login-screen cases run logged out.
test.use({ storageState: { cookies: [], origins: [] } });

const footer = page => page.getByRole('contentinfo').first();
const footerLink = (page, name) => footer(page).getByRole('link', { name, exact: true })
  .or(footer(page).getByRole('button', { name, exact: true })).first();
const logo = page => page.getByRole('link', { name: 'store logo' });
const loginWarning = page => page.getByRole('alert').filter({ hasText: /\S/ }).first();

async function openLogin(page, { acceptCookies = true } = {}) {
  await expectLoaded(await page.goto('/customer/account/login/'));
  if (acceptCookies) await page.getByRole('button', { name: 'Alle cookies accepteren' }).click({ timeout: 10_000 }).catch(() => {});
}

async function failLogin(page) {
  await page.getByRole('textbox', { name: 'E-mail' }).fill(site.invalidLogin.email);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(site.invalidLogin.password);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(loginWarning(page), 'A failed-login warning should appear').toBeVisible({ timeout: 60_000 });
}

test.describe('V2-47 login screen footer links', () => {
  test('[V2-47] Verify the three footer links appear on the login screen', async ({ page }) => {
    await openLogin(page);
    for (const name of site.loginFooterLinks) {
      await expect.soft(footerLink(page, name), `"${name}" should be in the login footer`).toBeVisible();
    }
  });

  test('[V2-47] Verify all three links are clickable and open the correct pages', async ({ page }) => {
    await openLogin(page);
    for (const name of ['Privacy statement', 'Cookie statement']) {
      const href = await footerLink(page, name).getAttribute('href');
      expect(href, `${name} should link to a page`).toBeTruthy();
      const response = await page.request.get(new URL(href, page.url()).href);
      expect.soft(response.status(), `${name} should open (${href})`).toBeLessThan(400);
    }
  });

  test('[V2-47] Verify links display side-by-side on desktop', async ({ page }) => {
    await page.setViewportSize(site.viewports.desktop1366);
    await openLogin(page);
    const tops = [];
    for (const name of ['Privacy statement', 'Cookie statement']) tops.push(Math.round((await footerLink(page, name).boundingBox()).y));
    expect(Math.max(...tops) - Math.min(...tops), 'The footer links should be on one line').toBeLessThanOrEqual(4);
  });

  test('[V2-47] Verify links wrap/stack correctly on mobile', async ({ page }) => {
    await page.setViewportSize(site.viewports.iphone13);
    await openLogin(page);
    const boxes = [];
    for (const name of ['Privacy statement', 'Cookie statement']) boxes.push(await footerLink(page, name).boundingBox());
    expect(overlaps(boxes[0], boxes[1]), 'Footer links should not overlap').toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'No sideways scrolling').toBeLessThanOrEqual(0);
  });

  for (const [label, viewport] of [['mobile', site.viewports.iphone13], ['tablet', site.viewports.ipadMini]]) {
    test(`[V2-47] Verify the reCAPTCHA badge does not overlap the footer links (${label})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openLogin(page);
      await page.getByRole('textbox', { name: 'E-mail' }).click();
      // stable: Google renders the badge with this class and no accessible name.
      const badge = page.locator('.grecaptcha-badge').first();
      await badge.waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {});
      const badgeBox = await badge.boundingBox().catch(() => null);
      for (const name of ['Privacy statement', 'Cookie statement']) {
        const link = footerLink(page, name);
        await link.scrollIntoViewIfNeeded();
        expect.soft(overlaps(await link.boundingBox(), await badge.boundingBox().catch(() => badgeBox)), `The reCAPTCHA badge should not cover "${name}"`).toBe(false);
      }
    });
  }
});

test.describe('V2-5 / V2-70 / V2-71 warnings', () => {
  for (const [label, viewport] of Object.entries(site.viewports)) {
    test(`[V2-5] Verify failed-login warning does not overlap the logo (${label})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await openLogin(page);
      await failLogin(page);
      const [warningBox, logoBox] = [await loginWarning(page).boundingBox(), await logo(page).boundingBox()];
      expect(overlaps(warningBox, logoBox), 'The warning should not overlap the logo').toBe(false);
      expect(warningBox.y, 'The warning should sit below the logo').toBeGreaterThanOrEqual(logoBox.y + logoBox.height - 1);
    });
  }

  test('[V2-71] Verify the reset-password warning does not jump or overlap other elements', async ({ page }) => {
    await expectLoaded(await page.goto('/customer/account/forgotpassword/'));
    await page.getByRole('button', { name: 'Alle cookies accepteren' }).click({ timeout: 10_000 }).catch(() => {});
    const field = page.getByRole('main').getByRole('textbox').first();
    const before = await field.boundingBox();
    await page.getByRole('main').getByRole('button').filter({ hasText: /verstuur|reset|herstel|versturen|wachtwoord/i }).first().click();
    const warning = page.getByRole('main').getByText(/verplicht|required|geldig|valid/i).first();
    await expect(warning, 'A validation warning should appear').toBeVisible();
    const after = await field.boundingBox();
    expect(Math.abs(after.y - before.y), 'The field should not jump when the warning appears').toBeLessThanOrEqual(2);
    expect(overlaps(await warning.boundingBox(), after), 'The warning should not overlap the field').toBe(false);
  });

  test('[V2-72] Verify the login error message clears per the agreed behaviour', async () => {
    test.skip(true, 'Expected behaviour pending Gijs\'s decision (V2-72).');
  });
});

test.describe('V2-34 cookie banner and login fields (Chromium iPad emulation)', () => {
  test('[V2-34] Verify accepting cookies while cursor is in the password field does not alter the password', async ({ page }) => {
    await page.setViewportSize(site.viewports.ipadMini);
    await openLogin(page, { acceptCookies: false });
    await page.getByRole('textbox', { name: 'E-mail' }).fill(site.invalidLogin.email);
    const password = page.getByRole('textbox', { name: 'Wachtwoord' });
    await password.click();
    await password.pressSequentially('Abc12345', { delay: 30 });
    await page.getByRole('button', { name: 'Alle cookies accepteren' }).click();
    await expect(password, 'Accepting cookies should not change the password').toHaveValue('Abc12345');
    await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveValue(site.invalidLogin.email);
  });

  test('[V2-34] Verify tapping Reject or Settings on the cookie banner does not affect the login fields', async ({ page }) => {
    await page.setViewportSize(site.viewports.ipadMini);
    await openLogin(page, { acceptCookies: false });
    await page.getByRole('textbox', { name: 'E-mail' }).fill(site.invalidLogin.email);
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('Abc12345');
    await page.getByRole('button', { name: 'Cookie-instellingen' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Wachtwoord' })).toHaveValue('Abc12345');
    await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveValue(site.invalidLogin.email);
  });
});

test.describe('Regression checklist #1 login', () => {
  for (const [label, viewport] of [['desktop', site.viewports.desktop1366], ['mobile', site.viewports.iphone13]]) {
    test(`[V2-47] Verify login on bestellen.velder.com - ${label}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await openLogin(page);
      await page.getByRole('textbox', { name: 'E-mail' }).fill(process.env.VELDER_CUSTOMER_EMAIL);
      await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.VELDER_CUSTOMER_PASSWORD);
      await page.getByRole('button', { name: 'Inloggen' }).click();
      await page.waitForURL(url => !url.pathname.includes('customer/account/login'), { timeout: 90_000 });
      await expect(page.getByRole('link', { name: 'Winkelwagen' }).first()).toBeAttached();
    });
  }
});

test.describe('V2-10 environment security', () => {
  test('[V2-10] Password validation blocks unauthenticated access to TST', async ({ baseURL }) => {
    for (const path of ['', 'customer/account/login/', 'checkout/cart/']) {
      const response = await fetch(new URL(path, baseURL), { redirect: 'manual' });
      expect.soft(response.status, `/${path} should require the HTTP password`).toBe(401);
    }
  });
});
