const { expect } = require('@playwright/test');

// Magento Admin helpers shared by all clients. Locators work for English and Dutch admin users.

// Top-level menu sections by their data-ui-id, which does not change with the admin language.
const sections = {
  sales: 'menu-magento-sales-sales',
  catalog: 'menu-magento-catalog-catalog',
  customers: 'menu-magento-customer-customer',
  content: 'menu-magento-backend-content',
  stores: 'menu-magento-backend-stores',
};

// Some extensions render a hidden copy of the menu, so take the first menubar.
const adminMenuBar = page => page.getByRole('menubar').first();

async function adminLogin(page, { url, user, password }) {
  await page.goto(url);
  const username = page.getByRole('textbox', { name: /username|gebruikersnaam/i });
  if (await username.isVisible()) {
    await username.fill(user);
    await page.getByRole('textbox', { name: /password|wachtwoord/i }).fill(password);
    await page.getByRole('button', { name: /sign in|inloggen|aanmelden/i }).click();
  }
  await expect(adminMenuBar(page), 'The admin menu should show after login').toBeVisible({ timeout: 60_000 });
}

// Admin URLs carry secret keys, so take the keyed URL from the (hidden) submenu link, e.g. sales > Orders.
async function adminMenu(page, section, item) {
  const link = adminMenuBar(page).locator(`[data-ui-id="${sections[section]}"]`)
    .getByRole('link', { name: item, exact: true, includeHidden: true }).first();
  const response = await page.goto(await link.getAttribute('href'));
  expect(response.status(), `${item} should open`).toBeLessThan(400);
}

// UI-component grids (products, orders, customers, CMS pages). Data rows carry an Edit or View link
// (some grids label it "Edit <product name>").
const adminGrid = page => page.locator('[data-role="grid"]');
const gridRows = page => adminGrid(page).getByRole('row')
  .filter({ has: page.getByRole('link', { name: /^(Edit|View|Bewerken|Bekijken)\b/, includeHidden: true }) });

const gridSearchBox = page => page.getByRole('textbox', { name: /Search by keyword|Zoeken op trefwoord/i }).filter({ visible: true }).first();

// Grid filters are saved per admin user and would silently hide rows from a keyword search.
async function clearGridFilters(page) {
  await expect(gridSearchBox(page), 'The grid should load').toBeVisible({ timeout: 60_000 });
  const clear = page.getByRole('button', { name: /^(Clear all|Alles wissen)$/ }).filter({ visible: true });
  if (await clear.count()) {
    await clear.first().click();
    await expect(clear, 'Saved grid filters should be cleared').toHaveCount(0);
  }
}

// `expected` is text the matching rows show (an order row shows the customer name, not the e-mail).
async function searchGrid(page, keyword, expected = keyword) {
  await clearGridFilters(page);
  // The sticky grid header renders a hidden copy of the search box.
  const search = gridSearchBox(page);
  await search.fill(keyword);
  await search.press('Enter');
  await expect(gridRows(page).filter({ hasText: expected }).first(), `The grid should find ${keyword}`).toBeVisible({ timeout: 60_000 });
}

// Opens a grid row's edit form through its keyed Edit link.
async function openGridRow(page, rowText) {
  const row = gridRows(page).filter({ hasText: rowText }).first();
  await expect(row, `The grid should list ${rowText}`).toBeAttached({ timeout: 60_000 });
  await page.goto(await row.getByRole('link', { name: /^(Edit|Bewerken)\b/, includeHidden: true }).getAttribute('href'));
}

const expectNoAdminErrors = page => expect(page.locator('[data-ui-id="messages-message-error"]'), 'Magento should show no error').toHaveCount(0);

module.exports = {
  adminLogin, adminMenu, adminMenuBar, adminGrid, gridRows, gridSearchBox, clearGridFilters, searchGrid, openGridRow, expectNoAdminErrors,
};
