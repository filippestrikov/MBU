const { test, expect } = require('@playwright/test');
const { site, expectLoaded, main, pdpPrices, expectNoHorizontalScroll, redesignMarker, openMobileMenu } = require('./shop');

const languageButton = page => page.getByRole('banner').getByRole('button', { name: new RegExp(site.stores.en.language) });
const searchBox = page => page.getByRole('banner').getByRole('combobox', { name: /Search/ });
// The TD-24 community section, found by its agreed title (the new design is not on TST yet).
const communityBlock = page => main(page).locator('section').filter({ has: redesignMarker(page) }).last();

test.beforeEach(async ({ page }) => {
  await expectLoaded(await page.goto('/'));
});

test.describe('TD-24 Homepage – header', () => {
  test('[TD-24] Display language dropdown on homepage', async ({ page }) => {
    await languageButton(page).click();
    await expect(languageButton(page)).toHaveAttribute('aria-expanded', 'true');
    for (const [code, store] of Object.entries(site.stores).filter(([code]) => code !== 'en')) {
      const link = page.getByRole('banner').getByRole('link', { name: store.language, exact: true });
      await expect(link).toBeVisible();
      await expect(link, `${store.language} should switch to the ${code} store`).toHaveAttribute('href', new RegExp(`___store/${code}/`));
    }
  });

  test('[TD-24] Display redesigned search dropdown using live behavior', async ({ page }) => {
    await searchBox(page).fill(site.searchTerm);
    const results = page.getByRole('banner').getByRole('link', { name: new RegExp(site.searchTerm, 'i') });
    await expect(results.first()).toBeVisible({ timeout: 15_000 });
    const viewAll = page.getByRole('link', { name: /View all \d+ results/ });
    await expect(viewAll).toBeVisible();
    await viewAll.click();
    await expect(page).toHaveURL(new RegExp(`q=${site.searchTerm}`));
    await expect(main(page).getByRole('heading', { level: 1 })).toContainText(site.searchTerm);
  });
});

test.describe('TD-24 Homepage – newsletter and footer', () => {
  test('[TD-24] Display newsletter signup section', async ({ page }) => {
    const form = page.locator('form[action*="newsletter/subscriber/new"]').filter({ visible: true }).first();
    await expect(form).toBeVisible();
    const email = form.getByRole('textbox');
    await email.fill('playwright@example.com');
    await expect(email).toHaveValue('playwright@example.com');
    await expect(form.getByRole('button')).toBeEnabled();
    // Not submitted: a real subscription would reach the newsletter list.
  });

  test('[TD-24] Display incl/excl VAT pricing treatment in product-page design', async ({ page }) => {
    await expectLoaded(await page.goto(site.simple.path));
    const { excl, incl } = await pdpPrices(page);
    expect(incl).toBeGreaterThan(excl);
  });

  for (const name of ['desktop1440', 'tablet', 'mobile']) {
    test(`[TD-24] Render redesigned homepage responsively (${name})`, async ({ page }) => {
      await page.setViewportSize(site.viewports[name]);
      await expectLoaded(await page.goto('/'));
      await expectNoHorizontalScroll(page);
      await expect(page.getByRole('banner').getByRole('link', { name: 'store logo' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Cart' }).first()).toBeAttached();
      await expect(main(page).getByRole('heading').first()).toBeVisible();
      await expect(page.getByRole('contentinfo').first()).toBeAttached();
    });
  }

  for (const name of ['tablet', 'mobile']) {
    test(`[TD-24] Mobile menu shows the category navigation (${name})`, async ({ page }) => {
      await page.setViewportSize(site.viewports[name]);
      await expectLoaded(await page.goto('/'));
      await openMobileMenu(page);
      for (const category of ['Truck brand', 'Truck Interior', 'Lighting']) {
        // includeHidden: the open menu container keeps aria-hidden="true" (accessibility finding), so filter on visibility.
        const item = page.getByRole('menuitem', { name: category, includeHidden: true }).filter({ visible: true }).first();
        await expect(item).toBeInViewport();
        // The item must be the top element at its position, not hidden behind another menu layer.
        const onTop = await item.evaluate(link => {
          const box = link.getBoundingClientRect();
          return link.contains(document.elementFromPoint(box.x + 5, box.y + box.height / 2));
        });
        expect.soft(onTop, `${category} should not be covered by another layer`).toBe(true);
      }
    });
  }
});

// TD-24 was a design ticket (Figma). These checks run once the new homepage design is on TST.
test.describe('TD-24 Homepage – new design', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await redesignMarker(page).count()), 'The new homepage design is not on TST yet (TD-24 delivered the Figma design).');
  });

  test('[TD-24] Display Community instead of Partner program in hero', async ({ page }) => {
    await expect(main(page).getByText('Community').first()).toBeVisible();
    await expect(page.getByText(/Partner ?program/i)).toHaveCount(0);
  });

  test('[TD-24] Display menu dropdown', async ({ page }) => {
    const menu = page.getByRole('banner').getByRole('button', { name: /menu/i }).first();
    await menu.click();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Truck brand', exact: false }).first()).toBeVisible();
  });

  test('[TD-24] Remove New label after Sale', async ({ page }) => {
    const sale = page.getByRole('banner').getByRole('link', { name: /^Sale/ }).first();
    await expect(sale).not.toContainText(/new/i);
  });

  test('[TD-24] Make brand hero items visibly clickable', async ({ page }) => {
    const brand = main(page).getByRole('link', { name: site.truckBrands[0], exact: true }).first();
    await expect(brand).toBeVisible();
    await brand.click();
    await expect(page).toHaveURL(new RegExp(`${site.truckBrands[0].toLowerCase()}`));
  });

  test('[TD-24] Remove Instagram indicator from community block', async ({ page }) => {
    const block = communityBlock(page);
    await expect(block.getByText(/instagram/i)).toHaveCount(0);
    await expect(block.locator('a[href*="instagram.com"]')).toHaveCount(0);
  });

  test('[TD-24] Display product hotspot dots on community images', async ({ page }) => {
    const block = communityBlock(page);
    const hotspots = block.getByRole('button', { name: /hotspot|product/i });
    await expect(hotspots.first()).toBeVisible();
  });

  test('[TD-24] Display requested community content and CTA', async ({ page }) => {
    await expect(redesignMarker(page)).toBeVisible();
    await expect(main(page).getByText('Built something worth showing?')).toBeVisible();
    await expect(main(page).getByRole('link', { name: site.redesign.communityCta })).toBeVisible();
  });

  test('[TD-24] Display required footer navigation labels', async ({ page }) => {
    const footer = page.getByRole('contentinfo').first();
    for (const label of site.redesign.footerLinks) await expect.soft(footer.getByRole('link', { name: label, exact: true }).first()).toBeVisible();
  });

  test('[TD-24] Display Facebook and Instagram social icons in footer', async ({ page }) => {
    const footer = page.getByRole('contentinfo').first();
    const icons = [footer.locator('a[href*="facebook.com"]').first(), footer.locator('a[href*="instagram.com"]').first()];
    for (const icon of icons) await expect(icon).toBeVisible();
    const [facebook, instagram] = await Promise.all(icons.map(icon => icon.boundingBox()));
    expect(Math.round(facebook.height)).toBe(Math.round(instagram.height));
  });

  test('[TD-24] Replace JCB payment icon with new iDEAL Wero icon', async ({ page }) => {
    const footer = page.getByRole('contentinfo').first();
    await expect(footer.getByRole('img', { name: /JCB/i }), 'The JCB icon should be gone').toHaveCount(0);
    await expect(footer.locator('img[src*="jcb" i]'), 'No JCB icon without alt text either').toHaveCount(0);
    await expect(footer.getByRole('img', { name: /Wero/i }).first(), 'The iDEAL | Wero icon should be shown').toBeVisible();
  });
});
