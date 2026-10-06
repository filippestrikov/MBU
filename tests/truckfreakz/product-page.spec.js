const { test, expect } = require('@playwright/test');
const { site, storeBase, expectLoaded, main, priceBox, pdpPrices, withVat, expectNoHorizontalScroll } = require('./shop');

const { configurable, simple } = site;
const variant = page => page.locator('.swatch-attribute[data-attribute-code="color"]');
const swatch = (page, label) => variant(page).locator(`.swatch-option[data-option-label="${label}"]`);
const activeImage = page => page.locator('.fotorama__stage__frame.fotorama__active img').first();
const suitableFor = page => main(page).locator('.suitable-manufacturer');

test.describe('TD-15 New Product Page – product label', () => {
  test('[TD-15] Show product label only when a label is configured', async ({ page }) => {
    await expectLoaded(await page.goto(site.stores.en.configurable));
    await expect(main(page).locator('.product-label')).toHaveText(configurable.label);

    await expectLoaded(await page.goto(simple.path));
    await expect(main(page).getByText(simple.sku)).toBeVisible();
    await expect(main(page).locator('.product-label'), 'A product without a label should show no badge').toHaveCount(0);
  });
});

test.describe('TD-15 New Product Page – Suitable for', () => {
  test('[TD-15] Display selected brands in Geschikt voor section', async ({ page }) => {
    await expectLoaded(await page.goto(site.stores.en.configurable));
    await expect(suitableFor(page)).toContainText(site.stores.en.suitableFor);
    await expect(suitableFor(page).getByRole('link')).toHaveText(configurable.suitableFor);
  });

  test('[TD-15] Hide Geschikt voor section when no brand is selected', async ({ page }) => {
    await expectLoaded(await page.goto(simple.path));
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
    await expect(suitableFor(page)).toHaveCount(0);
    await expect(main(page).getByText(site.stores.en.suitableFor)).toHaveCount(0);
  });

  for (const [code, store] of Object.entries(site.stores)) {
    test(`[TD-15] Open correct brand category from Geschikt voor links (${code})`, async ({ page }) => {
      const base = storeBase(code);
      await expectLoaded(await page.goto(base + store.configurable));
      await expect(suitableFor(page)).toContainText(store.suitableFor);
      const links = suitableFor(page).getByRole('link');
      await expect(links).toHaveText(configurable.suitableFor);
      for (const brand of configurable.suitableFor) {
        const href = await links.filter({ hasText: brand }).getAttribute('href');
        expect(href, `${brand} should link to the ${code} store-view brand category`)
          .toBe(`${base}/${store.brandPath}/${brand.toLowerCase()}.html`);
      }
      for (const brand of configurable.suitableFor) {
        await page.goto(base + store.configurable);
        await suitableFor(page).getByRole('link', { name: brand, exact: true }).click();
        await expect(page).toHaveURL(`${base}/${store.brandPath}/${brand.toLowerCase()}.html`);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(brand);
      }
    });
  }
});

test.describe('TD-15 New Product Page – tax pricing', () => {
  test('[TD-15] Display excluding and including VAT prices for simple products', async ({ page }) => {
    await expectLoaded(await page.goto(simple.path));
    const { excl, incl } = await pdpPrices(page);
    expect(excl).toBeGreaterThan(0);
    expect(incl, 'Incl. VAT should be the excl. price plus 21% VAT').toBeCloseTo(withVat(excl), 2);
    // The excl. VAT price is the main price; the incl. amount is the note in brackets.
    await expect(priceBox(page).locator('.normal-price .price-excluding-tax')).toBeVisible();
    await expect(priceBox(page).locator('.price-incl-tax')).toContainText(site.stores.en.inclVat);
  });

  test('[TD-15] Display correct VAT information for configurable products', async ({ page }) => {
    await expectLoaded(await page.goto(site.stores.en.configurable));
    await expect(swatch(page, configurable.variants[0].label)).toHaveAttribute('aria-checked', 'true');
    const { excl, incl } = await pdpPrices(page);
    expect(excl).toBe(configurable.variants[0].excl);
    expect(incl).toBeCloseTo(withVat(excl), 2);
    await expect(priceBox(page).locator('.price-incl-tax')).toContainText(site.stores.en.inclVat);
  });

  test('[TD-15] Display VAT note on every store view', async ({ page }) => {
    for (const [code, store] of Object.entries(site.stores)) {
      await expectLoaded(await page.goto(storeBase(code) + store.configurable));
      await expect.soft(priceBox(page).locator('.price-incl-tax'), `${code}: incl. VAT note`).toContainText(store.inclVat);
    }
  });
});

test.describe('TD-15 New Product Page – configurable product', () => {
  test.beforeEach(async ({ page }) => {
    await expectLoaded(await page.goto(site.stores.en.configurable));
    await expect(variant(page).locator('.swatch-option').first()).toBeVisible();
  });

  test('[TD-15] Render visual swatches and preselect first available variant when configured', async ({ page }) => {
    const options = variant(page).locator('.swatch-option');
    await expect(options).toHaveCount(configurable.variants.length);
    for (const { label } of configurable.variants) {
      await expect(swatch(page, label), `${label} should be an image swatch`).toHaveClass(/\bimage\b/);
    }
    await expect(options.first()).toHaveAttribute('aria-checked', 'true');
    await expect(variant(page).locator('.swatch-attribute-selected-option')).toHaveText(configurable.variants[0].label);
  });

  test('[TD-15] Update configurable price and VAT note when variant changes', async ({ page }) => {
    for (const { label, excl } of [...configurable.variants.slice(1), configurable.variants[0]]) {
      await swatch(page, label).click();
      await expect(swatch(page, label)).toHaveAttribute('aria-checked', 'true');
      await expect.poll(async () => (await pdpPrices(page)).excl, { message: `${label}: excl. price` }).toBe(excl);
      expect((await pdpPrices(page)).incl, `${label}: incl. VAT amount`).toBeCloseTo(withVat(excl), 2);
      await expect(priceBox(page).locator('.price-incl-tax')).toContainText(withVat(excl).toFixed(2));
    }
  });

  test('[TD-15] Update gallery image when configurable variant changes', async ({ page }) => {
    for (const { label, image } of [...configurable.variants.slice(1), configurable.variants[0]]) {
      await swatch(page, label).click();
      await expect(activeImage(page), `${label}: gallery should show the variant image`).toHaveAttribute('src', new RegExp(image));
    }
    await expect(page.locator('.gallery-placeholder__image').filter({ visible: true }), 'No placeholder should block the gallery').toHaveCount(0);
  });
});

test.describe('TD-15 New Product Page – specifications', () => {
  for (const [code, store] of Object.entries(site.stores)) {
    test(`[TD-15] Display specification attributes on PDP when values are filled (${code})`, async ({ page }) => {
      await expectLoaded(await page.goto(storeBase(code) + store.configurable));
      const table = main(page).locator('table.additional-attributes');
      await expect(table).toBeVisible();
      await expect(table.locator('th')).toHaveText(store.specLabels);
      for (const cell of await table.locator('td').all()) await expect(cell).not.toBeEmpty();
    });
  }
});

test.describe('TD-15 New Product Page – regression', () => {
  for (const name of ['desktop1366', 'desktop1440', 'desktop1920']) {
    test(`[TD-15] Keep PDP layout and functionality stable after backend changes (${name})`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(site.viewports[name]);
      for (const path of [simple.path, site.stores.en.configurable]) {
        await expectLoaded(await page.goto(path));
        await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
        await expect(main(page).getByRole('button', { name: /Add to cart/i })).toBeVisible();
        await expect(main(page).getByRole('spinbutton', { name: 'Qty' })).toBeVisible();
        await expect(activeImage(page)).toBeVisible();
        await expectNoHorizontalScroll(page);
      }
      await swatch(page, configurable.variants[1].label).click();
      await expect(swatch(page, configurable.variants[1].label)).toHaveAttribute('aria-checked', 'true');
      expect(errors, 'No JavaScript errors on the PDP').toEqual([]);
    });
  }
});
