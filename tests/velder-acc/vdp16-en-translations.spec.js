const fs = require('fs');
const { test, expect } = require('@playwright/test');
const admin = require('../common/magento-admin');
const { expected, parseFeed, productsInStore, attributes, normalize } = require('./vdp');
const input = require('./fixtures/vdp16-alumio-input-116938.json');
const [{ product: sent }] = require('./fixtures/vdp16-magento-request-116938.json');

// VDP-16: Alumio maps the new *_EN fields of the Velder XML to the EN store views (PL28, PL40) as
// store-view values of the same attributes as their Dutch counterparts. Read-only checks on ACC.
// Sample: SKU 116938 as Alumio received it and sent it to Magento (Maksym, VDP-16 comment 2026-10-08).
// Feed-wide: VDP_FEED=<path to WebShop_Artikelen_*.xml> also checks every product of that feed.
test.skip(process.env.VDP_PHASE === 'cleanup', 'Cleanup phase runs only cleanup.spec.js.');

const bold = text => text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
// Magento attribute → XML field (the EN field is `${field}_EN`).
const textAttributes = [
  ['name', 'commerciele_benaming'],
  ['txt_commercielebenaming', 'commerciele_benaming'],
  ['txt_warenwettelijkenaam', 'warenwettelijke_naam'],
  ['short_description', 'product_beschrijving'],
  ['description', 'product_beschrijving'],
  ['form_declaratietekstfinal', 'declaratie', bold],
];
const textOf = (product, code) => normalize(code === 'name' ? product.name : attributes(product)[code]);
const storesFor = (product, language) => Object.entries(expected.stores)
  .filter(([, store]) => store.language === language && store.priceGroup in product.prices).map(([code]) => code);

const sample = { ...input, prices: Object.fromEntries(input.pricing.price_group.map(group => [group['@id'], Number(group['@prijs'])])) };

async function expectTexts(request, product, language) {
  const stores = storesFor(product, language);
  expect(stores, `${product.sku} should have a ${language.toUpperCase()} price group`).not.toHaveLength(0);
  for (const store of stores) {
    const found = await productsInStore(request, store, [product.sku]);
    expect(found[product.sku], `${product.sku} should be visible in ${store}`).toBeTruthy();
    for (const [code, field, format = text => text] of textAttributes) {
      const value = language === 'en' ? product[`${field}_EN`] : product[field];
      expect.soft(textOf(found[product.sku], code), `${product.sku} ${code} in ${store}`).toBe(normalize(format(value)));
    }
  }
}

test.describe('VDP-16 EN translation fields', () => {
  test('[VDP-16] Show the EN commercial name, legal name, description and declaration in the EN store views of PL28 and PL40', async ({ request }) => {
    await expectTexts(request, sample, 'en');
  });

  test('[VDP-16] Keep the Dutch values on the NL store views', async ({ request }) => {
    await expectTexts(request, sample, 'nl');
  });

  test('[VDP-16] Keep the Dutch values on the default scope', async ({ page }) => {
    test.setTimeout(180_000);
    await admin.adminLogin(page, {
      url: process.env.VELDER_ACC_ADMIN_URL, user: process.env.VELDER_ACC_ADMIN_USER, password: process.env.VELDER_ACC_ADMIN_PASSWORD,
    });
    await admin.adminMenu(page, 'catalog', 'Products');
    await admin.clearGridFilters(page);
    await admin.searchGrid(page, sample.sku);
    await admin.openGridRow(page, sample.sku);
    // The edit page opens on the default scope ("All Store Views") and its heading is the product name there.
    await expect.soft(page.getByRole('heading', { level: 1 }), 'name on the default scope').toHaveText(sample.commerciele_benaming, { timeout: 60_000 });
    // The text attributes render only once their collapsed section is opened.
    await page.getByRole('main').getByText('Contentserv data', { exact: true }).click();
    await expect(page.locator('[name="product[txt_artikelnummer]"]'), 'The Contentserv data section should open').toHaveValue(sample.sku);
    for (const [code, field, format = text => text] of textAttributes.filter(([code]) => code.startsWith('txt_') || code.startsWith('form_'))) {
      await expect.soft(page.locator(`[name="product[${code}]"]`), `${code} on the default scope`).toHaveValue(format(sample[field]));
    }
  });

  test('[VDP-16] Store the values Alumio sent to Magento for the EN store view', async ({ request }) => {
    const store = storesFor(sample, 'en')[0];
    const found = await productsInStore(request, store, [sent.sku]);
    expect(found[sent.sku], `${sent.sku} should be visible in ${store}`).toBeTruthy();
    const stored = attributes(found[sent.sku]);
    // Lists (multiselects, customer groups) are compared as sets: Magento keeps its own order.
    const asSet = value => (Array.isArray(value) ? value : String(value).split(/\s*[|,]\s*/)).map(v => normalize(v).toLowerCase()).sort().join(',');
    const sentValues = sent.custom_attributes.filter(({ attribute_code: code }) => code in stored);
    for (const code of ['txt_commercielebenaming', 'txt_warenwettelijkenaam', 'short_description', 'description', 'form_declaratietekstfinal']) {
      expect(sentValues.map(a => a.attribute_code), `GraphQL should expose ${code}`).toContain(code);
    }
    expect.soft(normalize(found[sent.sku].name), `name in ${store}`).toBe(normalize(sent.name));
    for (const { attribute_code: code, value } of sentValues) {
      expect.soft(asSet(stored[code]), `${code} in ${store}`).toBe(asSet(value));
    }
  });

  test.describe('Feed-wide (VDP_FEED)', () => {
    test.skip(!process.env.VDP_FEED, 'Set VDP_FEED to the Velder XML that was imported.');
    test.describe.configure({ timeout: 600_000 });
    const feed = process.env.VDP_FEED ? parseFeed(fs.readFileSync(process.env.VDP_FEED, 'utf8')) : {};

    // Only store views this import updated are checked: ACC also holds older runs and the daily feed, and the
    // store-view price equal to the feed price is the proof of the update. The rest is listed as an annotation
    // (TC-003 covers prices and visibility).
    async function updatedInStores(request, language) {
      const result = [];
      const notUpdated = [];
      for (const store of Object.keys(expected.stores).filter(code => expected.stores[code].language === language)) {
        const { priceGroup } = expected.stores[store];
        const skus = Object.values(feed).filter(product => storesFor(product, language).includes(store)).map(product => product.sku);
        for (let i = 0; i < skus.length; i += 20) {
          for (const product of Object.values(await productsInStore(request, store, skus.slice(i, i + 20)))) {
            const source = feed[product.sku];
            const updated = Math.abs(Number(attributes(product).general_price) - source.prices[priceGroup]) < 1e-6;
            if (updated) result.push({ store, source, product });
            else notUpdated.push(`${product.sku}@${store}`);
          }
        }
      }
      if (notUpdated.length) {
        test.info().annotations.push({ type: 'not updated by this feed (skipped)', description: `${notUpdated.length}: ${notUpdated.join(', ')}` });
      }
      expect(result, `Some feed products should be updated in the ${language.toUpperCase()} store views`).not.toHaveLength(0);
      return result;
    }

    test('[VDP-16] Show the EN texts of every feed product in its EN store views', async ({ request }) => {
      for (const { store, source, product } of await updatedInStores(request, 'en')) {
        for (const [code, field, format = text => text] of textAttributes) {
          if (!source[`${field}_EN`]) continue;
          expect.soft(textOf(product, code), `${source.sku} ${code} in ${store}`).toBe(normalize(format(source[`${field}_EN`])));
        }
      }
    });

    test('[VDP-16] Keep the Dutch texts of every feed product in its NL store views', async ({ request }) => {
      for (const { store, source, product } of await updatedInStores(request, 'nl')) {
        for (const [code, field, format = text => text] of textAttributes) {
          // An empty field must not overwrite the existing value, so there is nothing to compare. The NL `name`
          // (commercial or M3 name) predates VDP-16: open question 1 in docs/velder-vdp-coverage.md.
          if (!source[field] || code === 'name') continue;
          expect.soft(textOf(product, code), `${source.sku} ${code} in ${store}`).toBe(normalize(format(source[field])));
        }
      }
    });

    // Criterion "to be confirmed with Danny": an empty EN field keeps the existing value instead of blanking it.
    test('[VDP-16] Do not overwrite existing values with an empty EN field', async ({ request }) => {
      for (const { store, source, product } of await updatedInStores(request, 'en')) {
        for (const [code, field] of textAttributes) {
          if (source[`${field}_EN`] || !source[field]) continue;
          expect.soft(textOf(product, code), `${source.sku} ${code} in ${store} (EN empty, NL filled)`).not.toBe('');
        }
      }
    });
  });
});
