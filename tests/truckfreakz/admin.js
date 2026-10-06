const { expect } = require('@playwright/test');

const hasAdmin = () => Boolean(process.env.TRUCKFREAKZ_ADMIN_URL && process.env.TRUCKFREAKZ_ADMIN_USER && process.env.TRUCKFREAKZ_ADMIN_PASSWORD);

async function adminLogin(page) {
  await page.goto(process.env.TRUCKFREAKZ_ADMIN_URL);
  const username = page.getByRole('textbox', { name: 'Username *' });
  if (await username.isVisible()) {
    await username.fill(process.env.TRUCKFREAKZ_ADMIN_USER);
    await page.getByRole('textbox', { name: 'Password *' }).fill(process.env.TRUCKFREAKZ_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page.getByRole('link', { name: /Dashboard/ }).first()).toBeVisible();
}

// Admin URLs carry secret keys, so take the keyed URL from the (hidden) menu link.
async function adminMenu(page, section, item) {
  const link = page.locator('#nav > li').filter({ hasText: section }).first()
    .getByRole('link', { name: item, exact: true, includeHidden: true }).first();
  await page.goto(await link.getAttribute('href'));
}

// The grid also renders hidden copies of its wrapper and search box for the sticky header.
const grid = page => page.locator('.admin__data-grid-wrap').filter({ visible: true }).first();

async function openProduct(page, sku) {
  await adminMenu(page, /Catalog/, 'Products');
  await expect(grid(page).locator('tbody tr').first()).toBeVisible({ timeout: 60_000 });
  const search = page.getByRole('textbox', { name: 'Search by keyword' }).filter({ visible: true }).first();
  await search.fill(sku);
  await search.press('Enter');
  const row = grid(page).locator('tbody tr.data-row').filter({ hasText: sku }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await page.goto(await row.getByRole('link', { name: 'Edit', includeHidden: true }).getAttribute('href'));
  await expect(page.locator('.fieldset-wrapper-title').filter({ visible: true }).first()).toBeVisible({ timeout: 90_000 });
}

// Reads product form fields from the admin uiRegistry: value, option labels and the labels of all
// parent components (field container, fieldset/group, ...).
const productFields = (page, indexes) => page.evaluate(wanted => new Promise(resolve => require(['uiRegistry'], registry => {
  const result = {};
  for (const index of wanted) {
    const field = registry.get(c => c.index === index && typeof c.value === 'function');
    if (!field) continue;
    const groups = [];
    for (let parent = registry.get(field.parentName); parent; parent = parent.parentName && registry.get(parent.parentName)) {
      if (parent.label) groups.push(String(parent.label));
    }
    result[index] = {
      value: field.value(),
      options: (typeof field.options === 'function' ? field.options() : []).map(o => ({ value: String(o.value), label: o.label })),
      groups,
    };
  }
  resolve(result);
})), indexes);

module.exports = { hasAdmin, adminLogin, adminMenu, openProduct, productFields };
