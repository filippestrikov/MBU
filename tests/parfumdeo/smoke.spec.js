const { test, expect } = require('@playwright/test');
const { site, expectLoaded, addProduct } = require('./shop');
const { adminLogin, adminMenu } = require('../common/magento-admin');

test.describe('PDI-15 / PDI-139 smoke', () => {
  test('[PDI-15] Smoke-test storefront after module updates', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`${new URL(page.url()).pathname}: ${error.message}`));
    for (const path of ['/', site.category, site.product.path, `/catalogsearch/result/?q=${site.searchTerm}`]) {
      await expectLoaded(await page.goto(path));
      await expect(page.getByRole('main')).toBeVisible();
    }
    await addProduct(page);
    await expectLoaded(await page.goto('/checkout/cart/'));
    await expectLoaded(await page.goto('/checkout/'));
    await expect(page.getByRole('heading', { name: 'Afrekenen' })).toBeVisible();
    expect.soft(errors, 'No JavaScript errors on the main storefront pages').toEqual([]);
  });

  test('[PDI-15] Smoke-test Magento Admin after module updates', async ({ page }) => {
    test.skip(!process.env.PARFUMDEO_ADMIN_URL, 'Needs PARFUMDEO_ADMIN_* in .env.');
    await adminLogin(page, {
      url: process.env.PARFUMDEO_ADMIN_URL, user: process.env.PARFUMDEO_ADMIN_USER, password: process.env.PARFUMDEO_ADMIN_PASSWORD,
    });
    for (const [section, item] of [['catalog', 'Products'], ['sales', 'Orders'], ['stores', 'Configuration']]) {
      await adminMenu(page, section, item);
      await expect(page.getByRole('heading', { level: 1 }), `${item} should show its page title`).toBeVisible();
    }
  });
});

// reCAPTCHA counts as configured when the page carries a site key or loads Google's script.
const recaptchaConfigured = page => page.evaluate(() =>
  /data-sitekey|google\.com\/recaptcha|recaptcha\/api\.js|grecaptcha\.execute/i.test(document.documentElement.innerHTML));

test.describe('PDI-19 reCAPTCHA', () => {
  // /contact/ on dev is a content page without a form, so it is not checked here.
  for (const path of ['/customer/account/login/', '/customer/account/create/']) {
    test(`[PDI-19] Protect standard Magento storefront forms with reCAPTCHA v3 (${path})`, async ({ page }) => {
      const recaptcha = [];
      page.on('request', request => { if (/recaptcha|gstatic\.com\/recaptcha/.test(request.url())) recaptcha.push(request.url()); });
      await expectLoaded(await page.goto(path));
      const configured = await recaptchaConfigured(page);
      test.skip(!configured, 'reCAPTCHA is not configured on dev (Confluence PDI-56: reCAPTCHA is only active on PRD).');
      // Hyvä loads reCAPTCHA when a form field gets focus.
      await page.getByRole('main').getByRole('textbox').first().click();
      await expect.poll(() => recaptcha.length, { message: 'reCAPTCHA should load for the form', timeout: 15_000 }).toBeGreaterThan(0);
    });
  }

  test('[PDI-19] Hide visible reCAPTCHA icon/badge as implemented', async ({ page }) => {
    await expectLoaded(await page.goto('/customer/account/login/'));
    const configured = await recaptchaConfigured(page);
    test.skip(!configured, 'reCAPTCHA is not configured on dev (Confluence PDI-56: reCAPTCHA is only active on PRD).');
    await page.getByRole('main').getByRole('textbox').first().click();
    // stable: Google renders the badge with this class and no accessible name.
    const badge = page.locator('.grecaptcha-badge');
    await expect(badge, 'reCAPTCHA should render its badge').toBeAttached({ timeout: 15_000 });
    const visibleBadges = () => badge.evaluateAll(badges =>
      badges.filter(b => getComputedStyle(b).visibility !== 'hidden' && b.getBoundingClientRect().width > 0 && getComputedStyle(b).opacity !== '0').length);
    await expect.poll(visibleBadges, { message: 'The reCAPTCHA badge should be hidden' }).toBe(0);
  });
});

test.describe('PDI-32 / PDI-103 footer and ratings', () => {
  const footerLinks = page => page.getByRole('contentinfo').getByRole('link')
    .filter({ hasText: /^(Zekerheden|Veelgestelde vragen|Betaalmogelijkheden|Bezorging|Retourneren|Contact|Over ons|Werken bij ParfumDeo\.nl|Algemene voorwaarden|Privacy beleid|Sitemap|Cadeaukaarten)$/ });
  const decoration = locator => locator.evaluate(el => getComputedStyle(el).textDecorationLine);

  test('[PDI-32] Do not underline footer links by default', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    const links = await footerLinks(page).all();
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect.soft(await decoration(link), `${await link.innerText()} should not be underlined`).not.toContain('underline');
  });

  test('[PDI-32] Underline footer links only on hover', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    const link = footerLinks(page).first();
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    await expect.poll(() => decoration(link)).toContain('underline');
    await page.mouse.move(0, 0);
    await expect.poll(() => decoration(link)).not.toContain('underline');
  });

  test('[PDI-103] Display current Kiyoh rating consistently', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    const text = await page.locator('body').innerText();
    const ratings = [...text.matchAll(/(\d[.,]\d)\s*(?:na|uit|\/)\s*(\d[\d.]*)\s*beoordelingen/gi)].map(m => `${m[1].replace(',', '.')} / ${m[2]}`);
    expect(ratings.length, 'The Kiyoh rating should be shown').toBeGreaterThan(0);
    expect(new Set(ratings).size, `All Kiyoh ratings should match: ${ratings.join(', ')}`).toBe(1);
  });
});
