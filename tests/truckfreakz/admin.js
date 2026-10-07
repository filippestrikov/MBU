const { expect } = require('@playwright/test');
const { adminLogin: login, adminMenu, searchGrid, openGridRow } = require('../common/magento-admin');

const hasAdmin = () => Boolean(process.env.TRUCKFREAKZ_ADMIN_URL && process.env.TRUCKFREAKZ_ADMIN_USER && process.env.TRUCKFREAKZ_ADMIN_PASSWORD);

const adminLogin = page => login(page, {
  url: process.env.TRUCKFREAKZ_ADMIN_URL, user: process.env.TRUCKFREAKZ_ADMIN_USER, password: process.env.TRUCKFREAKZ_ADMIN_PASSWORD,
});

async function openProduct(page, sku) {
  await adminMenu(page, 'catalog', 'Products');
  await searchGrid(page, sku);
  await openGridRow(page, sku);
  await expect(page.getByRole('textbox', { name: 'Product Name' }), 'The product form should load').toBeVisible({ timeout: 90_000 });
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

module.exports = { hasAdmin, adminLogin, openProduct, productFields };
