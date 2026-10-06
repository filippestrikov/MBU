const { test, expect } = require('@playwright/test');

// Representative storefront pages: home, category, PDP, cart and checkout.
const pages = ['/', '/tulips.html', '/dahlia-rancho-260082.html', '/checkout/cart/', '/checkout/'];
const iconLinks = page => page.locator('link[rel~="icon"]');

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

async function faviconHref(page) {
  await expect(iconLinks(page).first(), 'The page should declare a favicon').toBeAttached();
  const hrefs = await iconLinks(page).evaluateAll(links => links.map(link => link.href));
  expect(new Set(hrefs).size, 'All favicon links should point to one icon').toBe(1);
  return hrefs[0];
}

async function expectImage(request, href) {
  const response = await request.get(href);
  expect(response.status(), `${href} should load`).toBe(200);
  expect(response.headers()['content-type'], 'The favicon should be served as an image').toMatch(/^image\//);
  expect((await response.body()).length, 'The favicon should not be empty').toBeGreaterThan(0);
}

test('[BBM2-63] Display BulbBarn favicon in browser tab', async ({ page }) => {
  await expectLoaded(await page.goto('/'));
  const href = await faviconHref(page);
  expect(new URL(href).pathname, 'The favicon should be the one uploaded in Magento').toMatch(/^\/media\/favicon\//);
  await expectImage(page.request, href);
});

test('[BBM2-63] Display favicon on multiple storefront pages', async ({ page }) => {
  const seen = {};
  for (const path of pages) {
    await expectLoaded(await page.goto(path));
    seen[path] = await faviconHref(page);
  }
  expect(new Set(Object.values(seen)).size, `Every page should use the same favicon: ${JSON.stringify(seen)}`).toBe(1);
});

test('[BBM2-63] Load favicon without broken request', async ({ page }) => {
  const failures = [];
  page.on('response', response => {
    if (/favicon|touch-icon/i.test(response.url()) && response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error' && /favicon|touch-icon/i.test(message.text())) failures.push(message.text());
  });
  await expectLoaded(await page.goto('/', { waitUntil: 'load' }));
  await expectImage(page.request, await faviconHref(page));
  expect(failures, 'No favicon request or console error should fail').toEqual([]);
});

test('[BBM2-63] Display favicon after hard refresh/new session', async ({ browser, page }, testInfo) => {
  await expectLoaded(await page.goto('/'));
  const expected = await faviconHref(page);

  // A fresh context has no HTTP cache, like an incognito session.
  const { baseURL, httpCredentials } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, httpCredentials });
  const fresh = await context.newPage();
  await expectLoaded(await fresh.goto('/'));
  expect(await faviconHref(fresh), 'A new session should get the deployed favicon').toBe(expected);
  await expectImage(fresh.request, expected);

  await expectLoaded(await fresh.reload());
  expect(await faviconHref(fresh), 'A reload should keep the deployed favicon').toBe(expected);
  await context.close();
});
