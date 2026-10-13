const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const admin = require('../common/magento-admin');
const expected = require('./fixtures/expected.json');
const { options: optionIds } = require('./fixtures/option-ids.json');

// --- Source data: the XML files sent to the Alumio webhooks (replace them for a new run) ---

const decode = text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

// { sku: { field: value, prices: { '10': 23.4, ... }, images: [{ type: 'F2', url }] } } for one Velder XML file.
function parseFeed(xml) {
  const products = {};
  for (const [block] of xml.matchAll(/<product_detail>[\s\S]*?<\/product_detail>/g)) {
    const product = { prices: {}, images: [] };
    for (const [, tag, value] of block.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) product[tag] = decode(value.trim());
    for (const [, id, price] of block.matchAll(/<price_group id="([^"]+)" prijs="([^"]+)"/g)) product.prices[id] = Number(price);
    for (const [, type, url] of block.matchAll(/<image type="([^"]+)">([^<]+)<\/image>/g)) product.images.push({ type, url: decode(url) });
    products[product.sku] = product;
  }
  return products;
}
const readTestData = language => parseFeed(fs.readFileSync(path.join(__dirname, 'fixtures', `${language}TestData.xml`), 'utf8'));
const testData = { nl: readTestData('nl'), en: readTestData('en') };

// --- Magento: storefront GraphQL per store view (REST is blocked by the HTTP auth on ACC) ---

const productQuery = `query ($skus: [String]) { products(filter: { sku: { in: $skus } }) { total_count items {
  sku name url_key url_suffix
  image { url } small_image { url } thumbnail { url } swatch_image
  media_gallery { url position disabled }
  custom_attributesV2 { items { code
    ... on AttributeValue { value }
    ... on AttributeSelectedOptions { selected_options { label value } } } }
  ... on SimpleProduct { weight } } } }`;

// Returns { sku: product } for the products that are enabled and visible in `store`.
async function productsInStore(request, store, skus) {
  const response = await request.post('/graphql', { headers: { Store: store }, data: { query: productQuery, variables: { skus } } });
  expect(response.ok(), `GraphQL should answer for ${store}`).toBeTruthy();
  const body = await response.json();
  expect(body.errors, `GraphQL errors for ${store}`).toBeUndefined();
  return Object.fromEntries(body.data.products.items.map(item => [item.sku, item]));
}

// Attribute code -> text value, or the list of selected option ids for select/multiselect attributes.
const attributes = product => Object.fromEntries(product.custom_attributesV2.items.map(a =>
  [a.code, a.selected_options ? a.selected_options.map(o => o.value) : a.value]));

const fileName = url => url.split('/').pop();
const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

// Option ids for a comma-separated XML value, matched case-insensitively (the feed is not consistent in case).
function expectedOptionIds(attribute, xmlValue) {
  const table = Object.fromEntries(Object.entries(optionIds[attribute] ?? {}).map(([label, id]) => [label.toLowerCase(), id]));
  return xmlValue.split(',').map(label => table[label.trim().toLowerCase()] ?? `unmapped "${label.trim()}"`);
}

// --- Customers: the price-list test accounts have no password, so open them via Admin > Login as Customer ---

const adminCredentials = () => ({
  url: process.env.VELDER_ACC_ADMIN_URL, user: process.env.VELDER_ACC_ADMIN_USER, password: process.env.VELDER_ACC_ADMIN_PASSWORD,
});

// Returns a storefront page logged in as `email` (requires "Allow remote shopping assistance" on the account).
async function loginAsCustomer(browser, use, email) {
  const context = await browser.newContext({ ...use, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await admin.adminLogin(page, adminCredentials());
  await admin.adminMenu(page, 'customers', /^(All Customers|Alle klanten)$/);
  await admin.searchGrid(page, email);
  await admin.openGridRow(page, email);
  await page.getByRole('button', { name: 'Login as Customer' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'You are about to Login as Customer' });
  await expect(confirm, 'Login as Customer should be allowed for the account').toBeVisible();
  const [shop] = await Promise.all([context.waitForEvent('page'), confirm.getByRole('button', { name: 'Login as Customer' }).click()]);
  await expect(shop.getByText(/You are logged in as customer|Je bent ingelogd als klant|U bent ingelogd als klant/i).first()).toBeVisible({ timeout: 30_000 });
  return shop;
}

// --- Admin: product existence regardless of status/visibility (GraphQL only shows enabled, visible products) ---

async function adminProductRows(page, sku) {
  await admin.adminLogin(page, adminCredentials());
  await admin.adminMenu(page, 'catalog', 'Products');
  await admin.clearGridFilters(page);
  // The SKU column filter, not the keyword search: the full-text keyword index on ACC misses existing SKUs.
  await page.getByRole('button', { name: 'Filters' }).filter({ visible: true }).first().click();
  await page.locator('input[name="sku"]').filter({ visible: true }).fill(sku);
  await page.getByRole('button', { name: /Apply Filters|Filters toepassen/ }).click();
  // Saved filters were cleared, so the only active filter is this SKU and "0 records" means the SKU does not exist.
  await expect(page.getByText(/^Active filters:/).first(), 'The SKU filter should be applied').toBeVisible({ timeout: 30_000 });
  // The SKU filter matches substrings, so keep only rows with a cell that is exactly the SKU.
  const rows = admin.gridRows(page).filter({ has: page.getByText(sku, { exact: true }) });
  // The grid shows either matching rows or "We couldn't find any records".
  await expect(rows.first().or(page.getByText(/couldn't find any records|geen records/i).first())).toBeVisible({ timeout: 60_000 });
  return rows;
}

module.exports = {
  expected, testData, parseFeed, productsInStore, attributes, fileName, normalize, expectedOptionIds, loginAsCustomer, adminProductRows,
};
