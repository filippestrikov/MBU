const { test, expect } = require('@playwright/test');
const {
  expected, testData, productsInStore, attributes, fileName, normalize, expectedOptionIds, loginAsCustomer, adminProductRows,
} = require('./vdp');

// Read-only checks of the Magento result of a controlled Velder → Alumio → Magento run on ACC
// (Magento Product Integration Test Execution Guide, TC-003 and TC-005). Run them right after the run:
// SKU 100790 is a real product and the regular feed overwrites its test values.
test.skip(process.env.VDP_PHASE === 'cleanup', 'Cleanup phase runs only cleanup.spec.js.');

const skus = Object.keys(expected.skus);
const stores = Object.keys(expected.stores);
const nlStore = 'nl_sv10';
// Products that are not visible are reported by "Show each SKU in the store views of its price groups";
// the attribute checks below only look at the products that are there.
// Single-store checks require at least one visible product; store loops may meet a store with none.
function visible(found, { required = true } = {}) {
  const present = skus.filter(sku => found[sku]);
  if (required) expect(present, 'At least one test SKU should be visible, otherwise there is nothing to check').not.toHaveLength(0);
  return present;
}
const euro = amount => `€ ${amount.toFixed(2).replace('.', ',')}`;

// Declaration text: the feed marks allergens with **…**, Magento shows them in <b>…</b>.
const bold = text => text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

test.describe('TC-003 Scheduled product processing and store-view mapping', () => {
  test('[TC-003] Keep exactly one Magento product per SKU (create new, update existing)', async ({ page }) => {
    test.setTimeout(180_000);
    for (const sku of skus) {
      await expect.soft(await adminProductRows(page, sku), `${sku} (${expected.skus[sku].action}) should exist exactly once`).toHaveCount(1);
    }
  });

  test('[TC-003] Show each SKU in the store views of its price groups', async ({ request }) => {
    for (const store of stores) {
      const found = await productsInStore(request, store, skus);
      for (const sku of skus) expect.soft(found[sku], `${sku} should be enabled and visible in ${store}`).toBeDefined();
    }
  });

  test('[TC-003] Map the store-view prices from the price groups', async ({ request }) => {
    for (const store of stores) {
      const found = await productsInStore(request, store, skus);
      for (const sku of visible(found, { required: false })) {
        expect.soft(Number(attributes(found[sku]).general_price), `${sku} price in ${store}`).toBeCloseTo(expected.prices[sku][store], 4);
      }
    }
  });

  test('[TC-003] Map the representative attributes to their Magento option ids', async ({ request }) => {
    const found = await productsInStore(request, nlStore, skus);
    for (const [sku, checks] of Object.entries(expected.representativeOptions).filter(([sku]) => found[sku])) {
      for (const [code, ids] of Object.entries(checks)) {
        expect.soft([...attributes(found[sku])[code] ?? []].sort(), `${sku} ${code}`).toEqual([...ids].sort());
      }
    }
  });

  test('[TC-003] Map every list attribute with a mapping table to its option ids', async ({ request }) => {
    const found = await productsInStore(request, nlStore, skus);
    for (const sku of visible(found)) {
      const source = testData.nl[sku];
      for (const code of ['lov_typemelk', 'lov_product_landvanherkomst', 'lov_biologisch', 'lov_geschiktvoorvegtariers',
        'lov_hittebehandeling_melk', 'lov_rauwmelks', 'allergenen', 'lov_smaaktags', 'lov_puntschaal']) {
        if (!source[code]) continue;
        expect.soft([...attributes(found[sku])[code] ?? []].sort(), `${sku} ${code} = "${source[code]}"`)
          .toEqual(expectedOptionIds(code, source[code]).sort());
      }
    }
  });

  test('[TC-003][VDP-16] Show the NL texts in NL store views and the EN texts in EN store views', async ({ request }) => {
    for (const store of stores) {
      const { language } = expected.stores[store];
      const found = await productsInStore(request, store, skus);
      for (const sku of visible(found, { required: false })) {
        const source = testData[language][sku];
        const values = attributes(found[sku]);
        for (const [code, value] of [
          ['txt_commercielebenaming', source.commerciele_benaming],
          ['txt_warenwettelijkenaam', source.warenwettelijke_naam],
          ['txt_m3_naam', source.m3_description],
          ['short_description', source.product_beschrijving],
          ['description', source.product_beschrijving],
          ['form_declaratietekstfinal', bold(source.declaratie)],
        ]) {
          expect.soft(normalize(values[code]), `${sku} ${code} in ${store} (${language.toUpperCase()} file)`).toBe(normalize(value));
        }
      }
    }
  });

  test('[TC-003] Map article number, M3 status, nutrition values, weight unit and product sheet', async ({ request }) => {
    const found = await productsInStore(request, nlStore, skus);
    for (const sku of visible(found)) {
      const source = testData.nl[sku];
      const values = attributes(found[sku]);
      for (const [code, value] of [
        ['txt_artikelnummer', source.sku],
        ['txt_m3_status', source.m3status],
        ['general_ehd', source.Gewichtseenheid],
        ['product_sheet', source.productsheet_url],
        ['nmbr_gemenergiewaardekcal_per1', source.voedingswaarden_kcal],
        ['nmbr_gemenergiewaardekj_per100', source.voedingswaarden_kj],
        ['nmbr_vetteng_per100g', source.voedingswaarden_vetten],
        ['nmbr_verzadigdevetzureng_per10', source.voedingswaarden_vetzuren],
        ['nmbr_koolhydrateng_per100g', source.voedingswaarden_koolhydraten],
        ['nmbr_suikersg_per100g', source.voedingswaarden_suikers],
        ['nmbr_eiwitteng_per100g', source.voedingswaarden_eiwit],
        ['nmbr_totaalzoutg_per100g', source.voedingswaarden_zout],
      ]) {
        if (value === undefined) continue;
        expect.soft(values[code], `${sku} ${code}`).toBe(value);
      }
    }
  });

  test('[TC-003] Convert the net weight in KG to grams', async ({ request }) => {
    const found = await productsInStore(request, nlStore, skus);
    // Only products with the standard unit "KG"; SKU 100790 uses "kilo" (open question, see docs/velder-vdp-coverage.md).
    for (const sku of visible(found).filter(s => testData.nl[s].Gewichtseenheid === 'KG')) {
      const grams = Number(testData.nl[sku].Nettogewicht) * 1000;
      expect.soft(attributes(found[sku]).nmbruom_netto_gewicht_ce, `${sku} net weight text`).toBe(`${grams.toFixed(3)} g`);
      expect.soft(found[sku].weight, `${sku} weight (grams)`).toBe(grams);
    }
  });

  // Pending decisions (docs/velder-vdp-coverage.md, "Open questions"): enable each test once the expected behaviour is agreed.
  test.fixme('[TC-003] Use commerciele_benaming as product name, m3_description as fallback', async () => {
    // Mapping table: name = commerciele_benaming, fallback m3_description. ACC shows the M3 name in NL and the
    // commercial name in EN; the kick-off document calls the M3 description the product title.
  });

  test.fixme('[TC-003] Build the packing unit from aantal_per_eenheid and eenheid', async () => {
    // Mapping table: "aantal_per_eenheid + ' ' + eenheid"; ACC shows "STK 1" for 100790. Format of 1.000000000 to be agreed.
  });

  test.fixme('[TC-003] Hide a product in store views without a price group', async () => {
    // Kick-off document: a missing price group means "Not visible individually" for that store view. The current
    // test data has a price group for every store view, so this needs a test product without one.
  });
});

test.describe('TC-003 Store-view prices for price-list customers', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const store of stores) {
    const { customer, priceGroup } = expected.stores[store];
    test(`[TC-003] Show the PL${priceGroup} price to the PL${priceGroup} customer (${store})`, async ({ browser, request }, testInfo) => {
      const found = await productsInStore(request, store, skus);
      const shop = await loginAsCustomer(browser, testInfo.project.use, customer);
      try {
        for (const sku of skus) {
          if (!found[sku]) { expect.soft(found[sku], `${sku} should be visible in ${store}`).toBeDefined(); continue; }
          const response = await shop.goto(`/${found[sku].url_key}${found[sku].url_suffix ?? ''}`);
          expect.soft(response.ok(), `${sku} product page should open for ${customer}`).toBeTruthy();
          await expect.soft(shop.getByRole('main'), `${sku} price for ${customer}`).toContainText(euro(expected.prices[sku][store]));
        }
      } finally {
        await shop.context().close();
      }
    });
  }
});

test.describe('TC-005 Magento product image synchronization', () => {
  test('[TC-005] Create only the supported JPG images at their F positions', async ({ request }) => {
    const found = await productsInStore(request, nlStore, skus);
    for (const sku of visible(found)) {
      const gallery = found[sku].media_gallery.filter(image => !image.disabled)
        .map(image => ({ position: image.position, name: fileName(image.url) })).sort((a, b) => a.position - b.position);
      expect.soft(gallery, `${sku} gallery (no .tif, no duplicate-name suffix)`).toEqual(expected.images[sku]);
    }
  });

  test('[TC-005] Give the lowest supported image the image, small_image, thumbnail and swatch_image roles', async ({ request }) => {
    const found = await productsInStore(request, nlStore, skus);
    for (const sku of visible(found)) {
      const primary = expected.images[sku][0].name;
      const product = found[sku];
      for (const role of ['image', 'small_image', 'thumbnail']) {
        expect.soft(product[role] && fileName(product[role].url), `${sku} ${role}`).toBe(primary);
      }
      expect.soft(product.swatch_image && fileName(product.swatch_image), `${sku} swatch_image`).toBe(primary);
    }
  });
});
