const { test, expect } = require('@playwright/test');
const { expected, adminProductRows } = require('./vdp');

// Before a controlled run (TC-000) and after its cleanup (TC-008): the fictional SKUs must not exist and
// the existing SKU must. Run with `npm run test:vdp:cleanup`; read-only (Admin product grid search).
test.skip(process.env.VDP_PHASE !== 'cleanup', 'Runs only in the cleanup phase (npm run test:vdp:cleanup).');
test.describe.configure({ timeout: 180_000 });

const fictional = Object.keys(expected.skus).filter(sku => expected.skus[sku].fictional);
const existing = Object.keys(expected.skus).filter(sku => !expected.skus[sku].fictional);

test('[TC-000][TC-008] Fictional test SKUs do not exist in Magento', async ({ page }) => {
  for (const sku of fictional) {
    await expect.soft(await adminProductRows(page, sku), `${sku} should not exist (delete it before/after the run)`).toHaveCount(0);
  }
});

test('[TC-000][TC-008] The existing test SKU is present in Magento', async ({ page }) => {
  for (const sku of existing) {
    await expect.soft(await adminProductRows(page, sku), `${sku} should exist exactly once`).toHaveCount(1);
  }
});
