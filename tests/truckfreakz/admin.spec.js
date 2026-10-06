const { test, expect } = require('@playwright/test');
const { site, storeBase, expectLoaded } = require('./shop');
const { hasAdmin, adminLogin, openProduct, productFields } = require('./admin');

// Read-only Magento Admin checks on TST. Nothing is saved.
test.describe.configure({ timeout: 120_000 });
test.skip(!hasAdmin(), 'Needs TRUCKFREAKZ_ADMIN_URL/USER/PASSWORD in .env.');

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
  await openProduct(page, site.configurable.sku);
});

test('[TD-15] Create nine specification attributes through data patch', async ({ page }) => {
  const fields = await productFields(page, site.specAttributes);
  expect(Object.keys(fields).sort(), 'All nine specification attributes should be on the product form').toEqual([...site.specAttributes].sort());
  for (const code of site.specAttributes) {
    expect.soft(fields[code].groups, `${code} should be in the Specifications group`).toContain('Specifications');
  }
});

test('[TD-15] Load brand options dynamically from configured parent category', async ({ page }) => {
  const { suitable_for: suitable, product_label: label } = await productFields(page, ['suitable_for', 'product_label']);
  // Options come from the direct children of the "Truck brand" category, as shown in the storefront menu.
  expect(suitable.options.map(o => o.label)).toEqual(site.truckBrands);
  const selected = suitable.options.filter(o => suitable.value.map(String).includes(o.value)).map(o => o.label);
  expect(selected, 'Storefront "Suitable for" should match the admin selection').toEqual(site.configurable.suitableFor);
  expect(label.options.find(o => o.value === String(label.value))?.label).toBe(site.configurable.label);

  await expectLoaded(await page.goto(`${storeBase('en')}/${site.stores.en.brandPath}.html`));
  for (const brand of site.truckBrands) {
    await expect.soft(page.getByRole('main').getByRole('link', { name: brand, exact: true }).first(), `${brand} subcategory`).toBeVisible();
  }
});
