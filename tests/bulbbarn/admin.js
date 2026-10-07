const { expect } = require('@playwright/test');
const admin = require('../common/magento-admin');
const shop = require('./fixtures/shop.json');

const adminUrl = () => process.env.BULBBARN_ADMIN_URL;
const hasAdmin = () => Boolean(adminUrl() && process.env.BULBBARN_ADMIN_USER && process.env.BULBBARN_ADMIN_PASSWORD);

const adminLogin = page => admin.adminLogin(page, {
  url: adminUrl(), user: process.env.BULBBARN_ADMIN_USER, password: process.env.BULBBARN_ADMIN_PASSWORD,
});
const { adminMenu, gridRows } = admin;

// Order rows show the customer name, not the e-mail address that was searched for.
async function searchOrders(page, keyword) {
  await adminMenu(page, 'sales', 'Orders');
  await admin.searchGrid(page, keyword, keyword.includes('@') ? shop.testOrder.firstname : keyword);
}

// Opens the newest order placed by the Playwright test customer.
async function openLatestTestOrder(page) {
  await searchOrders(page, shop.testOrder.email);
  await gridRows(page).first().getByRole('link', { name: 'View' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/#\s*\d+/);
}

// Opens a grid row's edit form (e.g. a CMS page by title), e.g. openGridRow(page, 'content', 'Pages', title).
async function openGridRow(page, section, item, rowText) {
  await adminMenu(page, section, item);
  await admin.openGridRow(page, rowText);
}

// CMS page content lives in the Page Builder form field; read/write it through the admin uiRegistry.
async function openCmsPage(page, title) {
  await openGridRow(page, 'content', 'Pages', title);
  await page.locator('[data-index="content"]').getByText('Content', { exact: true }).first().click();
  await expect.poll(() => cmsContent(page).catch(() => ''), { message: 'Page Builder content should load', timeout: 30_000 })
    .toMatch(/data-content-type/);
}

const cmsContent = page => page.evaluate(() => new Promise(resolve => require(['uiRegistry'], registry =>
  resolve(String(registry.get(c => c.index === 'content' && typeof c.value === 'function').value())))));

const setCmsContent = (page, html) => page.evaluate(value => new Promise(resolve => require(['uiRegistry'], registry => {
  registry.get(c => c.index === 'content' && typeof c.value === 'function').value(value);
  resolve();
})), html);

// Saves the open admin form and waits for Magento's save request to finish (a redirect back to the form).
async function saveAdminForm(page) {
  const saved = page.waitForResponse(response => /\/save\//.test(response.url()) && response.request().method() === 'POST',
    { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await saved;
  expect(response.status(), 'Magento should accept the save').toBeLessThan(400);
  await page.waitForLoadState('load');
  await admin.expectNoAdminErrors(page);
}

// Page Builder regenerates its 7-character style ids on every load/save, and browser form
// submission turns line breaks into CRLF; neither changes the rendered page.
const normalizePageBuilder = html => html.replace(/\b[A-Z0-9]{7}\b/g, 'ID').replace(/\r\n/g, '\n');

/**
 * Temporarily changes a CMS page, runs `check`, then restores the original HTML and verifies it.
 * Used only by the opt-in CMS edit tests (npm run test:cms).
 */
async function withCmsPageChange(page, title, change, check) {
  await openCmsPage(page, title);
  const original = await cmsContent(page);
  const changed = change(original);
  expect(changed, 'The test change should alter the page content').not.toBe(original);
  try {
    await setCmsContent(page, changed);
    await saveAdminForm(page);
    await check();
  } finally {
    await openCmsPage(page, title);
    await setCmsContent(page, original);
    await saveAdminForm(page);
    await openCmsPage(page, title);
    expect(normalizePageBuilder(await cmsContent(page)), `${title} should be restored exactly`)
      .toBe(normalizePageBuilder(original));
  }
}

module.exports = {
  hasAdmin, adminLogin, adminMenu, gridRows, searchOrders, openLatestTestOrder,
  openGridRow, openCmsPage, cmsContent, setCmsContent, saveAdminForm, withCmsPageChange,
};
