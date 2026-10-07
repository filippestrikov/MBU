const { expect } = require('@playwright/test');
const site = require('./fixtures/site.json');

// TruckFreakz runs one Magento store view per host: tst-truckfreakz-com (EN), -be (NL), -de, -fr.
function storeBase(code) {
  const base = new URL(process.env.TRUCKFREAKZ_BASE_URL);
  base.hostname = base.hostname.replace(/-com\./, `-${site.stores[code].host}.`);
  if (!/\.mbu\.dev$/.test(base.hostname)) throw new Error(`${base.hostname} is not a TST host; refusing to test a live site.`);
  return base.origin;
}

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), `${response.url()} should load successfully`).toBeTruthy();
}

const main = page => page.getByRole('main');
// The product's own price box comes before the price boxes of related products.
const priceBox = page => main(page).locator('[data-role="priceBox"]').first();

// "€12.00", "€ 14,52" and "14,52 €" -> 12 / 14.52. The last separator followed by two digits is the decimal one.
const parsePrice = text => Number(text.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));

// The price box reads "As low as €12.00 (incl. VAT €14.52)": the main price is excl. VAT, the note incl. VAT.
// Displayed prices: Magento updates the rendered text, not data-price-amount, when a variant is chosen.
async function pdpPrices(page) {
  const amounts = (await priceBox(page).innerText()).match(/€\s?\d[\d.,]*|\d[\d.,]*\s?€/g) ?? [];
  expect(amounts.length, 'The price box should show an excl. and an incl. VAT price').toBeGreaterThanOrEqual(2);
  return { excl: parsePrice(amounts[0]), incl: parsePrice(amounts.at(-1)) };
}

const withVat = excl => Math.round(excl * (1 + site.vatRate) * 100) / 100;

// Measures what a visitor can actually scroll sideways (overflow hidden on html/body is fine).
async function expectNoHorizontalScroll(page) {
  const scrolled = await page.evaluate(() => {
    window.scrollTo(10_000, window.scrollY);
    const x = window.scrollX;
    window.scrollTo(0, window.scrollY);
    return x;
  });
  expect(scrolled, 'The page should not scroll horizontally (px)').toBeLessThanOrEqual(1);
}

// Magento's layered navigation block; its filter groups are accordion tabs (role tab / tabpanel).
const filterBlock = page => page.locator('#layered-filter-block').filter({ visible: true });

const hasFilters = async page => (await filterBlock(page).count()) > 0;

const redesignMarker = page => page.getByRole('main').getByText(site.redesign.communityTitle);

// Below desktop width the header shows search, cart and a hamburger (last header icon).
async function openMobileMenu(page) {
  await page.getByRole('banner').getByRole('listitem').last().getByRole('link').click();
  await expect(page.getByText('Menu', { exact: true }).filter({ visible: true }).first()).toBeVisible();
}

module.exports = {
  site, storeBase, expectLoaded, main, priceBox, pdpPrices, withVat, expectNoHorizontalScroll,
  filterBlock, hasFilters, redesignMarker, openMobileMenu,
};
