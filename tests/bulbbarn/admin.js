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

module.exports = { hasAdmin, adminLogin, adminMenu, orderGrid, searchOrders, openLatestTestOrder };
