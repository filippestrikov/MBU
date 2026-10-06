const { test, expect } = require('@playwright/test');
const design = require('./fixtures/design.json');
const content = require('./fixtures/customer-service.json');
const blog = require('./fixtures/blog.json');
const seed = require('./fixtures/blog-seed.json');

// Checks derived from the Figma design (see fixtures/design.json for frame ids).
// Design copy is English, so text checks switch to the EN store view first.

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

async function useEnglishStore(page) {
  await page.goto(design.englishStore);
}

const main = page => page.getByRole('main');
// The contact block is the part of the page that holds the "Start chat" and "Call now" actions.
const contactBlock = page => main(page).locator('div, section')
  .filter({ has: page.getByRole('link', { name: 'Start chat' }) })
  .filter({ has: page.getByRole('link', { name: 'Call now' }) }).last();

async function expectContactBlock(page) {
  for (const text of design.contactBlock) await expect.soft(main(page).getByText(text, { exact: true }).first()).toBeVisible();
  await expect(main(page).getByRole('link', { name: 'Start chat' })).toHaveAttribute('href', /\S+:\S+/);
  await expect(main(page).getByRole('link', { name: 'Call now' })).toHaveAttribute('href', /^tel:\+?\d{6,}/);
}

async function expectReviewsBlock(page) {
  for (const text of design.reviewsBlock) {
    await expect.soft(main(page).getByText(text, { exact: true }).first(), `Reviews block: "${text}"`).toBeVisible();
  }
}

test.describe('BBM2-56 Customer Service main page (design)', () => {
  test('[BBM2-56] Display Customer support block in the hero', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(content.mainPath));
    await expect(main(page).getByText(design.customerServiceMain.heroIntro)).toBeVisible();
    await expect(main(page).getByRole('heading', { name: design.customerServiceMain.supportHeading })).toBeVisible();
    const icons = main(page).getByRole('heading', { name: design.customerServiceMain.supportHeading })
      .locator('xpath=following-sibling::*[1]').getByRole('link');
    await expect(icons, 'The design shows three support icons').toHaveCount(design.customerServiceMain.supportIcons);
  });

  test('[BBM2-56] Open correct destinations from Customer support logos', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(content.mainPath));
    const icons = main(page).getByRole('heading', { name: design.customerServiceMain.supportHeading })
      .locator('xpath=following-sibling::*[1]').getByRole('link');
    await expect(icons).not.toHaveCount(0);
    for (const href of await icons.evaluateAll(links => links.map(link => link.getAttribute('href')))) {
      expect.soft(href, 'Each support icon should link to a real phone number, address or page')
        .toMatch(/^(tel:\+?\d{6,}|mailto:[^@\s]+@[^@\s]+|whatsapp:\/\/\S+phone=\d+|https?:\/\/\S+)$/);
    }
  });

  test('[BBM2-56] Display required Customer Service main-page structure (design, EN)', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(content.mainPath));
    await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(design.customerServiceMain.heading);
    const subjects = (await main(page).getByRole('navigation').getByRole('link').allInnerTexts()).map(name => name.trim());
    expect.soft(subjects, 'The design shows these eight subjects').toEqual(design.customerServiceMain.subjects);
    await expect.soft(main(page).getByRole('heading', { level: 2, name: 'Frequently asked questions' })).toBeVisible();
    await expectContactBlock(page);
    await expectReviewsBlock(page);
  });
});

test.describe('BBM2-55 Customer Care subpage (design)', () => {
  const [, subpage] = Object.entries(content.subpages)[0];

  test('[BBM2-55] Display static contact block', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(subpage.path));
    await expectContactBlock(page);
  });

  test('[BBM2-55] Display static contact block (NL store view)', async ({ page }) => {
    await expectLoaded(await page.goto(subpage.path));
    await expect(main(page).getByRole('link', { name: /chat/i }), 'The NL page should show the contact block chat action').toBeVisible();
    await expect(main(page).locator('a[href^="tel:+"]'), 'The NL page should show the contact block phone action').toBeVisible();
  });

  test('[BBM2-55] Keep contact block unchanged across subject subpages', async ({ page }) => {
    // Only one real subpage exists; the design shows the same block on the main page too.
    await useEnglishStore(page);
    await expectLoaded(await page.goto(subpage.path));
    const onSubpage = (await contactBlock(page).innerText()).replace(/\s+/g, ' ').trim();
    await expectLoaded(await page.goto(content.mainPath));
    const onMain = (await contactBlock(page).innerText()).replace(/\s+/g, ' ').trim();
    expect(onSubpage, 'The contact block should be identical').toBe(onMain);
  });

  test('[BBM2-55] Display reviews component consistently with other pages', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(subpage.path));
    await expectReviewsBlock(page);
  });

  test('[BBM2-55] Display required page sections in the designed structure', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(subpage.path));
    const order = await main(page).evaluate((root, texts) => texts.map(text => {
      const node = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a')].find(el => el.textContent.trim() === text);
      return node ? node.getBoundingClientRect().top + window.scrollY : null;
    }), ['Delivery and Time', 'Frequently asked questions', 'Have a question?', ...design.reviewsBlock.slice(0, 1)]);
    expect(order.every(y => y !== null), `Title, FAQ, contact and reviews sections should all be present: ${JSON.stringify(order)}`).toBe(true);
    expect(order, 'Sections should follow the design order').toEqual([...order].sort((a, b) => a - b));
  });
});

test.describe('BBM2-65 Blog (design)', () => {
  test('[BBM2-65] Allow client-editable Blog Overview text (design intro shown)', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(blog.overviewPath));
    await expect(main(page).getByText(design.blog.overviewIntro.trim(), { exact: false }), 'The overview intro from the design should be shown')
      .toBeVisible();
  });

  test('[BBM2-65] Display three client-selected related blogs at bottom', async ({ page }) => {
    // The seeded showcase post has three related posts selected in Admin.
    await useEnglishStore(page);
    await expectLoaded(await page.goto(`/blog/${seed.showcase.urlKey}.html`));
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
    // Language-neutral: the label's translation is checked by the BBM2-74 test.
    const relatedLinks = main(page).getByRole('link', { name: new RegExp(seed.showcase.related.map(t => t.replace(/[–-]/g, '.')).join('|')) })
      .filter({ visible: true });
    await expect(relatedLinks, `The design shows ${design.blog.single.relatedCount} related posts`).toHaveCount(design.blog.single.relatedCount);
    await expect(main(page).getByRole('heading', { level: 2 }).last(), 'The related posts should have a section heading').toBeVisible();
  });

  test('[BBM2-65] Display blog post author and reading time (design)', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(blog.overviewPath));
    await main(page).getByRole('article').first().getByRole('link').first().click();
    await expect(main(page).getByText(/\d+\s*min/).first()).toBeVisible();
    await expect(main(page).getByText(design.blog.single.author), 'The design shows "Planted by: <author>"').toBeVisible();
  });
});

test.describe('BBM2-74 Translations', () => {
  // Dutch blog labels that must not appear on the English store view (design copy: "8 min read", "Back to overview").
  const dutch = /leestijd|Terug naar overzicht|Alle blogs en updates|Gerelateerd nieuws|\b(januari|februari|maart|mei|juni|juli|augustus|oktober)\b/i;

  test('[BBM2-74] Verify language packs and translated UI strings (blog, EN store view)', async ({ page }) => {
    await useEnglishStore(page);
    await expectLoaded(await page.goto(blog.overviewPath));
    expect.soft(await main(page).innerText(), 'Blog overview should have no Dutch labels').not.toMatch(dutch);
    await expectLoaded(await page.goto(`/blog/${seed.showcase.urlKey}.html`));
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
    expect(await main(page).innerText(), 'Blog post should have no Dutch labels').not.toMatch(dutch);
  });
});

test.describe('BBM2-63 Favicon (design)', () => {
  test('[BBM2-63] Display BulbBarn favicon in browser tab (matches Figma artwork)', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const designPng = fs.readFileSync(path.join(__dirname, 'fixtures', design.favicon.file)).toString('base64');
    await expectLoaded(await page.goto('/'));
    const href = await page.locator('link[rel~="icon"]').first().evaluate(link => link.href);
    const live = (await (await page.request.get(href)).body()).toString('base64');
    // Draw both icons at 32x32 and compare pixels; small differences come from scaling.
    const difference = await page.evaluate(async ([a, b]) => {
      const draw = async src => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 32, 32);
        return ctx.getImageData(0, 0, 32, 32).data;
      };
      const [x, y] = [await draw(a), await draw(b)];
      let total = 0;
      for (let i = 0; i < x.length; i++) total += Math.abs(x[i] - y[i]);
      return total / x.length;
    }, [designPng, live]);
    expect(difference, 'The favicon should match the Figma "bulbbarn-favicon-512" artwork').toBeLessThan(12);
  });
});
