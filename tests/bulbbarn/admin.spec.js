const { test, expect } = require('@playwright/test');
const { shop } = require('./shop');
const { adminGrid } = require('../common/magento-admin');
const { hasAdmin, adminLogin, adminMenu, gridRows, searchOrders, openLatestTestOrder } = require('./admin');

// Read-only Magento Admin checks on staging. Nothing is saved.
test.describe.configure({ timeout: 90_000 });
test.skip(!hasAdmin(), 'Needs BULBBARN_ADMIN_URL/USER/PASSWORD in .env.');

const exportStatuses = /\b(not exported|in progress|exported|synced|failed)\b/i;

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

test.describe('BBM2-113 PlatformSVS admin visibility', () => {
  test('[BBM2-113] Display PlatformSVS status in Sales Order grid', async ({ page }) => {
    await searchOrders(page, shop.testOrder.email);
    // Grid header cells are not exposed as column headers, so match the header text.
    await expect(adminGrid(page).getByText('PlatformSVS Export', { exact: true }).first()).toBeVisible();
    const rows = await gridRows(page).all();
    for (const row of rows.slice(0, 5)) {
      await expect(row, 'Each order should show a PlatformSVS export status').toContainText(exportStatuses);
    }
  });

  test('[BBM2-113] Display PlatformSVS export information on order view', async ({ page }) => {
    await openLatestTestOrder(page);
    const block = page.locator('section').filter({ hasText: 'PlatformSVS Fulfillment' }).last();
    await expect(block).toBeVisible();
    // A test order paid offline is not exported; the block must still explain its export state.
    await expect(block).toContainText(/queued|export|status/i);
  });
});

test.describe('BBM2-74 store views', () => {
  test('[BBM2-74] Verify EN, NL and DE store/language hierarchy', async ({ page }) => {
    await adminMenu(page, 'stores', 'All Stores');
    const grid = page.locator('#storeGrid_table');
    await expect(grid).toBeVisible();
    for (const view of [/Nederlands|Dutch|NL/i, /English|EN/i, /Deutsch|German|DE/i]) {
      await expect.soft(grid.getByRole('row').filter({ hasText: view }), `Store view ${view} should exist`).not.toHaveCount(0);
    }
  });
});
