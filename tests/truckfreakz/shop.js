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
const priceBox = page => page.locator('.product-info-main .price-box').first();

// "€12.00", "€ 14,52" and "14,52 €" -> 12 / 14.52. The last separator followed by two digits is the decimal one.
const parsePrice = text => Number(text.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));

// Displayed prices: Magento updates the rendered text, not data-price-amount, when a variant is chosen.
async function pdpPrices(page) {
  const box = priceBox(page);
  const amount = async locator => parsePrice(await locator.first().locator('.price').innerText());
  return {
    excl: await amount(box.locator('.normal-price .price-excluding-tax')),
    incl: await amount(box.locator('.price-incl-tax .price-including-tax')),
  };
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

// The Mirasvit layered navigation renders its filter options inside the left sidebar.
const filterBlock = page => page.locator('.sidebar-main .block.filter, .sidebar-main .filter-options, [data-mst-nav-filter]')
  .filter({ visible: true });

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
