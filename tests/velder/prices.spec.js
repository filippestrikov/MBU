const { test, expect } = require('@playwright/test');
const { site, expectLoaded, main } = require('./shop');

// V2-56: product 188843 (CT entity) must show "prijs per collo" on every device. Uses the logged-in TST customer.
const product = site.priceUnitProduct;

for (const [label, viewport] of [
  ['desktop', site.viewports.desktop1366],
  ['mobile', site.viewports.iphone13],
  ['tablet portrait', { width: 768, height: 1024 }],
  ['tablet landscape', { width: 1024, height: 768 }],
]) {
  test(`[V2-56] Verify CT-entity product shows 'prijs per collo' on ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${product.sku}`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(product.name);
    const unit = main(page).getByText(/per\s+(collo|st|stuk|kg)\b/i).first();
    await expect(unit).toBeVisible();
    await expect(unit, `Product ${product.sku} should be priced per collo`).toContainText(new RegExp(`per\\s+${product.expectedUnit}`, 'i'));
  });
}
