const { test, expect, devices } = require('@playwright/test');
const {
  shop, cartButton, cartDrawer, cartCount, expectLoaded, addProduct, chooseFirstOption, cartTotal, cartSubtotal, horizontalOverflow,
} = require('./shop');

const design = require('./fixtures/design.json');

const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
test.use(pixel);

const productList = page => page.getByRole('region', { name: 'Productlijst' });
const qty = scope => scope.getByRole('spinbutton', { name: 'Aantal' });
const euros = text => Number(text.replace(/[^\d,]/g, '').replace(',', '.'));

async function expectNoOverflow(page, where) {
  expect(await horizontalOverflow(page), `${where} should not scroll sideways`).toBeLessThanOrEqual(0);
}

async function expectCardsReadable(page) {
  const cards = productList(page).getByRole('listitem');
  await expect(cards).not.toHaveCount(0);
  for (const card of (await cards.all()).slice(0, 6)) {
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('link').last()).toBeVisible();
    await expect(card).toContainText(/€\s?\d/);
    const box = await card.boundingBox();
    expect(box.x + box.width, 'The product card should fit the screen').toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
}

async function logIn(page) {
  await expectLoaded(await page.goto('/customer/account/login/'));
  await page.getByRole('textbox', { name: 'E-mail' }).fill(process.env.BULBBARN_CUSTOMER_EMAIL);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.BULBBARN_CUSTOMER_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/customer\/account\/?$/);
}

async function openMenu(page) {
  // Match both labels: the closed-menu button is wrongly labelled "Menu sluiten" (staging finding 16).
  await page.getByRole('banner').getByRole('button', { name: /^Menu (openen|sluiten)$/, expanded: false }).tap();
  const menu = page.getByRole('dialog', { name: 'Hoofdmenu' });
  await expect(menu).toBeVisible();
  return menu;
}

const heartOf = card => card.locator('[data-addto="wishlist"]');
const cardNamed = (page, name) => productList(page).getByRole('listitem')
  .filter({ has: page.getByRole('link', { name, exact: true }) }).first();

async function wishlistNames(page) {
  await expectLoaded(await page.goto('/wishlist/'));
  return (await page.getByRole('main').getByRole('listitem').getByRole('paragraph').getByRole('link').allInnerTexts())
    .map(name => name.trim());
}

// Wishlists a category product that is not on the wishlist yet and returns its name.
// Adding redirects to the wishlist page.
async function wishlistNewProduct(page) {
  const existing = await wishlistNames(page);
  await expectLoaded(await page.goto(shop.category));
  for (const card of await productList(page).getByRole('listitem').filter({ has: page.locator('[data-addto="wishlist"]') }).all()) {
    const name = (await card.getByRole('link').last().innerText()).trim();
    if (existing.includes(name)) continue;
    await heartOf(card).scrollIntoViewIfNeeded();
    await heartOf(card).tap();
    await page.waitForURL(/\/wishlist\//);
    expect(await wishlistNames(page), `${name} should be added to the wishlist`).toContain(name);
    return name;
  }
  throw new Error('Every product on the category page is already wishlisted.');
}

async function removeFromWishlist(page, name) {
  await expectLoaded(await page.goto('/wishlist/'));
  const item = page.getByRole('main').getByRole('listitem').filter({ hasText: name }).first();
  if (await item.isVisible()) {
    const removed = page.waitForResponse(response => /wishlist\/index\/remove/.test(response.url()));
    await item.getByRole('link', { name: 'Verwijder' }).tap();
    await removed;
    expect(await wishlistNames(page), 'Cleanup should remove the product').not.toContain(name);
  }
}

// These tests change the shared staging customer's wishlist/cart and restore them afterwards.
test.describe('BBM2-85 Wishlist (staging customer)', () => {
  test.skip(!process.env.BULBBARN_CUSTOMER_EMAIL, 'Needs BULBBARN_CUSTOMER_EMAIL/PASSWORD in .env.');

  test('[BBM2-85] Highlight wishlisted products correctly on mobile', async ({ page }) => {
    await logIn(page);
    const name = await wishlistNewProduct(page);
    try {
      await expectLoaded(await page.goto(shop.category));
      const heart = heartOf(cardNamed(page, name));
      await heart.scrollIntoViewIfNeeded();
      await expect(heart, `${name} is on the wishlist and should be highlighted`).toHaveClass(/bg-green/);
    } finally {
      await removeFromWishlist(page, name);
    }
  });

  test('[BBM2-85] Add product to cart from Wishlist on mobile', async ({ page }) => {
    await logIn(page);
    const name = await wishlistNewProduct(page);
    try {
      await expectLoaded(await page.goto('/wishlist/'));
      const item = page.getByRole('main').getByRole('listitem').filter({ hasText: name }).first();
      const before = await cartCount(page);
      await item.getByRole('button', { name: /^Toevoegen aan winkelwagen/ }).tap();
      await chooseFirstOption(page);
      await expect.poll(() => cartCount(page), { message: 'The wishlist product should be added to the cart' }).toBeGreaterThan(before);
      await cartButton(page).tap();
      const line = cartDrawer(page).getByRole('listitem').filter({ hasText: name }).first();
      await expect(line).toBeVisible();
      // Clean up the customer's persistent cart.
      const added = await cartCount(page);
      await line.getByRole('button', { name: /^Verwijder product/ }).tap();
      await expect.poll(() => cartCount(page), { message: 'Cleanup should remove the product from the cart' }).toBeLessThan(added);
    } finally {
      await removeFromWishlist(page, name);
    }
  });
});

test.describe('BBM2-85 Feedback mobile', () => {
  test('[BBM2-85] Show correct account links on Sign In / Sign Up screens', async ({ page }) => {
    await expectLoaded(await page.goto('/customer/account/login/'));
    await expect(page.getByRole('link', { name: 'Wachtwoord vergeten?' })).toHaveAttribute('href', /forgotpassword/);
    await page.getByRole('link', { name: 'Ik ben nieuw, account aanmaken!' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Account aanmaken');
    await page.getByRole('link', { name: 'Hier inloggen' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Je account');
  });

  test('[BBM2-85] Update mobile menu according to login status', async ({ page }) => {
    test.skip(!process.env.BULBBARN_CUSTOMER_EMAIL, 'Needs BULBBARN_CUSTOMER_EMAIL/PASSWORD in .env.');
    await expectLoaded(await page.goto('/'));
    let menu = await openMenu(page);
    await expect(menu.getByRole('link', { name: 'Log in' })).toBeVisible();
    await logIn(page);
    await expectLoaded(await page.goto('/'));
    menu = await openMenu(page);
    await expect(menu.getByRole('link', { name: 'Log in' }), 'Logged-in customers should not see Log in').toHaveCount(0);
    await expectLoaded(await page.goto('/customer/account/logout/'));
    await expectLoaded(await page.goto('/'));
    menu = await openMenu(page);
    await expect(menu.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('[BBM2-85] Open Shopping Cart from mobile cart button', async ({ page }) => {
    await addProduct(page);
    await cartButton(page).tap();
    await expect(cartDrawer(page)).toBeVisible();
    await expect(cartDrawer(page)).toContainText(shop.product.name);
  });

  test('[BBM2-85] Display filters pop-up correctly on mobile PLP', async ({ page }) => {
    await expectLoaded(await page.goto(shop.category));
    await page.getByRole('button', { name: 'Filters openen' }).tap();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Filters' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const { width } = page.viewportSize();
    expect(box.x, 'The filter pop-up should start on screen').toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, 'The filter pop-up should fit the screen').toBeLessThanOrEqual(width + 1);
    await dialog.getByRole('button', { name: 'Kleur' }).tap();
    await expect(dialog.getByRole('radiogroup', { name: 'color' })).toBeVisible();
  });

  test('[BBM2-85] Use QTY selector correctly on PDP and Cart', async ({ page }) => {
    await expectLoaded(await page.goto(shop.product.path));
    const pdpQty = qty(page.getByRole('main')).first();
    await expect(pdpQty).toHaveValue('1');
    await pdpQty.fill('2');
    await expect(pdpQty).toHaveValue('2');
    await addProduct(page, { qty: 2 });
    await expectLoaded(await page.goto('/checkout/cart/'));
    await expect(qty(page.getByRole('main')).first()).toHaveValue('2');
    const before = await cartTotal(page);
    expect(before, 'The cart should show a total').toBeGreaterThan(0);
    await qty(page.getByRole('main')).first().fill('3');
    await qty(page.getByRole('main')).first().press('Tab');
    await expect.poll(() => cartTotal(page), { message: 'The cart total should update' }).toBeGreaterThan(before);
  });

  test('[BBM2-85] Display product prices and names on search results', async ({ page }) => {
    await expectLoaded(await page.goto(`/catalogsearch/result/?q=${shop.searchTerm}`));
    await expectCardsReadable(page);
  });

  test('[BBM2-85] Display product cards correctly on mobile PLP', async ({ page }) => {
    await expectLoaded(await page.goto(shop.category));
    await expectCardsReadable(page);
    await expectNoOverflow(page, 'The category page');
  });

  test('[BBM2-85] Allow cart to contain more than 10 products when business rules permit', async ({ page }) => {
    await addProduct(page, { qty: 11 });
    await expectLoaded(await page.goto('/checkout/cart/'));
    await expect(qty(page.getByRole('main')).first()).toHaveValue('11');
  });

  test('[BBM2-85] Display required homepage icons and CMS/Trustpilot blocks', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    await expect(page.getByRole('main').getByText(shop.homeUsp).first(), 'The USP row should be shown').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore by category' })).toBeVisible();
    await expect(page.locator('iframe[src*="trustpilot" i]').first(), 'A Trustpilot block should be shown').toBeAttached();
  });

  test('[BBM2-85] Display Blog Post page correctly on mobile', async ({ page }) => {
    await expectLoaded(await page.goto('/blog/highlighted-post.html'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoOverflow(page, 'The blog post');
  });

  test('[BBM2-85] Display Planting Calendar correctly on PDP', async ({ page }) => {
    await expectLoaded(await page.goto(shop.product.path));
    const heading = page.getByRole('heading', { name: 'Plantkalender' });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect(page.getByText('Planttijd')).toBeVisible();
    await expect(page.getByText('Bloeitijd').first()).toBeVisible();
    await expectNoOverflow(page, 'The product page');
  });

  test('[BBM2-85] Display language switcher correctly in footer', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    const switcher = page.getByRole('contentinfo').getByRole('button', { name: 'Taal' });
    await switcher.scrollIntoViewIfNeeded();
    await switcher.tap();
    const english = page.getByRole('contentinfo').getByRole('link', { name: 'English' });
    await expect(english).toBeVisible();
    await english.tap();
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Customer Care' })).toBeAttached();
  });

  test('[BBM2-85] Display product options when adding configurable/custom-option items', async ({ page }) => {
    await addProduct(page, { option: '3 tubers' });
    await expectLoaded(await page.goto('/checkout/cart/'));
    await expect(page.getByRole('main').getByRole('article').first()).toContainText('3 tubers');
  });

  test('[BBM2-85] Calculate quantity, price and tax correctly after option changes', async ({ page }) => {
    await addProduct(page, { option: '3 tubers', qty: 2 });
    await expectLoaded(await page.goto('/checkout/cart/'));
    const unit = euros(shop.product.options['3 tubers']);
    await expect.poll(() => cartSubtotal(page), { message: 'Subtotal should be 2 × the 3-tuber price' })
      .toBeCloseTo(unit * 2, 2);
    await expect(page.getByRole('main').getByText(/Waarvan BTW/).first()).toBeVisible();
  });

  test('[BBM2-85] Display correct original and current prices on mobile', async ({ page }) => {
    const sale = shop.saleProduct;
    await expectLoaded(await page.goto(sale.path));
    const main = page.getByRole('main');
    await expect(main.getByText(sale.badge).first()).toBeVisible();
    // The selected (first) option shows the original price and "Nu <current price>".
    await expect(main.getByText(`Nu ${sale.currentPrice}`).first()).toBeVisible();
    await expect.soft(main.getByText(sale.originalPrice, { exact: true }).first(), `The original price should be ${sale.originalPrice}, as in the wishlist`).toBeVisible();
    await addProduct(page, { path: sale.path });
    await expectLoaded(await page.goto('/checkout/cart/'));
    await expect(page.getByRole('main').getByRole('article').filter({ hasText: sale.name }).first()).toContainText(sale.currentPrice);
  });

  // Figma mobile Cart (1560:1814) pins the totals; Checkout step 1 (1308:16864) pins "Overzicht bestelling".
  for (const [where, path, label] of [
    ['cart', '/checkout/cart/', design.mobileSticky.cart],
    ['checkout', '/checkout/', design.mobileSticky.checkout],
  ]) {
    test(`[BBM2-85] Keep sticky total usable and non-overlapping (${where})`, async ({ page }) => {
      await addProduct(page);
      await expectLoaded(await page.goto(path));
      await page.mouse.wheel(0, 400);
      // A pinned element in the bottom half of the screen that shows the total/overview.
      const sticky = () => page.evaluate(text => [...document.querySelectorAll('body *')].find(el => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return ['fixed', 'sticky'].includes(style.position) && box.height > 0 && box.top > innerHeight / 2
          && box.bottom <= innerHeight + 1 && el.innerText.includes(text);
      })?.getBoundingClientRect().toJSON() ?? null, label);
      await expect.poll(sticky, { message: `The design pins "${label}" to the bottom of the ${where} screen` }).not.toBeNull();
      // Fields must stay reachable: the focused field may not sit underneath the pinned bar.
      const bar = await sticky();
      const field = page.getByRole('main').getByRole('textbox').or(page.getByRole('main').getByRole('spinbutton')).last();
      await field.focus();
      const box = await field.boundingBox();
      expect(box.y + box.height <= bar.top + 1 || box.y >= bar.bottom - 1, 'The focused field should not be covered by the sticky bar').toBe(true);
    });
  }

  test('[BBM2-85] Keep footer scrolling stable on mobile', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    const bottom = await page.evaluate(() => window.scrollY);
    for (const delta of [-300, 200, -200, 300]) {
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, delta);
      await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(before);
      const moved = (await page.evaluate(() => window.scrollY)) - before;
      expect(Math.sign(moved), `Scrolling by ${delta}px should move the page the same way`).toBe(Math.sign(delta));
      expect(Math.abs(moved), `Scrolling by ${delta}px should not jump`).toBeLessThanOrEqual(Math.abs(delta) + 50);
    }
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow), 'The page should not be scroll-locked').not.toBe('hidden');
    await page.getByRole('contentinfo').getByRole('button', { name: 'Taal' }).tap();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - bottom), 'Using a footer control should not jump the page').toBeLessThan(400);
  });

  test('[BBM2-85] Prevent invalid minicart quantity/removal behavior', async ({ page }) => {
    await addProduct(page);
    await cartButton(page).tap();
    const drawer = cartDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(qty(drawer)).toHaveValue('1');
    await qty(drawer).fill('0');
    await qty(drawer).press('Tab');
    await expect.poll(async () => Number(await qty(drawer).inputValue()), { message: 'Quantity should not go below 1' }).toBeGreaterThanOrEqual(1);
    await drawer.getByRole('button', { name: /^Verwijder product/ }).tap();
    await expect(cartButton(page)).toHaveAttribute('aria-label', /leeg/);
  });
});
