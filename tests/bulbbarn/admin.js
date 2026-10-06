const { expect } = require('@playwright/test');
const shop = require('./fixtures/shop.json');

const adminUrl = () => process.env.BULBBARN_ADMIN_URL;
const hasAdmin = () => Boolean(adminUrl() && process.env.BULBBARN_ADMIN_USER && process.env.BULBBARN_ADMIN_PASSWORD);

async function adminLogin(page) {
  await page.goto(adminUrl());
  const username = page.getByRole('textbox', { name: 'Username *' });
  if (await username.isVisible()) {
    await username.fill(process.env.BULBBARN_ADMIN_USER);
    await page.getByRole('textbox', { name: 'Password *' }).fill(process.env.BULBBARN_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page.getByRole('link', { name: /Dashboard/ }).first()).toBeVisible();
}

// Admin URLs carry secret keys, so take the keyed URL from the (hidden) menu link, e.g. Sales > Orders.
async function adminMenu(page, section, item) {
  const link = page.locator('#nav > li').filter({ hasText: section }).first()
    .getByRole('link', { name: item, exact: true, includeHidden: true }).first();
  await page.goto(await link.getAttribute('href'));
}

// The grid also renders hidden copies of its wrapper for the sticky header.
const orderGrid = page => page.locator('.admin__data-grid-wrap').filter({ visible: true }).first();

async function searchOrders(page, keyword) {
  await adminMenu(page, /Sales/, 'Orders');
  await expect(orderGrid(page).locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  // The grid also renders a hidden copy of the search box in its sticky header.
  const search = page.getByRole('textbox', { name: 'Search by keyword' }).filter({ visible: true }).first();
  await search.fill(keyword);
  await search.press('Enter');
  await expect(orderGrid(page).locator('tbody tr').first()).toContainText(keyword.includes('@') ? shop.testOrder.firstname : keyword);
}

// Opens the newest order placed by the Playwright test customer.
async function openLatestTestOrder(page) {
  await searchOrders(page, shop.testOrder.email);
  await orderGrid(page).locator('tbody tr').first().getByRole('link', { name: 'View' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/#\s*\d+/);
}

// Opens a grid row's edit form (e.g. a CMS page by title) through its keyed Edit link.
async function openGridRow(page, section, item, rowText) {
  await adminMenu(page, section, item);
  const row = orderGrid(page).locator('tbody tr.data-row').filter({ hasText: rowText }).first();
  await expect(row).toBeAttached({ timeout: 60_000 });
  await page.goto(await row.getByRole('link', { name: 'Edit', includeHidden: true }).getAttribute('href'));
}

// CMS page content lives in the Page Builder form field; read/write it through the admin uiRegistry.
async function openCmsPage(page, title) {
  await openGridRow(page, /^\s*Content/, 'Pages', title);
  await page.locator('[data-index="content"] .fieldset-wrapper-title, .fieldset-wrapper-title:has-text("Content")').first().click();
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
  await expect(page.locator('.message-error, .messages .error')).toHaveCount(0);
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
  hasAdmin, adminLogin, adminMenu, orderGrid, searchOrders, openLatestTestOrder,
  openGridRow, openCmsPage, cmsContent, setCmsContent, saveAdminForm, withCmsPageChange,
};
